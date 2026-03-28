"""Review/rating management service."""

from __future__ import annotations

from datetime import datetime, timezone
from google.cloud.firestore_v1 import AsyncClient, FieldFilter
from app.core.logging import get_logger
from app.core.exceptions import NotFoundException, ConflictException, ForbiddenException
from app.schemas import ReviewCreate, ReviewUpdate

logger = get_logger(__name__)

CONTENTS_COLLECTION = "contents"
REVIEWS_SUBCOLLECTION = "reviews"


class ReviewService:
    def __init__(self, db: AsyncClient):
        self.db = db
        self.contents = db.collection(CONTENTS_COLLECTION)

    def _reviews_ref(self, content_id: str):
        return self.contents.document(content_id).collection(REVIEWS_SUBCOLLECTION)

    async def _assert_content_exists(self, content_id: str) -> None:
        """Raise NotFoundException if the content does not exist."""
        doc = await self.contents.document(content_id).get()
        if not doc.exists or doc.to_dict().get("is_deleted"):
            raise NotFoundException("Content")

    async def create_review(
        self, content_id: str, body: ReviewCreate, user_id: str, user_display_name: str
    ) -> dict:
        """Create a review. One review per user per content."""
        await self._assert_content_exists(content_id)

        # Check for existing review by this user
        reviews_ref = self._reviews_ref(content_id)
        existing = reviews_ref.where(filter=FieldFilter("user_id", "==", user_id)).limit(1)
        existing_docs = [doc async for doc in existing.stream()]
        if existing_docs:
            raise ConflictException("You have already reviewed this content")

        now = datetime.now(timezone.utc)
        review_data = {
            "content_id": content_id,
            "user_id": user_id,
            "user_display_name": user_display_name,
            "rating": body.rating,
            "comment": body.comment,
            "created_at": now,
            "updated_at": now,
        }

        _, doc_ref = await reviews_ref.add(review_data)
        review_data["review_id"] = doc_ref.id

        await self._recalculate_rating(content_id)

        logger.info("review_created", content_id=content_id, review_id=doc_ref.id, user_id=user_id)
        return review_data

    async def get_reviews(
        self, content_id: str, cursor: str | None = None, limit: int = 20
    ) -> tuple[list[dict], str | None]:
        """List reviews for a content with cursor pagination."""
        await self._assert_content_exists(content_id)

        reviews_ref = self._reviews_ref(content_id)
        query = reviews_ref.order_by("created_at", direction="DESCENDING")

        if cursor:
            cursor_doc = await reviews_ref.document(cursor).get()
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
            data["review_id"] = doc.id
            results.append(data)

        return results, next_cursor

    async def update_review(
        self, content_id: str, review_id: str, body: ReviewUpdate, user_id: str
    ) -> dict:
        """Update a review. Only the author can update."""
        reviews_ref = self._reviews_ref(content_id)
        doc_ref = reviews_ref.document(review_id)
        doc = await doc_ref.get()

        if not doc.exists:
            raise NotFoundException("Review")

        review_data = doc.to_dict()
        if review_data["user_id"] != user_id:
            raise ForbiddenException("You can only edit your own review")

        updates: dict = {"updated_at": datetime.now(timezone.utc)}
        if body.rating is not None:
            updates["rating"] = body.rating
        if body.comment is not None:
            updates["comment"] = body.comment

        await doc_ref.update(updates)

        review_data.update(updates)
        review_data["review_id"] = review_id

        if "rating" in updates:
            await self._recalculate_rating(content_id)

        logger.info("review_updated", content_id=content_id, review_id=review_id)
        return review_data

    async def delete_review(
        self, content_id: str, review_id: str, user_id: str, is_admin: bool = False
    ) -> None:
        """Delete a review. Author or admin only."""
        reviews_ref = self._reviews_ref(content_id)
        doc_ref = reviews_ref.document(review_id)
        doc = await doc_ref.get()

        if not doc.exists:
            raise NotFoundException("Review")

        review_data = doc.to_dict()
        if review_data["user_id"] != user_id and not is_admin:
            raise ForbiddenException("You can only delete your own review")

        await doc_ref.delete()
        await self._recalculate_rating(content_id)

        logger.info("review_deleted", content_id=content_id, review_id=review_id, user_id=user_id)

    async def _recalculate_rating(self, content_id: str) -> None:
        """Recalculate average rating and review count for a content."""
        reviews_ref = self._reviews_ref(content_id)
        docs = [doc async for doc in reviews_ref.stream()]

        review_count = len(docs)
        if review_count == 0:
            average_rating = 0.0
        else:
            total = sum(doc.to_dict().get("rating", 0) for doc in docs)
            average_rating = round(total / review_count, 2)

        await self.contents.document(content_id).update({
            "stats.average_rating": average_rating,
            "stats.review_count": review_count,
        })
