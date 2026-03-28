"""Text-to-Speech pipeline service with chunking, SSML, and Circuit Breaker."""

from __future__ import annotations

import re
import asyncio
import subprocess
import tempfile
import os
from datetime import datetime, timezone
from google.cloud import texttospeech_v1 as tts
from google.cloud import storage
from circuitbreaker import circuit
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.exceptions import UpstreamException, NotFoundException
from app.core.constants import (
    CIRCUIT_FAILURE_THRESHOLD,
    CIRCUIT_RECOVERY_TIMEOUT,
    TTS_MIN_CHUNK_BYTES,
)

logger = get_logger(__name__)


class TtsService:
    def __init__(self, db, storage_client: storage.Client | None = None):
        self.db = db
        self.settings = get_settings()
        self.tts_client = tts.TextToSpeechAsyncClient()
        self.storage_client = storage_client or storage.Client()
        self.bucket = self.storage_client.bucket(self.settings.GCS_AUDIO_BUCKET)

    # ─── Text Preprocessing ──────────────────────────

    @staticmethod
    def clean_text(text: str) -> str:
        """Remove HTML/Markdown tags and normalize whitespace."""
        text = re.sub(r"<[^>]+>", "", text)          # HTML tags
        text = re.sub(r"!\[.*?\]\(.*?\)", "", text)   # MD images
        text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)  # MD links → text
        text = re.sub(r"```[\s\S]*?```", "（コードブロック省略）", text)  # Code blocks
        text = re.sub(r"`[^`]+`", "", text)           # Inline code
        text = re.sub(r"#{1,6}\s*", "", text)         # Heading markers
        text = re.sub(r"[*_]{1,3}([^*_]+)[*_]{1,3}", r"\1", text)  # Bold/italic
        text = re.sub(r"https?://\S+", "リンク先参照", text)  # URLs
        text = re.sub(r"\n{3,}", "\n\n", text)        # Multiple newlines
        text = re.sub(r"[ \t]+", " ", text)            # Multiple spaces
        return text.strip()

    def split_into_chunks(self, text: str, max_bytes: int | None = None) -> list[str]:
        """Split text into chunks respecting sentence boundaries."""
        max_bytes = max_bytes or self.settings.TTS_CHUNK_MAX_BYTES
        min_bytes = TTS_MIN_CHUNK_BYTES

        # First split by sections (double newlines / headings)
        sections = re.split(r"\n\n+", text)
        chunks: list[str] = []
        current_chunk = ""

        for section in sections:
            section = section.strip()
            if not section:
                continue

            combined = f"{current_chunk}\n\n{section}" if current_chunk else section

            if len(combined.encode("utf-8")) <= max_bytes:
                current_chunk = combined
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                # Section itself may be too large → split by sentences
                if len(section.encode("utf-8")) > max_bytes:
                    sentences = re.split(r"(?<=[。．.!?！？])\s*", section)
                    current_chunk = ""
                    for sentence in sentences:
                        sentence = sentence.strip()
                        if not sentence:
                            continue
                        test = f"{current_chunk}{sentence}" if current_chunk else sentence
                        if len(test.encode("utf-8")) <= max_bytes:
                            current_chunk = test
                        else:
                            if current_chunk:
                                chunks.append(current_chunk)
                            # Single sentence too large → split by commas
                            if len(sentence.encode("utf-8")) > max_bytes:
                                parts = re.split(r"(?<=[、，,])\s*", sentence)
                                current_chunk = ""
                                for part in parts:
                                    test2 = f"{current_chunk}{part}" if current_chunk else part
                                    if len(test2.encode("utf-8")) <= max_bytes:
                                        current_chunk = test2
                                    else:
                                        if current_chunk:
                                            chunks.append(current_chunk)
                                        current_chunk = part
                            else:
                                current_chunk = sentence
                else:
                    current_chunk = section

        if current_chunk:
            chunks.append(current_chunk)

        # Filter out chunks that are too small (merge with neighbors)
        merged: list[str] = []
        for chunk in chunks:
            if merged and len(chunk.encode("utf-8")) < min_bytes:
                test = f"{merged[-1]}\n\n{chunk}"
                if len(test.encode("utf-8")) <= max_bytes:
                    merged[-1] = test
                    continue
            merged.append(chunk)

        return merged

    @staticmethod
    def text_to_ssml(
        text: str,
        heading_break: str = "1.5s",
        paragraph_break: str = "0.8s",
    ) -> str:
        """Convert plain text chunk to SSML."""
        lines = text.split("\n")
        ssml_parts = ["<speak>"]

        for line in lines:
            line = line.strip()
            if not line:
                ssml_parts.append(f'<break time="{paragraph_break}"/>')
                continue

            # Escape XML special characters
            line = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

            # Detect heading-like patterns
            if len(line) < 80 and (line.startswith("第") or re.match(r"^\d+[.．]", line)):
                ssml_parts.append(f'<break time="{heading_break}"/>')
                ssml_parts.append(f'<emphasis level="strong">{line}</emphasis>')
                ssml_parts.append('<break time="1.0s"/>')
            else:
                ssml_parts.append(f"<p>{line}</p>")

        ssml_parts.append("</speak>")
        return "\n".join(ssml_parts)

    # ─── TTS Synthesis (with Circuit Breaker) ────────

    @circuit(failure_threshold=CIRCUIT_FAILURE_THRESHOLD, recovery_timeout=CIRCUIT_RECOVERY_TIMEOUT)
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=5, max=60))
    async def synthesize_chunk(self, ssml: str, config: dict) -> bytes:
        """Synthesize a single SSML chunk via Google Cloud TTS."""
        try:
            synthesis_input = tts.SynthesisInput(ssml=ssml)
            voice = tts.VoiceSelectionParams(
                language_code=config.get("language_code", "ja-JP"),
                name=config.get("voice_name", self.settings.TTS_DEFAULT_VOICE),
            )
            audio_config = tts.AudioConfig(
                audio_encoding=tts.AudioEncoding[config.get("audio_encoding", "MP3")],
                speaking_rate=config.get("speaking_rate", 1.0),
                pitch=config.get("pitch", 0.0),
                volume_gain_db=config.get("volume_gain_db", 0.0),
                sample_rate_hertz=config.get("sample_rate_hertz", 24000),
            )
            response = await self.tts_client.synthesize_speech(
                input=synthesis_input, voice=voice, audio_config=audio_config
            )
            return response.audio_content
        except (ConnectionError, TimeoutError, OSError, ValueError) as e:
            logger.error("tts_synthesis_failed", error=str(e))
            raise UpstreamException("Google Cloud TTS", str(e))

    async def synthesize_parallel(self, ssml_chunks: list[str], config: dict) -> list[bytes]:
        """Synthesize multiple chunks in parallel (bounded concurrency)."""
        semaphore = asyncio.Semaphore(self.settings.TTS_MAX_CONCURRENT)

        async def _synth(ssml: str) -> bytes:
            async with semaphore:
                return await self.synthesize_chunk(ssml, config)

        results = await asyncio.gather(
            *[_synth(ssml) for ssml in ssml_chunks],
            return_exceptions=True,
        )

        # Check for failures
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                raise UpstreamException("Google Cloud TTS", f"Chunk {i} failed: {result}")

        return results  # type: ignore

    # ─── Audio Merging ────────────────────────────────

    @staticmethod
    def merge_audio_chunks(chunks: list[bytes], output_format: str = "mp3") -> bytes:
        """Merge audio chunks using ffmpeg with loudness normalization."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Write chunks to temp files
            file_list_path = os.path.join(tmpdir, "filelist.txt")
            with open(file_list_path, "w") as fl:
                for i, chunk in enumerate(chunks):
                    chunk_path = os.path.join(tmpdir, f"chunk_{i:04d}.{output_format}")
                    with open(chunk_path, "wb") as f:
                        f.write(chunk)
                    fl.write(f"file '{chunk_path}'\n")

            # Merge with ffmpeg
            output_path = os.path.join(tmpdir, f"merged.{output_format}")
            cmd = [
                "ffmpeg", "-y", "-f", "concat", "-safe", "0",
                "-i", file_list_path,
                "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                "-b:a", "128k",
                output_path,
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            if result.returncode != 0:
                logger.error("ffmpeg_merge_failed", stderr=result.stderr)
                raise RuntimeError(f"ffmpeg merge failed: {result.stderr[:500]}")

            with open(output_path, "rb") as f:
                return f.read()

    # ─── Upload to GCS ────────────────────────────────

    async def upload_audio(self, audio_data: bytes, content_id: str, fmt: str = "mp3") -> str:
        """Upload merged audio to GCS, return public URL path."""
        blob_path = f"audio/{content_id}/main.{fmt}"
        blob = self.bucket.blob(blob_path)
        blob.upload_from_string(audio_data, content_type=f"audio/{fmt}")
        logger.info("audio_uploaded", content_id=content_id, size=len(audio_data))
        return blob_path

    # ─── Full Pipeline (called by worker) ─────────────

    async def run_pipeline(self, job_id: str) -> None:
        """Execute full TTS pipeline for a job."""
        jobs_ref = self.db.collection("tts_jobs").document(job_id)
        job_doc = await jobs_ref.get()
        if not job_doc.exists:
            raise NotFoundException("TTS Job")

        job = job_doc.to_dict()
        content_id = job["content_id"]
        config = job["config"]

        try:
            # Update status: processing
            await jobs_ref.update({
                "status": "processing",
                "started_at": datetime.now(timezone.utc),
                "progress.current_step": "splitting",
            })

            # 1. Get content text
            content_doc = await self.db.collection("contents").document(content_id).get()
            if not content_doc.exists:
                raise NotFoundException("Content")
            raw_text = content_doc.to_dict().get("body_markdown", "")

            # 2. Clean & split
            clean = self.clean_text(raw_text)
            chunks = self.split_into_chunks(clean)
            total_chunks = len(chunks)

            await jobs_ref.update({
                "progress.total_chunks": total_chunks,
                "progress.current_step": "converting",
            })

            # 3. Generate SSML
            ssml_overrides = job.get("ssml_overrides", {})
            ssml_chunks = [
                self.text_to_ssml(
                    chunk,
                    heading_break=ssml_overrides.get("heading_break_time", "1.5s"),
                    paragraph_break=ssml_overrides.get("paragraph_break_time", "0.8s"),
                )
                for chunk in chunks
            ]

            # 4. Synthesize (parallel with progress updates)
            audio_chunks = await self.synthesize_parallel(ssml_chunks, config)

            await jobs_ref.update({
                "progress.completed_chunks": total_chunks,
                "progress.current_step": "merging",
                "progress.percent_complete": 70,
            })

            # 5. Merge
            fmt = config.get("audio_encoding", "MP3").lower()
            if fmt == "ogg_opus":
                fmt = "ogg"
            merged = self.merge_audio_chunks(audio_chunks, fmt)

            await jobs_ref.update({
                "progress.current_step": "uploading",
                "progress.percent_complete": 90,
            })

            # 6. Upload
            audio_path = await self.upload_audio(merged, content_id, fmt)

            # 7. Get duration via ffprobe
            duration = self._get_duration(merged)

            # 8. Update content & job
            now = datetime.now(timezone.utc)
            await self.db.collection("contents").document(content_id).update({
                "audio.status": "completed",
                "audio.audio_url": audio_path,
                "audio.duration_seconds": duration,
                "audio.file_size_bytes": len(merged),
                "audio.format": fmt,
                "audio.tts_voice": config.get("voice_name"),
                "audio.tts_job_id": job_id,
                "audio.generated_at": now,
                "updated_at": now,
            })

            await jobs_ref.update({
                "status": "completed",
                "completed_at": now,
                "progress.percent_complete": 100,
                "progress.current_step": "completed",
                "result": {
                    "audio_url": audio_path,
                    "duration_seconds": duration,
                    "file_size_bytes": len(merged),
                    "chapter_count": total_chunks,
                },
            })

            logger.info("tts_pipeline_completed", job_id=job_id, content_id=content_id)

        except (UpstreamException, NotFoundException, RuntimeError, OSError) as e:
            logger.error("tts_pipeline_failed", job_id=job_id, error=str(e))
            await jobs_ref.update({
                "status": "failed",
                "error": {
                    "code": "pipeline_error",
                    "message": str(e)[:500],
                    "retry_count": job.get("error", {}).get("retry_count", 0) + 1,
                },
            })
            await self.db.collection("contents").document(content_id).update({
                "audio.status": "failed",
            })
            raise

    @staticmethod
    def _get_duration(audio_data: bytes) -> float:
        """Get audio duration using ffprobe."""
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            f.write(audio_data)
            f.flush()
            try:
                result = subprocess.run(
                    ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                     "-of", "default=noprint_wrappers=1:nokey=1", f.name],
                    capture_output=True, text=True, timeout=30,
                )
                return float(result.stdout.strip()) if result.stdout.strip() else 0.0
            finally:
                os.unlink(f.name)
