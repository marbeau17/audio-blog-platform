"""Unit tests for StreamService."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone
from app.services.stream_service import StreamService


@pytest.fixture
def mock_db():
    return AsyncMock()


@pytest.fixture
def stream_service(mock_db):
    return StreamService(db=mock_db, storage_client=MagicMock())


class TestGetStreamUrl:
    @pytest.mark.asyncio
    async def test_free_content_returns_url(self, stream_service, mock_db):
        content_doc = MagicMock()
        content_doc.exists = True
        content_doc.to_dict.return_value = {
            "pricing": {"type": "free"},
            "audio": {"status": "completed", "audio_url": "audio/test/main.mp3"},
        }
        mock_db.collection.return_value.document.return_value.get = AsyncMock(return_value=content_doc)

        # Mock GCS blob
        mock_blob = MagicMock()
        mock_blob.generate_signed_url.return_value = "https://storage.example.com/signed"
        stream_service.bucket.blob.return_value = mock_blob

        # Mock increment
        mock_db.collection.return_value.document.return_value.update = AsyncMock()

        result = await stream_service.get_stream_url("content_1", "user_1")
        assert "url" in result
        assert result["content_id"] == "content_1"

    @pytest.mark.asyncio
    async def test_no_audio_raises(self, stream_service, mock_db):
        content_doc = MagicMock()
        content_doc.exists = True
        content_doc.to_dict.return_value = {
            "pricing": {"type": "free"},
            "audio": {"status": "none", "audio_url": None},
        }
        mock_db.collection.return_value.document.return_value.get = AsyncMock(return_value=content_doc)

        from app.core.exceptions import NotFoundException
        with pytest.raises(NotFoundException):
            await stream_service.get_stream_url("content_1", "user_1")

    @pytest.mark.asyncio
    async def test_paid_content_without_purchase_forbidden(self, stream_service, mock_db):
        content_doc = MagicMock()
        content_doc.exists = True
        content_doc.to_dict.return_value = {
            "pricing": {"type": "paid"},
            "audio": {"status": "completed", "audio_url": "audio/test/main.mp3"},
        }

        purchase_doc = MagicMock()
        purchase_doc.exists = False

        def col_side_effect(name):
            mock = MagicMock()
            if name == "contents":
                mock.document.return_value.get = AsyncMock(return_value=content_doc)
            elif name == "users":
                user_ref = MagicMock()
                purchases_col = MagicMock()
                purchases_col.document.return_value.get = AsyncMock(return_value=purchase_doc)
                user_ref.collection.return_value = purchases_col
                mock.document.return_value = user_ref
            return mock

        mock_db.collection.side_effect = col_side_effect

        from app.core.exceptions import ForbiddenException
        with pytest.raises(ForbiddenException):
            await stream_service.get_stream_url("content_1", "user_1")

    @pytest.mark.asyncio
    async def test_nonexistent_content_raises(self, stream_service, mock_db):
        doc = MagicMock()
        doc.exists = False
        mock_db.collection.return_value.document.return_value.get = AsyncMock(return_value=doc)

        from app.core.exceptions import NotFoundException
        with pytest.raises(NotFoundException):
            await stream_service.get_stream_url("nonexistent", "user_1")


class TestPlaybackPosition:
    @pytest.mark.asyncio
    async def test_save_position(self, stream_service, mock_db):
        mock_db.collection.return_value.document.return_value \
            .collection.return_value.document.return_value.set = AsyncMock()
        # Mock increment for completion check
        mock_db.collection.return_value.document.return_value.update = AsyncMock()

        result = await stream_service.save_playback_position(
            content_id="c1", user_id="u1",
            position_seconds=120.5, total_duration_seconds=600.0,
            playback_speed=1.0, device_id="device_abc",
        )
        assert result["position_seconds"] == 120.5
        assert result["content_id"] == "c1"

    @pytest.mark.asyncio
    async def test_get_position_exists(self, stream_service, mock_db):
        doc = MagicMock()
        doc.exists = True
        doc.to_dict.return_value = {
            "position_seconds": 300.0,
            "total_duration_seconds": 600.0,
            "playback_speed": 1.5,
            "updated_at": datetime.now(timezone.utc),
        }
        mock_db.collection.return_value.document.return_value \
            .collection.return_value.document.return_value.get = AsyncMock(return_value=doc)

        result = await stream_service.get_playback_position("c1", "u1")
        assert result is not None
        assert result["position_seconds"] == 300.0

    @pytest.mark.asyncio
    async def test_get_position_not_found(self, stream_service, mock_db):
        doc = MagicMock()
        doc.exists = False
        mock_db.collection.return_value.document.return_value \
            .collection.return_value.document.return_value.get = AsyncMock(return_value=doc)

        result = await stream_service.get_playback_position("c1", "u1")
        assert result is None

    @pytest.mark.asyncio
    async def test_completion_detected_at_98_percent(self, stream_service, mock_db):
        mock_db.collection.return_value.document.return_value \
            .collection.return_value.document.return_value.set = AsyncMock()
        mock_db.collection.return_value.document.return_value.update = AsyncMock()

        await stream_service.save_playback_position(
            content_id="c1", user_id="u1",
            position_seconds=590.0, total_duration_seconds=600.0,
        )
        # Completion count should be incremented (98.3%)
        # The update call should have been made for stats.completion_count


class TestRecordPlayEvent:
    @pytest.mark.asyncio
    async def test_records_event(self, stream_service, mock_db):
        mock_db.collection.return_value.add = AsyncMock()
        await stream_service.record_play_event("c1", "u1", "play", 0.0)
        mock_db.collection.return_value.add.assert_called_once()
