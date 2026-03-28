"""Unit tests for FavoritesService."""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timezone


@pytest.fixture
def mock_db():
    return MagicMock()


@pytest.fixture
def favorites_service(mock_db):
    from app.services.favorites_service import FavoritesService
    return FavoritesService(db=mock_db)


class TestAddFavorite:
    @pytest.mark.asyncio
    async def test_adds_favorite_successfully(self, favorites_service, mock_db):
        """Creates doc in users/{uid}/favorites/{contentId} subcollection."""
        # Mock content exists
        content_doc = MagicMock()
        content_doc.exists = True
        content_doc.to_dict.return_value = {
            "title": "テスト記事",
            "creator_id": "creator_456",
            "status": "published",
        }

        # Mock favorite doc does not exist yet
        fav_doc = MagicMock()
        fav_doc.exists = False

        def col_side_effect(name):
            mock_col = MagicMock()
            if name == "contents":
                mock_col.document.return_value.get = AsyncMock(return_value=content_doc)
            elif name == "users":
                user_ref = MagicMock()
                fav_col = MagicMock()
                fav_doc_ref = MagicMock()
                fav_doc_ref.get = AsyncMock(return_value=fav_doc)
                fav_doc_ref.set = AsyncMock()
                fav_col.document.return_value = fav_doc_ref
                user_ref.collection.return_value = fav_col
                mock_col.document.return_value = user_ref
            return mock_col

        mock_db.collection.side_effect = col_side_effect

        result = await favorites_service.add_favorite(
            user_id="user_1", content_id="content_1"
        )
        assert result["content_id"] == "content_1"

    @pytest.mark.asyncio
    async def test_content_not_found(self, favorites_service, mock_db):
        """Raises NotFoundException when content does not exist."""
        content_doc = MagicMock()
        content_doc.exists = False
        mock_db.collection.return_value.document.return_value.get = AsyncMock(
            return_value=content_doc
        )

        from app.core.exceptions import NotFoundException

        with pytest.raises(NotFoundException):
            await favorites_service.add_favorite(
                user_id="user_1", content_id="nonexistent"
            )

    @pytest.mark.asyncio
    async def test_already_favorited(self, favorites_service, mock_db):
        """Raises ConflictException when content is already favorited."""
        # Mock content exists
        content_doc = MagicMock()
        content_doc.exists = True
        content_doc.to_dict.return_value = {
            "title": "テスト記事",
            "creator_id": "creator_456",
            "status": "published",
        }

        # Mock favorite already exists
        fav_doc = MagicMock()
        fav_doc.exists = True
        fav_doc.to_dict.return_value = {
            "content_id": "content_1",
            "created_at": datetime.now(timezone.utc),
        }

        def col_side_effect(name):
            mock_col = MagicMock()
            if name == "contents":
                mock_col.document.return_value.get = AsyncMock(return_value=content_doc)
            elif name == "users":
                user_ref = MagicMock()
                fav_col = MagicMock()
                fav_doc_ref = MagicMock()
                fav_doc_ref.get = AsyncMock(return_value=fav_doc)
                fav_col.document.return_value = fav_doc_ref
                user_ref.collection.return_value = fav_col
                mock_col.document.return_value = user_ref
            return mock_col

        mock_db.collection.side_effect = col_side_effect

        from app.core.exceptions import ConflictException

        with pytest.raises(ConflictException):
            await favorites_service.add_favorite(
                user_id="user_1", content_id="content_1"
            )


class TestRemoveFavorite:
    @pytest.mark.asyncio
    async def test_removes_favorite_successfully(self, favorites_service, mock_db):
        """Deletes doc from users/{uid}/favorites/{contentId}."""
        fav_doc = MagicMock()
        fav_doc.exists = True

        user_ref = MagicMock()
        fav_col = MagicMock()
        fav_doc_ref = MagicMock()
        fav_doc_ref.get = AsyncMock(return_value=fav_doc)
        fav_doc_ref.delete = AsyncMock()
        fav_col.document.return_value = fav_doc_ref
        user_ref.collection.return_value = fav_col
        mock_db.collection.return_value.document.return_value = user_ref

        await favorites_service.remove_favorite(
            user_id="user_1", content_id="content_1"
        )
        fav_doc_ref.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_not_favorited(self, favorites_service, mock_db):
        """Raises NotFoundException when favorite does not exist."""
        fav_doc = MagicMock()
        fav_doc.exists = False

        user_ref = MagicMock()
        fav_col = MagicMock()
        fav_doc_ref = MagicMock()
        fav_doc_ref.get = AsyncMock(return_value=fav_doc)
        fav_col.document.return_value = fav_doc_ref
        user_ref.collection.return_value = fav_col
        mock_db.collection.return_value.document.return_value = user_ref

        from app.core.exceptions import NotFoundException

        with pytest.raises(NotFoundException):
            await favorites_service.remove_favorite(
                user_id="user_1", content_id="content_1"
            )


