"""Unit tests for NotificationService."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timezone

from app.services.notification_service import NotificationService
from app.core.exceptions import NotFoundException


@pytest.fixture
def mock_db():
    db = MagicMock()
    return db


@pytest.fixture
def service(mock_db):
    return NotificationService(mock_db)


@pytest.fixture
def mock_notification_doc():
    doc = MagicMock()
    doc.id = "notif_001"
    doc.exists = True
    doc.to_dict.return_value = {
        "user_id": "test_user_123",
        "type": "tts_complete",
        "title": "音声生成完了",
        "message": "記事「テスト記事」の音声が生成されました。",
        "data": {"content_id": "content_001"},
        "is_read": False,
        "created_at": datetime(2026, 3, 28, 12, 0, 0, tzinfo=timezone.utc),
    }
    doc.reference = MagicMock()
    doc.reference.update = AsyncMock()
    return doc


# ---------- TestCreateNotification ----------


class TestCreateNotification:
    @pytest.mark.asyncio
    async def test_creates_notification(self, service, mock_db):
        """Verify all expected fields are saved to Firestore."""
        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "notif_new"
        mock_collection = mock_db.collection.return_value
        mock_collection.add = AsyncMock(return_value=(None, mock_doc_ref))

        result = await service.create_notification(
            user_id="test_user_123",
            type="purchase",
            title="購入完了",
            message="記事を購入しました。",
            data={"content_id": "content_001", "price_jpy": 500},
        )

        mock_collection.add.assert_awaited_once()
        saved_data = mock_collection.add.call_args[0][0]

        assert saved_data["user_id"] == "test_user_123"
        assert saved_data["type"] == "purchase"
        assert saved_data["title"] == "購入完了"
        assert saved_data["message"] == "記事を購入しました。"
        assert saved_data["data"] == {"content_id": "content_001", "price_jpy": 500}
        assert isinstance(saved_data["created_at"], datetime)
        assert result["notification_id"] == "notif_new"

    @pytest.mark.asyncio
    async def test_sets_is_read_false_by_default(self, service, mock_db):
        """New notifications must have is_read=False."""
        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "notif_new"
        mock_collection = mock_db.collection.return_value
        mock_collection.add = AsyncMock(return_value=(None, mock_doc_ref))

        result = await service.create_notification(
            user_id="test_user_123",
            type="system",
            title="お知らせ",
            message="システムメンテナンスのお知らせ",
        )

        saved_data = mock_collection.add.call_args[0][0]
        assert saved_data["is_read"] is False
        assert result["is_read"] is False


# ---------- TestGetNotifications ----------


class TestGetNotifications:
    @pytest.mark.asyncio
    async def test_returns_notifications_sorted_by_date(self, service, mock_db):
        """Notifications are queried with DESCENDING created_at order."""
        doc1 = MagicMock()
        doc1.id = "notif_001"
        doc1.to_dict.return_value = {
            "user_id": "test_user_123",
            "type": "system",
            "title": "通知1",
            "message": "古い通知",
            "data": None,
            "is_read": True,
            "created_at": datetime(2026, 3, 27, tzinfo=timezone.utc),
        }
        doc2 = MagicMock()
        doc2.id = "notif_002"
        doc2.to_dict.return_value = {
            "user_id": "test_user_123",
            "type": "purchase",
            "title": "通知2",
            "message": "新しい通知",
            "data": None,
            "is_read": False,
            "created_at": datetime(2026, 3, 28, tzinfo=timezone.utc),
        }

        mock_collection = mock_db.collection.return_value
        mock_query = MagicMock()
        mock_collection.where.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query

        async def mock_stream():
            for doc in [doc2, doc1]:
                yield doc

        mock_query.stream.return_value = mock_stream()

        results, next_cursor = await service.get_notifications("test_user_123")

        assert len(results) == 2
        assert results[0]["notification_id"] == "notif_002"
        assert results[1]["notification_id"] == "notif_001"
        assert next_cursor is None
        mock_query.order_by.assert_called_once_with("created_at", direction="DESCENDING")

    @pytest.mark.asyncio
    async def test_unread_only_filter(self, service, mock_db):
        """When unread_only=True, an additional is_read filter is applied."""
        doc = MagicMock()
        doc.id = "notif_unread"
        doc.to_dict.return_value = {
            "user_id": "test_user_123",
            "type": "system",
            "title": "未読通知",
            "message": "未読のお知らせ",
            "data": None,
            "is_read": False,
            "created_at": datetime(2026, 3, 28, tzinfo=timezone.utc),
        }

        mock_collection = mock_db.collection.return_value
        mock_query = MagicMock()
        mock_collection.where.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.where.return_value = mock_query
        mock_query.limit.return_value = mock_query

        async def mock_stream():
            yield doc

        mock_query.stream.return_value = mock_stream()

        results, _ = await service.get_notifications(
            "test_user_123", unread_only=True,
        )

        assert len(results) == 1
        assert results[0]["is_read"] is False
        # Two .where() calls: one on collection (user_id), one on query (is_read)
        assert mock_query.where.call_count == 1

    @pytest.mark.asyncio
    async def test_pagination_with_cursor(self, service, mock_db):
        """When a cursor is provided, the query starts after the cursor document."""
        mock_collection = mock_db.collection.return_value

        # The cursor document lookup
        mock_cursor_doc = MagicMock()
        mock_cursor_doc.exists = True
        mock_cursor_doc_ref = AsyncMock()
        mock_cursor_doc_ref.get.return_value = mock_cursor_doc
        mock_collection.document.return_value = mock_cursor_doc_ref

        mock_query = MagicMock()
        mock_collection.where.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.start_after.return_value = mock_query
        mock_query.limit.return_value = mock_query

        async def mock_stream():
            return
            yield  # noqa: make this an async generator

        mock_query.stream.return_value = mock_stream()

        results, next_cursor = await service.get_notifications(
            "test_user_123", cursor="notif_prev",
        )

        mock_collection.document.assert_called_with("notif_prev")
        mock_query.start_after.assert_called_once_with(mock_cursor_doc)
        assert results == []
        assert next_cursor is None

    @pytest.mark.asyncio
    async def test_empty_notifications(self, service, mock_db):
        """When the user has no notifications, return an empty list."""
        mock_collection = mock_db.collection.return_value
        mock_query = MagicMock()
        mock_collection.where.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query

        async def mock_stream():
            return
            yield  # noqa: make this an async generator

        mock_query.stream.return_value = mock_stream()

        results, next_cursor = await service.get_notifications("test_user_123")

        assert results == []
        assert next_cursor is None


# ---------- TestMarkAsRead ----------


class TestMarkAsRead:
    @pytest.mark.asyncio
    async def test_marks_single_notification(self, service, mock_db, mock_notification_doc):
        """Mark a single notification as read and verify update call."""
        mock_collection = mock_db.collection.return_value
        mock_doc_ref = AsyncMock()
        mock_doc_ref.get.return_value = mock_notification_doc
        mock_collection.document.return_value = mock_doc_ref

        result = await service.mark_as_read("test_user_123", "notif_001")

        mock_doc_ref.update.assert_awaited_once_with({"is_read": True})
        assert result["is_read"] is True
        assert result["notification_id"] == "notif_001"

    @pytest.mark.asyncio
    async def test_notification_not_found(self, service, mock_db):
        """Raise NotFoundException when the notification does not exist."""
        mock_collection = mock_db.collection.return_value
        mock_doc_ref = AsyncMock()
        not_found_doc = MagicMock()
        not_found_doc.exists = False
        mock_doc_ref.get.return_value = not_found_doc
        mock_collection.document.return_value = mock_doc_ref

        with pytest.raises(NotFoundException):
            await service.mark_as_read("test_user_123", "notif_nonexistent")


# ---------- TestMarkAllRead ----------


class TestMarkAllRead:
    @pytest.mark.asyncio
    async def test_marks_all_unread_notifications(self, service, mock_db):
        """All unread notifications for the user should be updated to is_read=True."""
        doc1 = MagicMock()
        doc1.reference = MagicMock()
        doc1.reference.update = AsyncMock()
        doc2 = MagicMock()
        doc2.reference = MagicMock()
        doc2.reference.update = AsyncMock()

        mock_collection = mock_db.collection.return_value
        mock_query = MagicMock()
        mock_collection.where.return_value = mock_query
        mock_query.where.return_value = mock_query

        async def mock_stream():
            for doc in [doc1, doc2]:
                yield doc

        mock_query.stream.return_value = mock_stream()

        count = await service.mark_all_read("test_user_123")

        assert count == 2
        doc1.reference.update.assert_awaited_once_with({"is_read": True})
        doc2.reference.update.assert_awaited_once_with({"is_read": True})


# ---------- TestGetUnreadCount ----------


class TestGetUnreadCount:
    @pytest.mark.asyncio
    async def test_returns_correct_count(self, service, mock_db):
        """Count only unread notifications for the given user."""
        doc1 = MagicMock()
        doc2 = MagicMock()
        doc3 = MagicMock()

        mock_collection = mock_db.collection.return_value
        mock_query = MagicMock()
        mock_collection.where.return_value = mock_query
        mock_query.where.return_value = mock_query

        async def mock_stream():
            for doc in [doc1, doc2, doc3]:
                yield doc

        mock_query.stream.return_value = mock_stream()

        count = await service.get_unread_count("test_user_123")

        assert count == 3

    @pytest.mark.asyncio
    async def test_zero_when_all_read(self, service, mock_db):
        """Return 0 when the user has no unread notifications."""
        mock_collection = mock_db.collection.return_value
        mock_query = MagicMock()
        mock_collection.where.return_value = mock_query
        mock_query.where.return_value = mock_query

        async def mock_stream():
            return
            yield  # noqa: make this an async generator

        mock_query.stream.return_value = mock_stream()

        count = await service.get_unread_count("test_user_123")

        assert count == 0
