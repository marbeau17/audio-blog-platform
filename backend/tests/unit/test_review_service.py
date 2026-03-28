"""Unit tests for ReviewService."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timezone
from app.services.review_service import ReviewService
from app.schemas import ReviewCreate, ReviewUpdate
from app.core.exceptions import NotFoundException, ConflictException, ForbiddenException


@pytest.fixture
def mock_db():
    db = MagicMock()
    return db


@pytest.fixture
def review_service(mock_db):
    return ReviewService(mock_db)


@pytest.fixture
def mock_content_doc():
    doc = MagicMock()
    doc.exists = True
    doc.to_dict.return_value = {"is_deleted": False}
    return doc


@pytest.fixture
def mock_review_doc():
    doc = MagicMock()
    doc.id = "review_001"
    doc.exists = True
    doc.to_dict.return_value = {
        "content_id": "content_001",
        "user_id": "user_123",
        "user_display_name": "Test User",
        "rating": 4,
        "comment": "Great content!",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    return doc


def _make_review_doc(doc_id, user_id, rating, comment="Good"):
    """Helper to create a mock review document."""
    doc = MagicMock()
    doc.id = doc_id
    doc.exists = True
    doc.to_dict.return_value = {
        "content_id": "content_001",
        "user_id": user_id,
        "user_display_name": f"User {user_id}",
        "rating": rating,
        "comment": comment,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    return doc


def _setup_content_exists(mock_db, mock_content_doc):
    """Wire up mock_db so _assert_content_exists passes."""
    mock_db.collection.return_value.document.return_value.get = AsyncMock(
        return_value=mock_content_doc
    )


def _setup_subcollection(mock_db):
    """Return a MagicMock that acts as the reviews subcollection reference."""
    sub = MagicMock()
    mock_db.collection.return_value.document.return_value.collection = MagicMock(
        return_value=sub
    )
    return sub


class TestCreateReview:
    @pytest.mark.asyncio
    async def test_creates_review_successfully(self, review_service, mock_db, mock_content_doc):
        _setup_content_exists(mock_db, mock_content_doc)
        sub = _setup_subcollection(mock_db)

        # No existing review by this user
        async def _empty_stream():
            return
            yield

        mock_query = MagicMock()
        mock_query.limit.return_value.stream.return_value = _empty_stream()
        sub.where.return_value = mock_query

        # Mock add
        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "new_review_id"
        sub.add = AsyncMock(return_value=(None, mock_doc_ref))

        # Mock recalculate: stream returns one review
        async def _reviews_stream():
            yield _make_review_doc("new_review_id", "user_123", 5)

        sub.stream.return_value = _reviews_stream()
        mock_db.collection.return_value.document.return_value.update = AsyncMock()

        body = ReviewCreate(rating=5, comment="Amazing!")
        result = await review_service.create_review("content_001", body, "user_123", "Test User")

        assert result["review_id"] == "new_review_id"
        assert result["rating"] == 5
        assert result["comment"] == "Amazing!"
        assert result["user_id"] == "user_123"
        sub.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_one_review_per_user(self, review_service, mock_db, mock_content_doc):
        _setup_content_exists(mock_db, mock_content_doc)
        sub = _setup_subcollection(mock_db)

        # Existing review found
        existing_doc = _make_review_doc("existing_review", "user_123", 3)

        async def _existing_stream():
            yield existing_doc

        mock_query = MagicMock()
        mock_query.limit.return_value.stream.return_value = _existing_stream()
        sub.where.return_value = mock_query

        body = ReviewCreate(rating=5, comment="Duplicate")
        with pytest.raises(ConflictException):
            await review_service.create_review("content_001", body, "user_123", "Test User")

    @pytest.mark.asyncio
    async def test_updates_content_stats(self, review_service, mock_db, mock_content_doc):
        _setup_content_exists(mock_db, mock_content_doc)
        sub = _setup_subcollection(mock_db)

        # No existing review
        async def _empty_stream():
            return
            yield

        mock_query = MagicMock()
        mock_query.limit.return_value.stream.return_value = _empty_stream()
        sub.where.return_value = mock_query

        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "review_new"
        sub.add = AsyncMock(return_value=(None, mock_doc_ref))

        # After create, recalculate streams two reviews
        r1 = _make_review_doc("r1", "user_a", 4)
        r2 = _make_review_doc("r2", "user_b", 2)

        async def _reviews_stream():
            yield r1
            yield r2

        sub.stream.return_value = _reviews_stream()
        mock_update = AsyncMock()
        mock_db.collection.return_value.document.return_value.update = mock_update

        body = ReviewCreate(rating=4, comment="Nice")
        await review_service.create_review("content_001", body, "user_c", "User C")

        # Verify stats update was called with correct average
        mock_update.assert_called_with({
            "stats.average_rating": 3.0,
            "stats.review_count": 2,
        })

    @pytest.mark.asyncio
    async def test_content_not_found(self, review_service, mock_db):
        not_found_doc = MagicMock()
        not_found_doc.exists = False
        mock_db.collection.return_value.document.return_value.get = AsyncMock(
            return_value=not_found_doc
        )

        body = ReviewCreate(rating=5, comment="Test")
        with pytest.raises(NotFoundException):
            await review_service.create_review("nonexistent", body, "user_123", "Test User")


class TestGetReviews:
    @pytest.mark.asyncio
    async def test_returns_reviews_with_pagination(self, review_service, mock_db, mock_content_doc):
        _setup_content_exists(mock_db, mock_content_doc)
        sub = _setup_subcollection(mock_db)

        # 3 docs returned (limit=2, so 3 means has_more=True)
        docs = [_make_review_doc(f"r{i}", f"user_{i}", 5 - i) for i in range(3)]

        async def _stream():
            for d in docs:
                yield d

        mock_query = MagicMock()
        mock_query.limit.return_value.stream.return_value = _stream()
        sub.order_by.return_value = mock_query

        results, next_cursor = await review_service.get_reviews("content_001", limit=2)

        assert len(results) == 2
        assert next_cursor == "r1"  # last item of the truncated list
        assert results[0]["review_id"] == "r0"

    @pytest.mark.asyncio
    async def test_empty_reviews(self, review_service, mock_db, mock_content_doc):
        _setup_content_exists(mock_db, mock_content_doc)
        sub = _setup_subcollection(mock_db)

        async def _empty_stream():
            return
            yield

        mock_query = MagicMock()
        mock_query.limit.return_value.stream.return_value = _empty_stream()
        sub.order_by.return_value = mock_query

        results, next_cursor = await review_service.get_reviews("content_001")

        assert results == []
        assert next_cursor is None

    @pytest.mark.asyncio
    async def test_cursor_pagination(self, review_service, mock_db, mock_content_doc):
        _setup_content_exists(mock_db, mock_content_doc)
        sub = _setup_subcollection(mock_db)

        # Mock cursor document
        cursor_doc = MagicMock()
        cursor_doc.exists = True
        sub.document.return_value.get = AsyncMock(return_value=cursor_doc)

        doc = _make_review_doc("r10", "user_10", 3)

        async def _stream():
            yield doc

        mock_query = MagicMock()
        mock_query.start_after.return_value = mock_query
        mock_query.limit.return_value.stream.return_value = _stream()
        sub.order_by.return_value = mock_query

        results, next_cursor = await review_service.get_reviews(
            "content_001", cursor="prev_cursor_id", limit=20
        )

        assert len(results) == 1
        assert next_cursor is None
        mock_query.start_after.assert_called_once_with(cursor_doc)


class TestUpdateReview:
    @pytest.mark.asyncio
    async def test_author_can_update(self, review_service, mock_db, mock_review_doc):
        sub = _setup_subcollection(mock_db)
        sub.document.return_value.get = AsyncMock(return_value=mock_review_doc)
        sub.document.return_value.update = AsyncMock()

        # Mock recalculate
        async def _reviews_stream():
            yield _make_review_doc("review_001", "user_123", 5)

        sub.stream.return_value = _reviews_stream()
        mock_db.collection.return_value.document.return_value.update = AsyncMock()

        body = ReviewUpdate(rating=5, comment="Updated!")
        result = await review_service.update_review("content_001", "review_001", body, "user_123")

        assert result["rating"] == 5
        assert result["comment"] == "Updated!"
        assert result["review_id"] == "review_001"
        sub.document.return_value.update.assert_called_once()

    @pytest.mark.asyncio
    async def test_non_author_cannot_update(self, review_service, mock_db, mock_review_doc):
        sub = _setup_subcollection(mock_db)
        sub.document.return_value.get = AsyncMock(return_value=mock_review_doc)

        body = ReviewUpdate(rating=1)
        with pytest.raises(ForbiddenException):
            await review_service.update_review("content_001", "review_001", body, "other_user")

    @pytest.mark.asyncio
    async def test_rating_change_recalculates_average(self, review_service, mock_db, mock_review_doc):
        sub = _setup_subcollection(mock_db)
        sub.document.return_value.get = AsyncMock(return_value=mock_review_doc)
        sub.document.return_value.update = AsyncMock()

        r1 = _make_review_doc("review_001", "user_123", 5)
        r2 = _make_review_doc("review_002", "user_456", 3)

        async def _reviews_stream():
            yield r1
            yield r2

        sub.stream.return_value = _reviews_stream()
        mock_content_update = AsyncMock()
        mock_db.collection.return_value.document.return_value.update = mock_content_update

        body = ReviewUpdate(rating=5)
        await review_service.update_review("content_001", "review_001", body, "user_123")

        mock_content_update.assert_called_with({
            "stats.average_rating": 4.0,
            "stats.review_count": 2,
        })


class TestDeleteReview:
    @pytest.mark.asyncio
    async def test_author_can_delete(self, review_service, mock_db, mock_review_doc):
        sub = _setup_subcollection(mock_db)
        sub.document.return_value.get = AsyncMock(return_value=mock_review_doc)
        sub.document.return_value.delete = AsyncMock()

        # Mock recalculate with empty reviews after delete
        async def _empty_stream():
            return
            yield

        sub.stream.return_value = _empty_stream()
        mock_db.collection.return_value.document.return_value.update = AsyncMock()

        await review_service.delete_review("content_001", "review_001", "user_123")

        sub.document.return_value.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_admin_can_delete(self, review_service, mock_db, mock_review_doc):
        sub = _setup_subcollection(mock_db)
        sub.document.return_value.get = AsyncMock(return_value=mock_review_doc)
        sub.document.return_value.delete = AsyncMock()

        async def _empty_stream():
            return
            yield

        sub.stream.return_value = _empty_stream()
        mock_db.collection.return_value.document.return_value.update = AsyncMock()

        # Admin (different user_id) with is_admin=True
        await review_service.delete_review("content_001", "review_001", "admin_789", is_admin=True)

        sub.document.return_value.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_non_author_cannot_delete(self, review_service, mock_db, mock_review_doc):
        sub = _setup_subcollection(mock_db)
        sub.document.return_value.get = AsyncMock(return_value=mock_review_doc)

        with pytest.raises(ForbiddenException):
            await review_service.delete_review("content_001", "review_001", "other_user")

    @pytest.mark.asyncio
    async def test_recalculates_after_delete(self, review_service, mock_db, mock_review_doc):
        sub = _setup_subcollection(mock_db)
        sub.document.return_value.get = AsyncMock(return_value=mock_review_doc)
        sub.document.return_value.delete = AsyncMock()

        # One review remains after deletion
        remaining = _make_review_doc("review_002", "user_456", 2)

        async def _reviews_stream():
            yield remaining

        sub.stream.return_value = _reviews_stream()
        mock_content_update = AsyncMock()
        mock_db.collection.return_value.document.return_value.update = mock_content_update

        await review_service.delete_review("content_001", "review_001", "user_123")

        mock_content_update.assert_called_with({
            "stats.average_rating": 2.0,
            "stats.review_count": 1,
        })


class TestRecalculateRating:
    @pytest.mark.asyncio
    async def test_correct_average_calculation(self, review_service, mock_db):
        sub = _setup_subcollection(mock_db)

        r1 = _make_review_doc("r1", "u1", 5)
        r2 = _make_review_doc("r2", "u2", 3)
        r3 = _make_review_doc("r3", "u3", 4)

        async def _reviews_stream():
            yield r1
            yield r2
            yield r3

        sub.stream.return_value = _reviews_stream()
        mock_content_update = AsyncMock()
        mock_db.collection.return_value.document.return_value.update = mock_content_update

        await review_service._recalculate_rating("content_001")

        mock_content_update.assert_called_with({
            "stats.average_rating": 4.0,
            "stats.review_count": 3,
        })

    @pytest.mark.asyncio
    async def test_zero_reviews_resets_to_zero(self, review_service, mock_db):
        sub = _setup_subcollection(mock_db)

        async def _empty_stream():
            return
            yield

        sub.stream.return_value = _empty_stream()
        mock_content_update = AsyncMock()
        mock_db.collection.return_value.document.return_value.update = mock_content_update

        await review_service._recalculate_rating("content_001")

        mock_content_update.assert_called_with({
            "stats.average_rating": 0.0,
            "stats.review_count": 0,
        })