class TestGetFavorites:
    @pytest.mark.asyncio
    async def test_returns_favorites_list(self, favorites_service, mock_db):
        """Returns list of favorited content."""
        now = datetime.now(timezone.utc)
        fav_doc_1 = MagicMock()
        fav_doc_1.id = "content_1"
        fav_doc_1.to_dict.return_value = {
            "content_id": "content_1",
            "title": "記事1",
            "creator_id": "creator_456",
            "created_at": now,
        }
        fav_doc_2 = MagicMock()
        fav_doc_2.id = "content_2"
        fav_doc_2.to_dict.return_value = {
            "content_id": "content_2",
            "title": "記事2",
            "creator_id": "creator_789",
            "created_at": now,
        }

        mock_query = MagicMock()
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.get = AsyncMock(return_value=[fav_doc_1, fav_doc_2])

        user_ref = MagicMock()
        user_ref.collection.return_value = mock_query
        mock_db.collection.return_value.document.return_value = user_ref

        result = await favorites_service.get_favorites(user_id="user_1")
        assert len(result["items"]) == 2
        assert result["items"][0]["content_id"] == "content_1"
        assert result["items"][1]["content_id"] == "content_2"

    @pytest.mark.asyncio
    async def test_empty_favorites(self, favorites_service, mock_db):
        """Returns empty list when user has no favorites."""
        mock_query = MagicMock()
        mock_query.order_by.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.get = AsyncMock(return_value=[])

        user_ref = MagicMock()
        user_ref.collection.return_value = mock_query
        mock_db.collection.return_value.document.return_value = user_ref

        result = await favorites_service.get_favorites(user_id="user_1")
        assert len(result["items"]) == 0

    @pytest.mark.asyncio
    async def test_pagination_with_cursor(self, favorites_service, mock_db):
        """Returns paginated favorites when cursor is provided."""
        now = datetime.now(timezone.utc)
        fav_doc = MagicMock()
        fav_doc.id = "content_3"
        fav_doc.to_dict.return_value = {
            "content_id": "content_3",
            "title": "記事3",
            "creator_id": "creator_456",
            "created_at": now,
        }

        # Mock the cursor document lookup
        cursor_doc = MagicMock()
        cursor_doc.exists = True

        mock_query = MagicMock()
        mock_query.order_by.return_value = mock_query
        mock_query.start_after.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.get = AsyncMock(return_value=[fav_doc])
        # cursor document lookup goes through the same collection
        mock_query.document.return_value.get = AsyncMock(return_value=cursor_doc)

        user_ref = MagicMock()

        # collection() returns mock_query for favorites subcollection
        def collection_side_effect(name=None):
            if name == "favorites":
                return mock_query
            return MagicMock()

        user_ref.collection = collection_side_effect

        mock_db.collection.return_value.document.return_value = user_ref

        result = await favorites_service.get_favorites(
            user_id="user_1", cursor="content_2", limit=10
        )
        assert len(result["items"]) == 1
        assert result["items"][0]["content_id"] == "content_3"


class TestIsFavorite:
    @pytest.mark.asyncio
    async def test_returns_true_when_favorited(self, favorites_service, mock_db):
        """Returns True when content is in user's favorites."""
        fav_doc = MagicMock()
        fav_doc.exists = True

        user_ref = MagicMock()
        fav_col = MagicMock()
        fav_col.document.return_value.get = AsyncMock(return_value=fav_doc)
        user_ref.collection.return_value = fav_col
        mock_db.collection.return_value.document.return_value = user_ref

        result = await favorites_service.is_favorite(
            user_id="user_1", content_id="content_1"
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_returns_false_when_not_favorited(self, favorites_service, mock_db):
        """Returns False when content is not in user's favorites."""
        fav_doc = MagicMock()
        fav_doc.exists = False

        user_ref = MagicMock()
        fav_col = MagicMock()
        fav_col.document.return_value.get = AsyncMock(return_value=fav_doc)
        user_ref.collection.return_value = fav_col
        mock_db.collection.return_value.document.return_value = user_ref

        result = await favorites_service.is_favorite(
            user_id="user_1", content_id="content_1"
        )
        assert result is False
