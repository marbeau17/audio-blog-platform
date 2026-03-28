"""Unit tests for ContentService."""

import pytest
from unittest.mock import AsyncMock, MagicMock, PropertyMock
from datetime import datetime, timezone
from app.services.content_service import ContentService
from app.schemas import ContentCreate, ContentUpdate, PricingInfo, SeoInfo


@pytest.fixture
def mock_db():
    db = AsyncMock()
    return db


@pytest.fixture
def content_service(mock_db):
    return ContentService(mock_db)


@pytest.fixture
def mock_doc():
    doc = MagicMock()
    doc.id = "content_001"
    doc.exists = True
    doc.to_dict.return_value = {
        "creator_id": "creator_456",
        "creator_display_name": "Creator",
        "title": "テスト記事",
        "slug": "test-article",
        "excerpt": "概要",
        "body_markdown": "# テスト\n\n本文です。",
        "body_html": "<div>...</div>",
        "thumbnail_url": None,
        "audio": {"status": "none", "audio_url": None, "duration_seconds": None,
                  "file_size_bytes": None, "format": "mp3", "tts_voice": None,
                  "tts_job_id": None, "generated_at": None},
        "category_ids": ["business"],
        "tags": ["test"],
        "series_id": None,
        "series_order": None,
        "pricing": {"type": "free", "price_jpy": 0, "currency": "JPY"},
        "stats": {"view_count": 10, "play_count": 5, "completion_count": 2,
                  "purchase_count": 0, "average_rating": 0.0, "review_count": 0,
                  "total_revenue": 0},
        "status": "published",
        "published_at": datetime.now(timezone.utc),
        "scheduled_at": None,
        "seo": {"meta_title": None, "meta_description": None, "og_image_url": None},
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "current_version": 1,
        "is_deleted": False,
    }
    return doc


class TestGenerateSlug:
    def test_basic_slug(self):
        assert ContentService._generate_slug("Hello World") == "hello-world"

    def test_japanese_slug(self):
        slug = ContentService._generate_slug("テスト記事")
        assert slug == "テスト記事"

    def test_special_chars_removed(self):
        slug = ContentService._generate_slug("Hello! @World# $Test")
        assert "@" not in slug
        assert "#" not in slug
        assert "$" not in slug

    def test_empty_title(self):
        assert ContentService._generate_slug("") == "untitled"

    def test_long_title_truncated(self):
        long_title = "A" * 200
        slug = ContentService._generate_slug(long_title)
        assert len(slug) <= 100


class TestGetContent:
    @pytest.mark.asyncio
    async def test_get_existing_content(self, content_service, mock_db, mock_doc):
        mock_db.collection.return_value.document.return_value.get = AsyncMock(return_value=mock_doc)
        result = await content_service.get_content("content_001")
        assert result["content_id"] == "content_001"
        assert result["title"] == "テスト記事"

    @pytest.mark.asyncio
    async def test_get_nonexistent_content(self, content_service, mock_db):
        not_found_doc = MagicMock()
        not_found_doc.exists = False
        mock_db.collection.return_value.document.return_value.get = AsyncMock(return_value=not_found_doc)

        from app.core.exceptions import NotFoundException
        with pytest.raises(NotFoundException):
            await content_service.get_content("nonexistent")

    @pytest.mark.asyncio
    async def test_get_deleted_content_raises(self, content_service, mock_db, mock_doc):
        data = mock_doc.to_dict()
        data["is_deleted"] = True
        mock_doc.to_dict.return_value = data
        mock_db.collection.return_value.document.return_value.get = AsyncMock(return_value=mock_doc)

        from app.core.exceptions import NotFoundException
        with pytest.raises(NotFoundException):
            await content_service.get_content("content_001")


class TestCreateContent:
    @pytest.mark.asyncio
    async def test_create_content_success(self, content_service, mock_db):
        # Mock slug uniqueness check
        mock_stream = AsyncMock()
        mock_stream.__aiter__ = AsyncMock(return_value=iter([]))
        mock_query = MagicMock()
        mock_query.limit.return_value.stream.return_value = mock_stream
        mock_db.collection.return_value.where.return_value = mock_query

        # Mock document creation
        mock_doc_ref = AsyncMock()
        mock_doc_ref.id = "new_content_id"
        mock_doc_ref.set = AsyncMock()
        mock_doc_ref.collection.return_value.document.return_value.set = AsyncMock()
        mock_db.collection.return_value.document.return_value = mock_doc_ref

        data = ContentCreate(
            title="新しい記事",
            excerpt="テスト概要",
            body_markdown="# テスト\n\n本文",
            category_ids=["business"],
            tags=["test"],
            pricing=PricingInfo(type="free", price_jpy=0),
        )

        result = await content_service.create_content(data, "creator_456", "Creator")
        assert result["title"] == "新しい記事"
        assert result["creator_id"] == "creator_456"
        assert result["status"] == "draft"


class TestDeleteContent:
    @pytest.mark.asyncio
    async def test_delete_own_content(self, content_service, mock_db, mock_doc):
        mock_db.collection.return_value.document.return_value.get = AsyncMock(return_value=mock_doc)
        mock_db.collection.return_value.document.return_value.update = AsyncMock()

        await content_service.delete_content("content_001", "creator_456")
        mock_db.collection.return_value.document.return_value.update.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_others_content_forbidden(self, content_service, mock_db, mock_doc):
        mock_db.collection.return_value.document.return_value.get = AsyncMock(return_value=mock_doc)

        from app.core.exceptions import ForbiddenException
        with pytest.raises(ForbiddenException):
            await content_service.delete_content("content_001", "other_user")

    @pytest.mark.asyncio
    async def test_admin_can_delete_any(self, content_service, mock_db, mock_doc):
        mock_db.collection.return_value.document.return_value.get = AsyncMock(return_value=mock_doc)
        mock_db.collection.return_value.document.return_value.update = AsyncMock()

        await content_service.delete_content("content_001", "admin_user", is_admin=True)
        mock_db.collection.return_value.document.return_value.update.assert_called_once()


class TestMarkdownToHtml:
    def test_basic_conversion(self):
        result = ContentService._markdown_to_html("Hello")
        assert "<div>" in result
        assert "Hello" in result

    def test_html_entities_escaped(self):
        result = ContentService._markdown_to_html("<script>alert('xss')</script>")
        assert "<script>" not in result
        assert "&lt;script&gt;" in result
