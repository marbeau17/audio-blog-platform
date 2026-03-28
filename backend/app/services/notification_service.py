"""Notification management service."""

from __future__ import annotations

from datetime import datetime, timezone
from google.cloud.firestore_v1 import AsyncClient, FieldFilter
from app.core.logging import get_logger
from app.core.exceptions import NotFoundException

logger = get_logger(__name__)

NOTIFICATIONS_COLLECTION = "notifications"

NOTIFICATION_TYPES = {"tts_complete", "purchase", "payment_received", "payout", "system"}


class NotificationService:
    def __init__(self, db: AsyncClient):
        self.db = db
        self.notifications = db.collection(NOTIFICATIONS_COLLECTION)

    async def create_notification(
        self,
        user_id: str,
        type: str,
        title: str,
        message: str,
        data: dict | None = None,
    ) -> dict:
        """Save a notification to the notifications collection."""
        now = datetime.now(timezone.utc)
        notification_data = {
            "user_id": user_id,
            "type": type,
            "title": title,
            "message": message,
            "data": data,
            "is_read": False,
            "created_at": now,
        }

        _, doc_ref = await self.notifications.add(notification_data)
        notification_data["notification_id"] = doc_ref.id

        logger.info(
            "notification_created",
            notification_id=doc_ref.id,
            user_id=user_id,
            type=type,
        )
        return notification_data

    async def get_notifications(
        self,
        user_id: str,
        limit: int = 20,
        cursor: str | None = None,
        unread_only: bool = False,
    ) -> tuple[list[dict], str | None]:
        """List notifications for a user with cursor pagination."""
        query = self.notifications.where(
            filter=FieldFilter("user_id", "==", user_id),
        ).order_by("created_at", direction="DESCENDING")

        if unread_only:
            query = query.where(filter=FieldFilter("is_read", "==", False))

        if cursor:
            cursor_doc = await self.notifications.document(cursor).get()
            if cursor_doc.exists:
                query = query.start_after(cursor_doc)

        query = query.limit(limit + 1)
        docs = [doc async for doc in query.stream()]

        has_more = len(docs) > limit
        items = docs[:limit]
        next_cursor = items[-1].id if has_more and items else None

        results = []
        for doc in items:
            data = doc.to_dict()
            data["notification_id"] = doc.id
            results.append(data)

        return results, next_cursor

    async def mark_as_read(self, user_id: str, notification_id: str) -> dict:
        """Mark a single notification as read."""
        doc_ref = self.notifications.document(notification_id)
        doc = await doc_ref.get()

        if not doc.exists:
            raise NotFoundException("Notification")

        notification_data = doc.to_dict()
        if notification_data["user_id"] != user_id:
            raise NotFoundException("Notification")

        await doc_ref.update({"is_read": True})
        notification_data["is_read"] = True
        notification_data["notification_id"] = notification_id

        logger.info("notification_read", notification_id=notification_id, user_id=user_id)
        return notification_data

    async def mark_all_read(self, user_id: str) -> int:
        """Mark all unread notifications as read for a user. Returns count updated."""
        query = (
            self.notifications
            .where(filter=FieldFilter("user_id", "==", user_id))
            .where(filter=FieldFilter("is_read", "==", False))
        )

        count = 0
        async for doc in query.stream():
            await doc.reference.update({"is_read": True})
            count += 1

        logger.info("notifications_all_read", user_id=user_id, count=count)
        return count

    async def get_unread_count(self, user_id: str) -> int:
        """Get the count of unread notifications for a user."""
        query = (
            self.notifications
            .where(filter=FieldFilter("user_id", "==", user_id))
            .where(filter=FieldFilter("is_read", "==", False))
        )

        count = 0
        async for _ in query.stream():
            count += 1

        return count
