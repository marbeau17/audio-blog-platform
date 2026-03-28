"""Content management service."""

from __future__ import annotations

import re
import hashlib
from datetime import datetime, timezone
import markdown as md_lib
import bleach
from google.cloud.firestore_v1 import AsyncClient, FieldFilter
from app.core.logging import get_logger
from app.core.exceptions import NotFoundException, ConflictException, ForbiddenException
from app.schemas import ContentCreate, ContentUpdate

logger = get_logger(__name__)

CONTENTS_COLLECTION = "contents"
MAX_VERSIONS = 20


class ContentService:
    def __init__(self, db: AsyncClient):
        self.db = db
        self.collection = db.collection(CONTENTS_COLLECTION)

    async def list_contents(
        self,
        status: str = "published",
        category: str | None = None,
        tag: str | None = None,
        creator_id: str | None = None,
        sort: str = "newest",
        has_audio: bool | None = None,
        pricing: str | None = None,
        q: str | None = None,
        cursor: str | None = None,
        limit: int = 20,
    ) -> tuple[list[dict], str | None]:
        """List contents with filters and cursor pagination."""
        query = self.collection.where(filter=FieldFilter("is_deleted", "==", False))

        if status:
            query = query.where(filter=FieldFilter("status", "==", status))
        if category:
            query = query.where(filter=FieldFilter("category_ids", "array_contains", category))
        if creator_id:
            query = query.where(filter=FieldFilter("creator_id", "==", creator_id))
        if pricing == "free":
            query = query.where(filter=FieldFilter("pricing.type", "==", "free"))
        elif pricing == "paid":
            query = query.where(filter=FieldFilter("pricing.type", "==", "paid"))
        if has_audio is True:
            query = query.where(filter=FieldFilter("audio.status", "==", "completed"))

        # Sort
        sort_map = {
            "newest": ("published_at", "DESCENDING"),
            "popular": ("stats.play_count", "DESCENDING"),
            "rating": ("stats.average_rating", "DESCENDING"),
        }
        field, direction = sort_map.get(sort, sort_map["newest"])
        query = query.order_by(field, direction=direction)

        # Cursor-based pagination
        if cursor:
            cursor_doc = await self.collection.document(cursor).get()
            if cursor_doc.exists:
                query = query.start_after(cursor_doc)

        query = query.limit(limit + 1)
        docs = [doc async for doc in query.stream()]

        has_more = len(docs) > limit
        items = docs[:limit]
        next_cursor = items[-1].id if has_more and items else None

        return [self._doc_to_dict(doc) for doc in items], next_cursor

    async def get_content(self, content_id: str) -> dict:
        """Get single content by ID."""
        doc = await self.collection.document(content_id).get()
        data = doc.to_dict()
        if not doc.exists or data is None or data.get("is_deleted"):
            raise NotFoundException("Content")
        return self._doc_to_dict(doc)

    async def create_content(self, data: ContentCreate, creator_id: str, creator_name: str) -> dict:
        """Create new content."""
        slug = self._generate_slug(data.title)

        # Check slug uniqueness
        existing = self.collection.where(filter=FieldFilter("slug", "==", slug)).limit(1)
        if [doc async for doc in existing.stream()]:
            slug = f"{slug}-{hashlib.md5(str(datetime.now()).encode()).hexdigest()[:6]}"

        now = datetime.now(timezone.utc)
        doc_data = {
            "creator_id": creator_id,
            "creator_display_name": creator_name,
            "title": data.title,
            "slug": slug,
            "excerpt": data.excerpt,
            "body_markdown": data.body_markdown,
            "body_html": self._markdown_to_html(data.body_markdown),
            "thumbnail_url": data.thumbnail_url,
            "audio": {
                "status": "none",
                "audio_url": None,
                "duration_seconds": None,
                "file_size_bytes": None,
                "format": "mp3",
                "tts_voice": None,
                "tts_job_id": None,
                "generated_at": None,
            },
            "category_ids": data.category_ids,
            "tags": data.tags,
            "series_id": data.series_id,
            "series_order": data.series_order,
            "pricing": data.pricing.model_dump(),
            "stats": {
                "view_count": 0,
                "play_count": 0,
                "completion_count": 0,
                "purchase_count": 0,
                "average_rating": 0.0,
                "review_count": 0,
                "total_revenue": 0,
            },
            "status": data.status,
            "published_at": now if data.status == "published" else None,
            "scheduled_at": (
                datetime.fromisoformat(data.scheduled_at)
                if data.status == "scheduled" and data.scheduled_at
                else None
            ),
            "seo": data.seo.model_dump(),
            "created_at": now,
            "updated_at": now,
            "current_version": 1,
            "is_deleted": False,
        }

        doc_ref = self.collection.document()
        await doc_ref.set(doc_data)
        doc_data["content_id"] = doc_ref.id

        # Save initial version
        await doc_ref.collection("versions").document("v1").set({
            "version": 1,
            "body_markdown": data.body_markdown,
            "title": data.title,
            "created_at": now,
            "created_by": creator_id,
        })

        logger.info("content_created", content_id=doc_ref.id, creator_id=creator_id)
        return doc_data

    async def update_content(self, content_id: str, data: ContentUpdate, user_id: str) -> dict:
        """Update existing content."""
        doc_ref = self.collection.document(content_id)
        doc = await doc_ref.get()
        current = doc.to_dict()
        if not doc.exists or current is None or current.get("is_deleted"):
            raise NotFoundException("Content")

        if current["creator_id"] != user_id:
            raise ForbiddenException("Only the creator can update this content")

        update_data = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}

        if "body_markdown" in update_data:
            update_data["body_html"] = self._markdown_to_html(update_data["body_markdown"])
            # Save version
            new_version = current.get("current_version", 0) + 1
            if new_version <= MAX_VERSIONS:
                await doc_ref.collection("versions").document(f"v{new_version}").set({
                    "version": new_version,
                    "body_markdown": update_data["body_markdown"],
                    "title": update_data.get("title", current["title"]),
                    "created_at": datetime.now(timezone.utc),
                    "created_by": user_id,
                })
            update_data["current_version"] = new_version

        # Handle scheduled publishing
        if update_data.get("status") == "scheduled" and update_data.get("scheduled_at"):
            update_data["scheduled_at"] = datetime.fromisoformat(update_data["scheduled_at"])
        elif update_data.get("status") == "published":
            update_data["published_at"] = datetime.now(timezone.utc)
            update_data["scheduled_at"] = None
        elif update_data.get("status") == "draft":
            update_data["scheduled_at"] = None

        update_data["updated_at"] = datetime.now(timezone.utc)
        await doc_ref.update(update_data)

        updated_doc = await doc_ref.get()
        return self._doc_to_dict(updated_doc)

    async def delete_content(self, content_id: str, user_id: str, is_admin: bool = False) -> None:
        """Soft-delete content."""
        doc_ref = self.collection.document(content_id)
        doc = await doc_ref.get()
        current = doc.to_dict()
        if not doc.exists or current is None:
            raise NotFoundException("Content")
        if current["creator_id"] != user_id and not is_admin:
            raise ForbiddenException("Only the creator can delete this content")

        await doc_ref.update({
            "is_deleted": True,
            "status": "archived",
            "updated_at": datetime.now(timezone.utc),
        })
        logger.info("content_deleted", content_id=content_id, by=user_id)

    async def publish_content(self, content_id: str, user_id: str) -> dict:
        """Publish a draft content."""
        doc_ref = self.collection.document(content_id)
        doc = await doc_ref.get()
        current = doc.to_dict()
        if not doc.exists or current is None:
            raise NotFoundException("Content")
        if current["creator_id"] != user_id:
            raise ForbiddenException()

        now = datetime.now(timezone.utc)
        await doc_ref.update({
            "status": "published",
            "published_at": now,
            "updated_at": now,
        })
        updated = await doc_ref.get()
        return self._doc_to_dict(updated)

    async def unpublish_content(self, content_id: str, user_id: str) -> dict:
        """Unpublish content back to draft."""
        doc_ref = self.collection.document(content_id)
        doc = await doc_ref.get()
        current = doc.to_dict()
        if not doc.exists or current is None:
            raise NotFoundException("Content")
        if current["creator_id"] != user_id:
            raise ForbiddenException()

        await doc_ref.update({
            "status": "draft",
            "updated_at": datetime.now(timezone.utc),
        })
        updated = await doc_ref.get()
        return self._doc_to_dict(updated)

    async def get_versions(self, content_id: str) -> list[dict]:
        """Get version history for content."""
        doc = await self.collection.document(content_id).get()
        if not doc.exists:
            raise NotFoundException("Content")
        versions_ref = self.collection.document(content_id).collection("versions")
        versions = []
        async for v in versions_ref.order_by("version", direction="DESCENDING").stream():
            vd = v.to_dict()
            if vd is None:
                continue
            vd["version_id"] = v.id
            versions.append(vd)
        return versions

    # ─── Helpers ──────────────────────────────────────

    @staticmethod
    def _generate_slug(title: str) -> str:
        slug = re.sub(r"[^\w\s-]", "", title.lower())
        slug = re.sub(r"[\s_]+", "-", slug).strip("-")
        return slug[:100] if slug else "untitled"

    _ALLOWED_TAGS = [
        "p", "h1", "h2", "h3", "h4", "h5", "h6",
        "strong", "em", "a", "ul", "ol", "li",
        "blockquote", "code", "pre", "img", "br", "hr",
        "table", "thead", "tbody", "tr", "th", "td",
    ]
    _ALLOWED_ATTRIBUTES = {
        "a": ["href"],
        "img": ["src", "alt"],
    }
    _MD_EXTENSIONS = ["fenced_code", "tables", "toc"]

    @classmethod
    def _markdown_to_html(cls, md: str) -> str:
        """Convert Markdown to sanitized HTML."""
        raw_html = md_lib.markdown(md, extensions=cls._MD_EXTENSIONS)
        clean_html = bleach.clean(
            raw_html,
            tags=cls._ALLOWED_TAGS,
            attributes=cls._ALLOWED_ATTRIBUTES,
            strip=True,
        )
        return clean_html

    @staticmethod
    def _doc_to_dict(doc) -> dict:
        data = doc.to_dict()
        if data is None:
            raise NotFoundException("Content")
        data["content_id"] = doc.id
        # Convert Timestamps to datetime
        for key in ("created_at", "updated_at", "published_at", "scheduled_at"):
            if data.get(key) and hasattr(data[key], "isoformat"):
                continue  # Already datetime-compatible
        return data
