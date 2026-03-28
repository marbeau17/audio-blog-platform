"""Streaming service - signed URLs and playback position management."""

from datetime import datetime, timezone, timedelta
from google.cloud import storage
from google.cloud.firestore_v1 import AsyncClient

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.exceptions import NotFoundException, ForbiddenException

logger = get_logger(__name__)


class StreamService:
    def __init__(self, db: AsyncClient, storage_client: storage.Client | None = None):
        self.db = db
        self.settings = get_settings()
        self.storage_client = storage_client or storage.Client()
        self.bucket = self.storage_client.bucket(self.settings.GCS_AUDIO_BUCKET)

    async def get_stream_url(self, content_id: str, user_id: str) -> dict:
        """Generate signed URL for audio streaming after access check."""
        content_doc = await self.db.collection("contents").document(content_id).get()
        if not content_doc.exists:
            raise NotFoundException("Content")

        content = content_doc.to_dict()
        audio = content.get("audio", {})

        if audio.get("status") != "completed" or not audio.get("audio_url"):
            raise NotFoundException("Audio not available for this content")

        # Access check: free content or purchased
        if content["pricing"]["type"] == "paid":
            purchase_doc = await (
                self.db.collection("users").document(user_id)
                .collection("purchases").document(content_id).get()
            )
            if not purchase_doc.exists or not purchase_doc.to_dict().get("access_granted"):
                raise ForbiddenException("Purchase required to access this content")

        # Generate signed URL
        blob = self.bucket.blob(audio["audio_url"])
        expiry = timedelta(seconds=self.settings.SIGNED_URL_EXPIRY_SECONDS)
        signed_url = blob.generate_signed_url(
            version="v4",
            expiration=expiry,
            method="GET",
            response_type="audio/mpeg",
        )

        expires_at = datetime.now(timezone.utc) + expiry

        # Record play event
        await self._increment_play_count(content_id)

        return {
            "url": signed_url,
            "expires_at": expires_at.isoformat(),
            "content_id": content_id,
        }

    async def get_chapters(self, content_id: str) -> list[dict]:
        """Get chapter list for content."""
        chapters_ref = (
            self.db.collection("contents").document(content_id)
            .collection("chapters")
            .order_by("order")
        )
        chapters = []
        async for doc in chapters_ref.stream():
            ch = doc.to_dict()
            ch["chapter_id"] = doc.id
            chapters.append(ch)
        return chapters

    async def get_playback_position(self, content_id: str, user_id: str) -> dict | None:
        """Get saved playback position."""
        doc = await (
            self.db.collection("users").document(user_id)
            .collection("playback_positions").document(content_id).get()
        )
        if not doc.exists:
            return None
        data = doc.to_dict()
        data["content_id"] = content_id
        return data

    async def save_playback_position(
        self,
        content_id: str,
        user_id: str,
        position_seconds: float,
        total_duration_seconds: float,
        playback_speed: float = 1.0,
        device_id: str = "",
    ) -> dict:
        """Save or update playback position."""
        now = datetime.now(timezone.utc)
        data = {
            "content_id": content_id,
            "position_seconds": position_seconds,
            "total_duration_seconds": total_duration_seconds,
            "playback_speed": playback_speed,
            "device_id": device_id,
            "updated_at": now,
        }

        await (
            self.db.collection("users").document(user_id)
            .collection("playback_positions").document(content_id)
            .set(data, merge=True)
        )

        # Check completion (98%+ = completed)
        if total_duration_seconds > 0 and position_seconds / total_duration_seconds >= 0.98:
            await self._increment_completion_count(content_id)

        return data

    async def record_play_event(
        self, content_id: str, user_id: str, event_type: str, position_seconds: float
    ) -> None:
        """Record a play event for analytics."""
        await self.db.collection("play_events").add({
            "content_id": content_id,
            "user_id": user_id,
            "event_type": event_type,
            "position_seconds": position_seconds,
            "created_at": datetime.now(timezone.utc),
        })

    async def _increment_play_count(self, content_id: str) -> None:
        from google.cloud.firestore_v1 import Increment
        await self.db.collection("contents").document(content_id).update({
            "stats.play_count": Increment(1),
        })

    async def _increment_completion_count(self, content_id: str) -> None:
        from google.cloud.firestore_v1 import Increment
        await self.db.collection("contents").document(content_id).update({
            "stats.completion_count": Increment(1),
        })
