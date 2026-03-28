"""TTS (Text-to-Speech) endpoints."""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Query

from app.core.security import CreatorUser
from app.core.exceptions import NotFoundException
from app.schemas import TtsConvertRequest, TtsPreviewRequest, TtsJobResponse
from app.services import get_tts_service
from app.core.firebase import get_async_firestore_client

router = APIRouter()


@router.post("/convert", status_code=202)
async def convert_to_speech(body: TtsConvertRequest, user: CreatorUser):
    """Create TTS conversion job."""
    db = get_async_firestore_client()

    # Verify content ownership
    content_doc = await db.collection("contents").document(body.content_id).get()
    if not content_doc.exists:
        raise NotFoundException("Content")
    content = content_doc.to_dict()
    if content["creator_id"] != user.uid and not user.is_admin:
        from app.core.exceptions import ForbiddenException
        raise ForbiddenException("Not your content")

    now = datetime.now(timezone.utc)
    job_data = {
        "content_id": body.content_id,
        "creator_id": user.uid,
        "config": body.config.model_dump(),
        "ssml_overrides": body.ssml_overrides.model_dump(),
        "status": "queued",
        "priority": body.priority,
        "progress": {
            "total_chunks": 0,
            "completed_chunks": 0,
            "current_step": "queued",
            "percent_complete": 0,
        },
        "created_at": now,
        "started_at": None,
        "completed_at": None,
        "expires_at": now + timedelta(days=30),
    }

    job_ref = db.collection("tts_jobs").document()
    await job_ref.set(job_data)

    # Update content audio status
    await db.collection("contents").document(body.content_id).update({
        "audio.status": "queued",
        "audio.tts_job_id": job_ref.id,
    })

    # In production, dispatch to Cloud Tasks here
    # For now, the worker polls or is triggered separately

    job_data["job_id"] = job_ref.id
    return {"data": job_data}


@router.get("/jobs")
async def list_tts_jobs(
    user: CreatorUser,
    status: str | None = None,
    cursor: str | None = None,
    limit: int = Query(20, ge=1, le=50),
):
    """List creator's TTS jobs."""
    db = get_async_firestore_client()
    query = (
        db.collection("tts_jobs")
        .where("creator_id", "==", user.uid)
        .order_by("created_at", direction="DESCENDING")
    )
    if status:
        query = query.where("status", "==", status)
    query = query.limit(limit)

    jobs = []
    async for doc in query.stream():
        jd = doc.to_dict()
        jd["job_id"] = doc.id
        jobs.append(jd)

    return {"data": jobs}


@router.get("/jobs/{job_id}")
async def get_tts_job(job_id: str, user: CreatorUser):
    """Get TTS job detail and progress."""
    db = get_async_firestore_client()
    doc = await db.collection("tts_jobs").document(job_id).get()
    if not doc.exists:
        raise NotFoundException("TTS Job")

    job = doc.to_dict()
    if job["creator_id"] != user.uid and not user.is_admin:
        from app.core.exceptions import ForbiddenException
        raise ForbiddenException()

    job["job_id"] = doc.id
    return {"data": job}


@router.post("/jobs/{job_id}/cancel")
async def cancel_tts_job(job_id: str, user: CreatorUser):
    """Cancel a queued/processing job."""
    db = get_async_firestore_client()
    doc = await db.collection("tts_jobs").document(job_id).get()
    if not doc.exists:
        raise NotFoundException("TTS Job")

    job = doc.to_dict()
    if job["creator_id"] != user.uid and not user.is_admin:
        from app.core.exceptions import ForbiddenException
        raise ForbiddenException()

    if job["status"] not in ("queued", "processing"):
        from app.core.exceptions import ConflictException
        raise ConflictException("Job cannot be cancelled in current status")

    await doc.reference.update({
        "status": "failed",
        "error": {"code": "cancelled", "message": "Cancelled by user", "retry_count": 0},
        "completed_at": datetime.now(timezone.utc),
    })

    return {"data": {"job_id": job_id, "status": "cancelled"}}


@router.post("/jobs/{job_id}/retry")
async def retry_tts_job(job_id: str, user: CreatorUser):
    """Retry a failed job."""
    db = get_async_firestore_client()
    doc = await db.collection("tts_jobs").document(job_id).get()
    if not doc.exists:
        raise NotFoundException("TTS Job")

    job = doc.to_dict()
    if job["creator_id"] != user.uid and not user.is_admin:
        from app.core.exceptions import ForbiddenException
        raise ForbiddenException()

    if job["status"] != "failed":
        from app.core.exceptions import ConflictException
        raise ConflictException("Only failed jobs can be retried")

    await doc.reference.update({
        "status": "queued",
        "error": None,
        "progress": {"total_chunks": 0, "completed_chunks": 0, "current_step": "queued", "percent_complete": 0},
    })

    return {"data": {"job_id": job_id, "status": "queued"}}


@router.post("/preview")
async def preview_tts(body: TtsPreviewRequest, user: CreatorUser):
    """Preview TTS for short text (max 500 chars)."""
    import base64
    svc = get_tts_service()
    ssml = svc.text_to_ssml(body.text)
    audio_bytes = await svc.synthesize_chunk(ssml, body.config.model_dump())
    audio_b64 = base64.b64encode(audio_bytes).decode()
    return {"data": {"audio_base64": audio_b64, "format": body.config.audio_encoding.lower()}}


@router.get("/voices")
async def list_voices(user: CreatorUser):
    """List available TTS voices."""
    return {
        "data": [
            {"name": "ja-JP-Neural2-B", "language": "ja-JP", "gender": "MALE", "type": "Neural2"},
            {"name": "ja-JP-Neural2-C", "language": "ja-JP", "gender": "FEMALE", "type": "Neural2"},
            {"name": "ja-JP-Neural2-D", "language": "ja-JP", "gender": "MALE", "type": "Neural2"},
            {"name": "ja-JP-Wavenet-A", "language": "ja-JP", "gender": "FEMALE", "type": "WaveNet"},
            {"name": "ja-JP-Wavenet-B", "language": "ja-JP", "gender": "FEMALE", "type": "WaveNet"},
            {"name": "ja-JP-Wavenet-C", "language": "ja-JP", "gender": "MALE", "type": "WaveNet"},
            {"name": "ja-JP-Wavenet-D", "language": "ja-JP", "gender": "MALE", "type": "WaveNet"},
            {"name": "en-US-Neural2-A", "language": "en-US", "gender": "MALE", "type": "Neural2"},
            {"name": "en-US-Neural2-C", "language": "en-US", "gender": "FEMALE", "type": "Neural2"},
        ]
    }
