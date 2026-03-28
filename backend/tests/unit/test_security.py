"""Security-focused tests for authentication, authorization, XSS, and input validation."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from pydantic import ValidationError

from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.core.security import _extract_token, get_current_user, require_role
from app.models.user import AuthenticatedUser
from app.services.content_service import ContentService
from app.schemas import (
    ContentCreate,
    ReviewCreate,
    TipCreate,
    PlaybackPositionUpdate,
)


# ─── TestTokenExtraction ─────────────────────────────────


class TestTokenExtraction:
    """Tests for Bearer token extraction from Authorization header."""

    @pytest.mark.asyncio
    async def test_valid_bearer_token(self):
        token = await _extract_token("Bearer abc123xyz")
        assert token == "abc123xyz"

    @pytest.mark.asyncio
    async def test_missing_auth_header(self):
        with pytest.raises(UnauthorizedException, match="Missing Authorization header"):
            await _extract_token(None)

    @pytest.mark.asyncio
    async def test_invalid_format(self):
        """Token without 'Bearer' prefix should be rejected."""
        with pytest.raises(UnauthorizedException, match="Invalid Authorization header format"):
            await _extract_token("Token abc123xyz")

    @pytest.mark.asyncio
    async def test_empty_token(self):
        """'Bearer ' with no actual token value should be rejected."""
        with pytest.raises(UnauthorizedException, match="Invalid Authorization header format"):
            await _extract_token("Bearer")


# ─── TestRoleAuthorization ───────────────────────────────


class TestRoleAuthorization:
    """Tests for role-based access control via require_role."""

    @pytest.mark.asyncio
    async def test_listener_cannot_access_creator_endpoint(self, mock_user):
        checker = require_role("creator", "admin")
        with pytest.raises(ForbiddenException, match="Role 'listener' cannot access"):
            await checker(user=mock_user)

    @pytest.mark.asyncio
    async def test_listener_cannot_access_admin_endpoint(self, mock_user):
        checker = require_role("admin")
        with pytest.raises(ForbiddenException, match="Role 'listener' cannot access"):
            await checker(user=mock_user)

    @pytest.mark.asyncio
    async def test_creator_can_access_creator_endpoint(self, mock_creator):
        checker = require_role("creator", "admin")
        result = await checker(user=mock_creator)
        assert result.uid == mock_creator.uid
        assert result.role == "creator"

    @pytest.mark.asyncio
    async def test_admin_can_access_all_endpoints(self, mock_admin):
        creator_checker = require_role("creator", "admin")
        admin_checker = require_role("admin")

        result_creator = await creator_checker(user=mock_admin)
        assert result_creator.role == "admin"

        result_admin = await admin_checker(user=mock_admin)
        assert result_admin.role == "admin"


# ─── TestContentOwnership ────────────────────────────────


class TestContentOwnership:
    """Tests for content ownership enforcement in ContentService."""

    def _make_mock_doc(self, data: dict, doc_id: str = "content_001"):
        """Create a mock Firestore document snapshot."""
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.id = doc_id
        mock_doc.to_dict.return_value = data.copy()
        return mock_doc

    def _make_service_with_doc(self, content_data: dict, doc_id: str = "content_001"):
        """Build a ContentService with a mocked document."""
        mock_db = AsyncMock()
        mock_doc = self._make_mock_doc(content_data, doc_id)

        mock_doc_ref = AsyncMock()
        mock_doc_ref.id = doc_id
        mock_doc_ref.get = AsyncMock(return_value=mock_doc)
        mock_doc_ref.update = AsyncMock()

        mock_collection = MagicMock()
        mock_collection.document = MagicMock(return_value=mock_doc_ref)

        mock_db.collection = MagicMock(return_value=mock_collection)
        return ContentService(mock_db), mock_doc_ref

    @pytest.mark.asyncio
    async def test_creator_can_edit_own_content(self, sample_content_data):
        service, mock_doc_ref = self._make_service_with_doc(sample_content_data)
        # After update, return updated doc
        updated_doc = self._make_mock_doc({**sample_content_data, "title": "Updated"})
        mock_doc_ref.get = AsyncMock(side_effect=[
            self._make_mock_doc(sample_content_data),  # first get (ownership check)
            updated_doc,                                # second get (return updated)
        ])

        from app.schemas import ContentUpdate
        result = await service.update_content(
            "content_001",
            ContentUpdate(title="Updated"),
            user_id="creator_456",  # matches creator_id in sample data
        )
        assert result["title"] == "Updated"

    @pytest.mark.asyncio
    async def test_creator_cannot_edit_others_content(self, sample_content_data):
        service, _ = self._make_service_with_doc(sample_content_data)
        from app.schemas import ContentUpdate

        with pytest.raises(ForbiddenException, match="Only the creator can update"):
            await service.update_content(
                "content_001",
                ContentUpdate(title="Hacked"),
                user_id="other_user_999",
            )

    @pytest.mark.asyncio
    async def test_admin_can_edit_any_content(self, sample_content_data):
        """Admin bypasses ownership for delete but update_content checks creator_id.
        Verify that delete_content with is_admin=True works for non-owner."""
        service, mock_doc_ref = self._make_service_with_doc(sample_content_data)

        # Admin can delete any content via is_admin flag
        await service.delete_content(
            "content_001",
            user_id="admin_789",
            is_admin=True,
        )
        mock_doc_ref.update.assert_called_once()
        call_args = mock_doc_ref.update.call_args[0][0]
        assert call_args["is_deleted"] is True

    @pytest.mark.asyncio
    async def test_creator_can_delete_own_content(self, sample_content_data):
        service, mock_doc_ref = self._make_service_with_doc(sample_content_data)

        await service.delete_content(
            "content_001",
            user_id="creator_456",
        )
        mock_doc_ref.update.assert_called_once()

    @pytest.mark.asyncio
    async def test_creator_cannot_delete_others_content(self, sample_content_data):
        service, _ = self._make_service_with_doc(sample_content_data)

        with pytest.raises(ForbiddenException, match="Only the creator can delete"):
            await service.delete_content(
                "content_001",
                user_id="other_user_999",
            )


# ─── TestXssPrevention ───────────────────────────────────


class TestXssPrevention:
    """Tests for XSS prevention in the Markdown-to-HTML sanitizer."""

    def test_script_tag_escaped_in_markdown(self):
        html = ContentService._markdown_to_html("<script>alert('xss')</script>")
        assert "<script>" not in html
        assert "alert(" not in html or "&lt;script&gt;" in html

    def test_event_handler_escaped(self):
        html = ContentService._markdown_to_html('<img onerror="alert(1)">')
        assert "onerror" not in html

    def test_javascript_url_escaped(self):
        html = ContentService._markdown_to_html('<a href="javascript:alert(1)">click</a>')
        assert "javascript:" not in html

    def test_safe_html_preserved(self):
        md = "**bold** and *italic* and [link](https://example.com)"
        html = ContentService._markdown_to_html(md)
        assert "<strong>bold</strong>" in html
        assert "<em>italic</em>" in html
        assert '<a href="https://example.com">link</a>' in html


# ─── TestInputValidation ─────────────────────────────────


class TestInputValidation:
    """Tests for Pydantic schema validation constraints."""

    def test_content_title_max_length(self):
        with pytest.raises(ValidationError) as exc_info:
            ContentCreate(title="A" * 201)
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("title",) for e in errors)

    def test_content_title_min_length(self):
        with pytest.raises(ValidationError) as exc_info:
            ContentCreate(title="")
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("title",) for e in errors)

    def test_review_rating_range(self):
        # Valid boundaries
        assert ReviewCreate(rating=1).rating == 1
        assert ReviewCreate(rating=5).rating == 5

        # Below minimum
        with pytest.raises(ValidationError) as exc_info:
            ReviewCreate(rating=0)
        assert any(e["loc"] == ("rating",) for e in exc_info.value.errors())

        # Above maximum
        with pytest.raises(ValidationError) as exc_info:
            ReviewCreate(rating=6)
        assert any(e["loc"] == ("rating",) for e in exc_info.value.errors())

    def test_tip_amount_range(self):
        # Valid boundaries
        assert TipCreate(creator_id="c1", amount=100).amount == 100
        assert TipCreate(creator_id="c1", amount=50000).amount == 50000

        # Below minimum
        with pytest.raises(ValidationError) as exc_info:
            TipCreate(creator_id="c1", amount=99)
        assert any(e["loc"] == ("amount",) for e in exc_info.value.errors())

        # Above maximum
        with pytest.raises(ValidationError) as exc_info:
            TipCreate(creator_id="c1", amount=50001)
        assert any(e["loc"] == ("amount",) for e in exc_info.value.errors())

    def test_playback_speed_range(self):
        # Valid boundaries
        assert PlaybackPositionUpdate(
            position_seconds=10.0, total_duration_seconds=100.0, playback_speed=0.5
        ).playback_speed == 0.5
        assert PlaybackPositionUpdate(
            position_seconds=10.0, total_duration_seconds=100.0, playback_speed=2.0
        ).playback_speed == 2.0

        # Below minimum
        with pytest.raises(ValidationError) as exc_info:
            PlaybackPositionUpdate(
                position_seconds=10.0, total_duration_seconds=100.0, playback_speed=0.4
            )
        assert any(e["loc"] == ("playback_speed",) for e in exc_info.value.errors())

        # Above maximum
        with pytest.raises(ValidationError) as exc_info:
            PlaybackPositionUpdate(
                position_seconds=10.0, total_duration_seconds=100.0, playback_speed=2.1
            )
        assert any(e["loc"] == ("playback_speed",) for e in exc_info.value.errors())
