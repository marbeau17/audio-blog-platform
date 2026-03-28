"""Favorites/bookmarks service - manage user favorites."""

from __future__ import annotations

from datetime import datetime, timezone

from google.cloud.firestore_v1 import AsyncClient

from app.core.logging import get_logger
from app.core.exceptions import ConflictException, NotFoundException

logger = get_logger(__name__)


class FavoritesService:
    def __init__(self, db: AsyncClient):
        self.db = db

    async def add_favorite(self, user_id: str, content_id: str) -> dict:
        """Add content to user's favorites subcollection."""
        content_doc = await self.db.collection("contents").document(content_id).get()
        if not content_doc.exists:
            raise NotFoundException("Content")

        content = content_doc.to_dict()

        # Check if already favorited
        fav_ref = (
            self.db.collection("users").document(user_id)
            .collection("favorites").document(content_id)
        )
        existing = await fav_ref.get()
        if existing.exists:
            raise ConflictException("Favorite already exists")

        now = datetime.now(timezone.utc)

        data = {
            "content_id": content_id,
            "content_title": content.get("title", ""),
            "creator_display_name": content.get("creator_display_name", ""),
            "thumbnail_url": content.get("thumbnail_url"),
            "added_at": now,
        }

        await fav_ref.set(data)

        return data

    async def remove_favorite(self, user_id: str, content_id: str) -> None:
        """Remove content from user's favorites subcollection."""
        doc_ref = (
            self.db.collection("users").document(user_id)
            .collection("favorites").document(content_id)
        )
        doc = await doc_ref.get()
        if not doc.exists:
            raise NotFoundException("Favorite")

        await doc_ref.delete()

    async def get_favorites(
        self, user_id: str, limit: int = 20, cursor: str | None = None
    ) -> dict:
        """List user's favorites with cursor-based pagination."""
        query = (
            self.db.collection("users").document(user_id)
            .collection("favorites")
            .order_by("added_at", direction="DESCENDING")
            .limit(limit + 1)
        )

        if cursor:
            cursor_doc = await (
                self.db.collection("users").document(user_id)
                .collection("favorites").document(cursor).get()
            )
            if cursor_doc.exists:
                query = query.start_after(cursor_doc)

        docs = await query.get()

        favorites: list[dict] = []
        for doc in docs:
            fav = doc.to_dict()
            fav["content_id"] = doc.id
            favorites.append(fav)

        has_more = len(favorites) > limit
        if has_more:
            favorites = favorites[:limit]

        next_cursor = favorites[-1]["content_id"] if has_more else None

        return {
            "items": favorites,
            "pagination": {
                "cursor": next_cursor,
                "has_more": has_more,
                "limit": limit,
            },
        }

    async def is_favorite(self, user_id: str, content_id: str) -> bool:
        """Check if content is in user's favorites."""
        doc = await (
            self.db.collection("users").document(user_id)
            .collection("favorites").document(content_id).get()
        )
        return doc.exists
