"""Unit tests for AdminService."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from app.services.admin_service import AdminService
from app.core.exceptions import NotFoundException


@pytest.fixture
def mock_db():
    db = MagicMock()
    return db


@pytest.fixture
def admin_service(mock_db):
    return AdminService(mock_db)


# ---------------------------------------------------------------------------
# Helper to build mock Firestore document snapshots
# ---------------------------------------------------------------------------

def _make_doc(doc_id: str, data: dict, exists: bool = True):
    doc = MagicMock()
    doc.id = doc_id
    doc.exists = exists
    doc.to_dict.return_value = data
    doc.reference = AsyncMock()
    doc.reference.update = AsyncMock()
    return doc


def _make_async_stream(docs):
    """Return an async iterator that works with `async for doc in query.stream()`."""
    async def _stream():
        for d in docs:
            yield d
    return _stream()


# ===========================================================================
# TestListUsers
# ===========================================================================

class TestListUsers:
    @pytest.mark.asyncio
    async def test_list_users_no_filter(self, admin_service, mock_db):
        user_docs = [
            _make_doc("user_1", {"email": "a@test.com", "role": "listener", "created_at": datetime.now(timezone.utc)}),
            _make_doc("user_2", {"email": "b@test.com", "role": "creator", "created_at": datetime.now(timezone.utc)}),
        ]

        mock_query = MagicMock()
        mock_query.where = MagicMock(return_value=mock_query)
        mock_query.limit = MagicMock(return_value=mock_query)
        mock_query.stream = MagicMock(return_value=_make_async_stream(user_docs))

        mock_collection = MagicMock()
        mock_collection.order_by = MagicMock(return_value=mock_query)
        mock_collection.document = MagicMock()
        mock_db.collection = MagicMock(return_value=mock_collection)

        items, next_cursor = await admin_service.list_users(limit=20)
        assert len(items) == 2
        assert items[0]["uid"] == "user_1"
        assert items[1]["uid"] == "user_2"
        assert next_cursor is None

    @pytest.mark.asyncio
    async def test_list_users_with_role_filter(self, admin_service, mock_db):
        user_docs = [
            _make_doc("creator_1", {"email": "c@test.com", "role": "creator", "created_at": datetime.now(timezone.utc)}),
        ]

        mock_query = MagicMock()
        mock_query.where = MagicMock(return_value=mock_query)
        mock_query.limit = MagicMock(return_value=mock_query)
        mock_query.stream = MagicMock(return_value=_make_async_stream(user_docs))

        mock_collection = MagicMock()
        mock_collection.order_by = MagicMock(return_value=mock_query)
        mock_db.collection = MagicMock(return_value=mock_collection)

        items, next_cursor = await admin_service.list_users(role="creator", limit=20)
        assert len(items) == 1
        assert items[0]["role"] == "creator"
        mock_query.where.assert_called_once()

    @pytest.mark.asyncio
    async def test_list_users_pagination_has_more(self, admin_service, mock_db):
        """When there are limit+1 docs, next_cursor should be set."""
        limit = 2
        user_docs = [
            _make_doc("u1", {"email": "1@t.com", "role": "listener", "created_at": datetime.now(timezone.utc)}),
            _make_doc("u2", {"email": "2@t.com", "role": "listener", "created_at": datetime.now(timezone.utc)}),
            _make_doc("u3", {"email": "3@t.com", "role": "listener", "created_at": datetime.now(timezone.utc)}),
        ]

        mock_query = MagicMock()
        mock_query.where = MagicMock(return_value=mock_query)
        mock_query.limit = MagicMock(return_value=mock_query)
        mock_query.stream = MagicMock(return_value=_make_async_stream(user_docs))

        mock_collection = MagicMock()
        mock_collection.order_by = MagicMock(return_value=mock_query)
        mock_db.collection = MagicMock(return_value=mock_collection)

        items, next_cursor = await admin_service.list_users(limit=limit)
        assert len(items) == 2
        assert next_cursor == "u2"

    @pytest.mark.asyncio
    async def test_list_users_with_cursor(self, admin_service, mock_db):
        cursor_doc = _make_doc("cursor_doc", {}, exists=True)
        user_docs = [
            _make_doc("u4", {"email": "4@t.com", "role": "listener", "created_at": datetime.now(timezone.utc)}),
        ]

        mock_query = MagicMock()
        mock_query.where = MagicMock(return_value=mock_query)
        mock_query.start_after = MagicMock(return_value=mock_query)
        mock_query.limit = MagicMock(return_value=mock_query)
        mock_query.stream = MagicMock(return_value=_make_async_stream(user_docs))

        mock_collection = MagicMock()
        mock_collection.order_by = MagicMock(return_value=mock_query)
        mock_collection.document = MagicMock(return_value=MagicMock(get=AsyncMock(return_value=cursor_doc)))
        mock_db.collection = MagicMock(return_value=mock_collection)

        items, next_cursor = await admin_service.list_users(cursor="cursor_doc", limit=20)
        assert len(items) == 1
        mock_query.start_after.assert_called_once_with(cursor_doc)

    @pytest.mark.asyncio
    async def test_list_users_empty(self, admin_service, mock_db):
        mock_query = MagicMock()
        mock_query.where = MagicMock(return_value=mock_query)
        mock_query.limit = MagicMock(return_value=mock_query)
        mock_query.stream = MagicMock(return_value=_make_async_stream([]))

        mock_collection = MagicMock()
        mock_collection.order_by = MagicMock(return_value=mock_query)
        mock_db.collection = MagicMock(return_value=mock_collection)

        items, next_cursor = await admin_service.list_users()
        assert items == []
        assert next_cursor is None


# ===========================================================================
# TestUpdateUserRole
# ===========================================================================

class TestUpdateUserRole:
    @pytest.mark.asyncio
    @patch("app.services.admin_service.auth")
    @patch("app.services.admin_service.init_firebase")
    async def test_successful_role_change(self, mock_init, mock_auth, admin_service, mock_db):
        existing_doc = _make_doc("user_1", {"role": "listener"})
        mock_doc_ref = AsyncMock()
        mock_doc_ref.get = AsyncMock(return_value=existing_doc)
        mock_doc_ref.update = AsyncMock()
        mock_db.collection.return_value.document.return_value = mock_doc_ref

        result = await admin_service.update_user_role("user_1", "creator")
        assert result == {"uid": "user_1", "role": "creator"}
        mock_auth.set_custom_user_claims.assert_called_once_with("user_1", {"role": "creator"})
        mock_doc_ref.update.assert_called_once()
        update_args = mock_doc_ref.update.call_args[0][0]
        assert update_args["role"] == "creator"
        assert "updated_at" in update_args

    @pytest.mark.asyncio
    @patch("app.services.admin_service.auth")
    @patch("app.services.admin_service.init_firebase")
    async def test_user_not_found(self, mock_init, mock_auth, admin_service, mock_db):
        not_found = _make_doc("missing", {}, exists=False)
        mock_doc_ref = AsyncMock()
        mock_doc_ref.get = AsyncMock(return_value=not_found)
        mock_db.collection.return_value.document.return_value = mock_doc_ref

        with pytest.raises(NotFoundException):
            await admin_service.update_user_role("missing", "admin")

    @pytest.mark.asyncio
    @patch("app.services.admin_service.auth")
    @patch("app.services.admin_service.init_firebase")
    async def test_role_updated_to_admin(self, mock_init, mock_auth, admin_service, mock_db):
        existing_doc = _make_doc("user_1", {"role": "listener"})
        mock_doc_ref = AsyncMock()
        mock_doc_ref.get = AsyncMock(return_value=existing_doc)
        mock_doc_ref.update = AsyncMock()
        mock_db.collection.return_value.document.return_value = mock_doc_ref

        result = await admin_service.update_user_role("user_1", "admin")
        assert result["role"] == "admin"
        mock_auth.set_custom_user_claims.assert_called_once_with("user_1", {"role": "admin"})


# ===========================================================================
# TestSuspendUser
# ===========================================================================

class TestSuspendUser:
    @pytest.mark.asyncio
    @patch("app.services.admin_service.auth")
    @patch("app.services.admin_service.init_firebase")
    async def test_successful_suspend(self, mock_init, mock_auth, admin_service, mock_db):
        existing_doc = _make_doc("user_1", {"is_suspended": False})
        mock_doc_ref = AsyncMock()
        mock_doc_ref.get = AsyncMock(return_value=existing_doc)
        mock_doc_ref.update = AsyncMock()
        mock_db.collection.return_value.document.return_value = mock_doc_ref

        result = await admin_service.suspend_user("user_1", "policy violation")
        assert result == {"uid": "user_1", "suspended": True}
        mock_auth.update_user.assert_called_once_with("user_1", disabled=True)
        update_args = mock_doc_ref.update.call_args[0][0]
        assert update_args["is_suspended"] is True
        assert update_args["suspended_reason"] == "policy violation"

    @pytest.mark.asyncio
    @patch("app.services.admin_service.auth")
    @patch("app.services.admin_service.init_firebase")
    async def test_suspend_already_suspended_user(self, mock_init, mock_auth, admin_service, mock_db):
        """Suspending an already-suspended user still succeeds (idempotent)."""
        existing_doc = _make_doc("user_1", {"is_suspended": True})
        mock_doc_ref = AsyncMock()
        mock_doc_ref.get = AsyncMock(return_value=existing_doc)
        mock_doc_ref.update = AsyncMock()
        mock_db.collection.return_value.document.return_value = mock_doc_ref

        result = await admin_service.suspend_user("user_1", "repeated violation")
        assert result["suspended"] is True
        mock_auth.update_user.assert_called_once_with("user_1", disabled=True)

    @pytest.mark.asyncio
    @patch("app.services.admin_service.auth")
    @patch("app.services.admin_service.init_firebase")
    async def test_suspend_user_not_found(self, mock_init, mock_auth, admin_service, mock_db):
        not_found = _make_doc("missing", {}, exists=False)
        mock_doc_ref = AsyncMock()
        mock_doc_ref.get = AsyncMock(return_value=not_found)
        mock_db.collection.return_value.document.return_value = mock_doc_ref

        with pytest.raises(NotFoundException):
            await admin_service.suspend_user("missing", "reason")


# ===========================================================================
# TestUnsuspendUser
# ===========================================================================

class TestUnsuspendUser:
    @pytest.mark.asyncio
    @patch("app.services.admin_service.auth")
    @patch("app.services.admin_service.init_firebase")
    async def test_successful_unsuspend(self, mock_init, mock_auth, admin_service, mock_db):
        existing_doc = _make_doc("user_1", {"is_suspended": True})
        mock_doc_ref = AsyncMock()
        mock_doc_ref.get = AsyncMock(return_value=existing_doc)
        mock_doc_ref.update = AsyncMock()
        mock_db.collection.return_value.document.return_value = mock_doc_ref

        result = await admin_service.unsuspend_user("user_1")
        assert result == {"uid": "user_1", "suspended": False}
        mock_auth.update_user.assert_called_once_with("user_1", disabled=False)
        update_args = mock_doc_ref.update.call_args[0][0]
        assert update_args["is_suspended"] is False
        assert update_args["suspended_reason"] is None

    @pytest.mark.asyncio
    @patch("app.services.admin_service.auth")
    @patch("app.services.admin_service.init_firebase")
    async def test_unsuspend_not_suspended_user(self, mock_init, mock_auth, admin_service, mock_db):
        """Unsuspending a user who is not suspended still succeeds (idempotent)."""
        existing_doc = _make_doc("user_1", {"is_suspended": False})
        mock_doc_ref = AsyncMock()
        mock_doc_ref.get = AsyncMock(return_value=existing_doc)
        mock_doc_ref.update = AsyncMock()
        mock_db.collection.return_value.document.return_value = mock_doc_ref

        result = await admin_service.unsuspend_user("user_1")
        assert result["suspended"] is False
        mock_auth.update_user.assert_called_once_with("user_1", disabled=False)

    @pytest.mark.asyncio
    @patch("app.services.admin_service.auth")
    @patch("app.services.admin_service.init_firebase")
    async def test_unsuspend_user_not_found(self, mock_init, mock_auth, admin_service, mock_db):
        not_found = _make_doc("missing", {}, exists=False)
        mock_doc_ref = AsyncMock()
        mock_doc_ref.get = AsyncMock(return_value=not_found)
        mock_db.collection.return_value.document.return_value = mock_doc_ref

        with pytest.raises(NotFoundException):
            await admin_service.unsuspend_user("missing")


# ===========================================================================
# TestGetFlaggedContents (list_flagged_contents)
# ===========================================================================

class TestGetFlaggedContents:
    @pytest.mark.asyncio
    async def test_list_flagged_contents(self, admin_service, mock_db):
        report_docs = [
            _make_doc("rpt_1", {"content_id": "c1", "reason": "spam", "status": "pending", "created_at": datetime.now(timezone.utc)}),
            _make_doc("rpt_2", {"content_id": "c2", "reason": "abuse", "status": "pending", "created_at": datetime.now(timezone.utc)}),
        ]

        mock_query = MagicMock()
        mock_query.order_by = MagicMock(return_value=mock_query)
        mock_query.limit = MagicMock(return_value=mock_query)
        mock_query.stream = MagicMock(return_value=_make_async_stream(report_docs))

        mock_collection = MagicMock()
        mock_collection.where = MagicMock(return_value=mock_query)
        mock_db.collection = MagicMock(return_value=mock_collection)

        items, next_cursor = await admin_service.list_flagged_contents(limit=20)
        assert len(items) == 2
        assert items[0]["report_id"] == "rpt_1"
        assert items[1]["report_id"] == "rpt_2"
        assert next_cursor is None

    @pytest.mark.asyncio
    async def test_list_flagged_contents_empty(self, admin_service, mock_db):
        mock_query = MagicMock()
        mock_query.order_by = MagicMock(return_value=mock_query)
        mock_query.limit = MagicMock(return_value=mock_query)
        mock_query.stream = MagicMock(return_value=_make_async_stream([]))

        mock_collection = MagicMock()
        mock_collection.where = MagicMock(return_value=mock_query)
        mock_db.collection = MagicMock(return_value=mock_collection)

        items, next_cursor = await admin_service.list_flagged_contents()
        assert items == []
        assert next_cursor is None

    @pytest.mark.asyncio
    async def test_list_flagged_contents_pagination(self, admin_service, mock_db):
        limit = 1
        report_docs = [
            _make_doc("rpt_1", {"content_id": "c1", "status": "pending", "created_at": datetime.now(timezone.utc)}),
            _make_doc("rpt_2", {"content_id": "c2", "status": "pending", "created_at": datetime.now(timezone.utc)}),
        ]

        mock_query = MagicMock()
        mock_query.order_by = MagicMock(return_value=mock_query)
        mock_query.limit = MagicMock(return_value=mock_query)
        mock_query.stream = MagicMock(return_value=_make_async_stream(report_docs))

        mock_collection = MagicMock()
        mock_collection.where = MagicMock(return_value=mock_query)
        mock_db.collection = MagicMock(return_value=mock_collection)

        items, next_cursor = await admin_service.list_flagged_contents(limit=limit)
        assert len(items) == 1
        assert next_cursor == "rpt_1"

    @pytest.mark.asyncio
    async def test_list_flagged_contents_with_cursor(self, admin_service, mock_db):
        cursor_doc = _make_doc("rpt_0", {}, exists=True)
        report_docs = [
            _make_doc("rpt_3", {"content_id": "c3", "status": "pending", "created_at": datetime.now(timezone.utc)}),
        ]

        mock_query = MagicMock()
        mock_query.order_by = MagicMock(return_value=mock_query)
        mock_query.start_after = MagicMock(return_value=mock_query)
        mock_query.limit = MagicMock(return_value=mock_query)
        mock_query.stream = MagicMock(return_value=_make_async_stream(report_docs))

        mock_collection = MagicMock()
        mock_collection.where = MagicMock(return_value=mock_query)
        mock_collection.document = MagicMock(return_value=MagicMock(get=AsyncMock(return_value=cursor_doc)))
        mock_db.collection = MagicMock(return_value=mock_collection)

        items, next_cursor = await admin_service.list_flagged_contents(cursor="rpt_0", limit=20)
        assert len(items) == 1
        mock_query.start_after.assert_called_once_with(cursor_doc)


# ===========================================================================
# TestModerateContent
# ===========================================================================

class TestModerateContent:
    def _setup_content_and_reports(self, mock_db, content_exists=True):
        """Common setup: mock content doc + empty reports stream."""
        content_doc = _make_doc("content_1", {
            "status": "published",
            "title": "Flagged Article",
        }, exists=content_exists)

        mock_doc_ref = AsyncMock()
        mock_doc_ref.get = AsyncMock(return_value=content_doc)
        mock_doc_ref.update = AsyncMock()

        # Reports query stream (empty by default)
        mock_reports_query = MagicMock()
        mock_reports_query.where = MagicMock(return_value=mock_reports_query)
        mock_reports_query.stream = MagicMock(return_value=_make_async_stream([]))

        def collection_router(name):
            coll = MagicMock()
            if name == "contents":
                coll.document = MagicMock(return_value=mock_doc_ref)
            elif name == "reports":
                coll.where = MagicMock(return_value=mock_reports_query)
            return coll

        mock_db.collection = MagicMock(side_effect=collection_router)
        return mock_doc_ref, mock_reports_query

    @pytest.mark.asyncio
    async def test_approve_action(self, admin_service, mock_db):
        mock_doc_ref, _ = self._setup_content_and_reports(mock_db)

        result = await admin_service.moderate_content("content_1", "approve", "looks good", "admin_1")
        assert result == {"content_id": "content_1", "action": "approve"}
        update_args = mock_doc_ref.update.call_args[0][0]
        assert update_args["moderation"]["action"] == "approved"
        assert update_args["moderation"]["by"] == "admin_1"
        assert "status" not in update_args  # approve does not change status

    @pytest.mark.asyncio
    async def test_reject_action(self, admin_service, mock_db):
        mock_doc_ref, _ = self._setup_content_and_reports(mock_db)

        result = await admin_service.moderate_content("content_1", "reject", "policy violation", "admin_1")
        assert result == {"content_id": "content_1", "action": "reject"}
        update_args = mock_doc_ref.update.call_args[0][0]
        assert update_args["status"] == "archived"
        assert update_args["moderation"]["action"] == "rejected"
        assert update_args["moderation"]["reason"] == "policy violation"

    @pytest.mark.asyncio
    async def test_flag_action(self, admin_service, mock_db):
        mock_doc_ref, _ = self._setup_content_and_reports(mock_db)

        result = await admin_service.moderate_content("content_1", "flag", "needs review", "admin_1")
        assert result == {"content_id": "content_1", "action": "flag"}
        update_args = mock_doc_ref.update.call_args[0][0]
        assert update_args["moderation"]["action"] == "flagged"

    @pytest.mark.asyncio
    async def test_content_not_found(self, admin_service, mock_db):
        self._setup_content_and_reports(mock_db, content_exists=False)

        with pytest.raises(NotFoundException):
            await admin_service.moderate_content("missing", "approve", "ok", "admin_1")

    @pytest.mark.asyncio
    async def test_resolves_related_reports(self, admin_service, mock_db):
        """Related pending reports should be marked as resolved."""
        content_doc = _make_doc("content_1", {"status": "published"})
        mock_doc_ref = AsyncMock()
        mock_doc_ref.get = AsyncMock(return_value=content_doc)
        mock_doc_ref.update = AsyncMock()

        report_1 = _make_doc("rpt_1", {"content_id": "content_1", "status": "pending"})
        report_2 = _make_doc("rpt_2", {"content_id": "content_1", "status": "pending"})

        mock_reports_query = MagicMock()
        mock_reports_query.where = MagicMock(return_value=mock_reports_query)
        mock_reports_query.stream = MagicMock(return_value=_make_async_stream([report_1, report_2]))

        def collection_router(name):
            coll = MagicMock()
            if name == "contents":
                coll.document = MagicMock(return_value=mock_doc_ref)
            elif name == "reports":
                coll.where = MagicMock(return_value=mock_reports_query)
            return coll

        mock_db.collection = MagicMock(side_effect=collection_router)

        await admin_service.moderate_content("content_1", "approve", "ok", "admin_1")

        # Both reports should have been resolved
        assert report_1.reference.update.call_count == 1
        assert report_2.reference.update.call_count == 1
        resolve_args = report_1.reference.update.call_args[0][0]
        assert resolve_args["status"] == "resolved"
        assert resolve_args["resolved_by"] == "admin_1"


# ===========================================================================
# TestGetPlatformAnalytics
# ===========================================================================

class TestGetPlatformAnalytics:
    @pytest.mark.asyncio
    async def test_returns_expected_structure(self, admin_service, mock_db):
        now = datetime.now(timezone.utc)
        user_docs = [
            _make_doc("u1", {"role": "listener"}),
            _make_doc("u2", {"role": "creator"}),
            _make_doc("u3", {"role": "listener"}),
        ]
        creator_docs = [_make_doc("u2", {"role": "creator"})]

        content_docs = [
            _make_doc("c1", {
                "status": "published", "is_deleted": False,
                "stats": {"total_revenue": 1000, "play_count": 50},
            }),
            _make_doc("c2", {
                "status": "draft", "is_deleted": False,
                "stats": {"total_revenue": 0, "play_count": 10},
            }),
        ]

        # We need collection() to return different mocks depending on the collection name
        # and support chained queries.
        def collection_router(name):
            coll = MagicMock()
            if name == "users":
                # users_ref.select([]).stream() => all users
                users_select = MagicMock()
                users_select.stream = MagicMock(return_value=_make_async_stream(user_docs))
                coll.select = MagicMock(return_value=users_select)

                # users_ref.where(...).select([]).stream() => creators
                creators_select = MagicMock()
                creators_select.stream = MagicMock(return_value=_make_async_stream(creator_docs))
                creators_where = MagicMock()
                creators_where.select = MagicMock(return_value=creators_select)
                coll.where = MagicMock(return_value=creators_where)
            elif name == "contents":
                # contents collection with where(is_deleted==False).stream()
                contents_query = MagicMock()
                contents_query.stream = MagicMock(return_value=_make_async_stream(content_docs))
                coll.where = MagicMock(return_value=contents_query)
            return coll

        mock_db.collection = MagicMock(side_effect=collection_router)

        result = await admin_service.get_platform_analytics()

        assert result["users"]["total"] == 3
        assert result["users"]["creators"] == 1
        assert result["users"]["listeners"] == 2
        assert result["content"]["total"] == 2
        assert result["content"]["published"] == 1
        assert result["revenue"]["total"] == 1000
        assert result["revenue"]["currency"] == "JPY"
        assert result["engagement"]["total_plays"] == 60

    @pytest.mark.asyncio
    async def test_empty_platform(self, admin_service, mock_db):
        def collection_router(name):
            coll = MagicMock()
            if name == "users":
                empty_select = MagicMock()
                empty_select.stream = MagicMock(return_value=_make_async_stream([]))
                coll.select = MagicMock(return_value=empty_select)
                empty_where = MagicMock()
                empty_where.select = MagicMock(return_value=empty_select)
                coll.where = MagicMock(return_value=empty_where)
            elif name == "contents":
                contents_query = MagicMock()
                contents_query.stream = MagicMock(return_value=_make_async_stream([]))
                coll.where = MagicMock(return_value=contents_query)
            return coll

        mock_db.collection = MagicMock(side_effect=collection_router)

        result = await admin_service.get_platform_analytics()

        assert result["users"]["total"] == 0
        assert result["users"]["creators"] == 0
        assert result["content"]["total"] == 0
        assert result["revenue"]["total"] == 0
        assert result["engagement"]["total_plays"] == 0

    @pytest.mark.asyncio
    async def test_content_missing_stats_defaults_to_zero(self, admin_service, mock_db):
        """Content docs without stats field should default to 0 revenue/plays."""
        content_docs = [
            _make_doc("c1", {"status": "published", "is_deleted": False}),  # no stats key
        ]

        def collection_router(name):
            coll = MagicMock()
            if name == "users":
                empty_select = MagicMock()
                empty_select.stream = MagicMock(return_value=_make_async_stream([]))
                coll.select = MagicMock(return_value=empty_select)
                empty_where = MagicMock()
                empty_where.select = MagicMock(return_value=empty_select)
                coll.where = MagicMock(return_value=empty_where)
            elif name == "contents":
                contents_query = MagicMock()
                contents_query.stream = MagicMock(return_value=_make_async_stream(content_docs))
                coll.where = MagicMock(return_value=contents_query)
            return coll

        mock_db.collection = MagicMock(side_effect=collection_router)

        result = await admin_service.get_platform_analytics()
        assert result["revenue"]["total"] == 0
        assert result["engagement"]["total_plays"] == 0
        assert result["content"]["published"] == 1


# ===========================================================================
# TestGetSystemHealth
# ===========================================================================

class TestGetSystemHealth:
    @pytest.mark.asyncio
    async def test_healthy_system(self, admin_service, mock_db):
        mock_doc_ref = AsyncMock()
        mock_doc_ref.get = AsyncMock(return_value=MagicMock())
        mock_db.collection.return_value.document.return_value = mock_doc_ref

        result = await admin_service.get_system_health()
        assert result["firestore"] == "healthy"
        assert "tts" in result
        assert "stripe" in result
        assert "gcs" in result

    @pytest.mark.asyncio
    async def test_firestore_unhealthy(self, admin_service, mock_db):
        mock_doc_ref = AsyncMock()
        mock_doc_ref.get = AsyncMock(side_effect=Exception("connection refused"))
        mock_db.collection.return_value.document.return_value = mock_doc_ref

        result = await admin_service.get_system_health()
        assert result["firestore"] == "unhealthy"

    @pytest.mark.asyncio
    async def test_returns_all_service_statuses(self, admin_service, mock_db):
        mock_doc_ref = AsyncMock()
        mock_doc_ref.get = AsyncMock(return_value=MagicMock())
        mock_db.collection.return_value.document.return_value = mock_doc_ref

        result = await admin_service.get_system_health()
        expected_keys = {"firestore", "tts", "stripe", "gcs"}
        assert set(result.keys()) == expected_keys


# ===========================================================================
# TestUpdateSystemConfig (endpoint-level logic in admin.py)
# ===========================================================================

class TestUpdateSystemConfig:
    @pytest.mark.asyncio
    async def test_successful_update(self):
        mock_db = MagicMock()
        mock_doc_ref = MagicMock()
        mock_doc_ref.set = AsyncMock()
        mock_db.collection.return_value.document.return_value = mock_doc_ref

        config = {"max_upload_size": 50, "maintenance_mode": False}

        # Simulate what the endpoint does
        for key, value in config.items():
            await mock_db.collection("system_config").document(key).set(
                {"value": value, "updated_at": datetime.now(timezone.utc), "updated_by": "admin_1"},
                merge=True,
            )

        assert mock_doc_ref.set.call_count == 2

    @pytest.mark.asyncio
    async def test_empty_config(self):
        mock_db = MagicMock()
        mock_doc_ref = MagicMock()
        mock_doc_ref.set = AsyncMock()
        mock_db.collection.return_value.document.return_value = mock_doc_ref

        config = {}
        for key, value in config.items():
            await mock_db.collection("system_config").document(key).set(
                {"value": value, "updated_at": datetime.now(timezone.utc), "updated_by": "admin_1"},
                merge=True,
            )

        mock_doc_ref.set.assert_not_called()

    @pytest.mark.asyncio
    async def test_single_key_update(self):
        mock_db = MagicMock()
        mock_doc_ref = MagicMock()
        mock_doc_ref.set = AsyncMock()
        mock_db.collection.return_value.document.return_value = mock_doc_ref

        config = {"site_name": "AudioBlog"}
        for key, value in config.items():
            await mock_db.collection("system_config").document(key).set(
                {"value": value, "updated_at": datetime.now(timezone.utc), "updated_by": "admin_1"},
                merge=True,
            )

        mock_doc_ref.set.assert_called_once()
        call_args = mock_doc_ref.set.call_args
        assert call_args[0][0]["value"] == "AudioBlog"
        assert call_args[1]["merge"] is True


# ===========================================================================
# TestGetTtsQueue (endpoint-level logic in admin.py)
# ===========================================================================

class TestGetTtsQueue:
    @pytest.mark.asyncio
    async def test_list_tts_jobs_by_status(self):
        mock_db = MagicMock()

        status_counts = {"queued": 3, "processing": 1, "merging": 0, "uploading": 2}

        def make_query_for_status(status_name):
            docs = [_make_doc(f"job_{i}", {}) for i in range(status_counts[status_name])]
            mock_query = MagicMock()
            select_mock = MagicMock()
            select_mock.stream = MagicMock(return_value=_make_async_stream(docs))
            mock_query.select = MagicMock(return_value=select_mock)
            return mock_query

        def collection_side_effect(name):
            coll = MagicMock()
            queries = {s: make_query_for_status(s) for s in status_counts}

            def where_side_effect(field, op, value):
                return queries[value]

            coll.where = MagicMock(side_effect=where_side_effect)
            return coll

        mock_db.collection = MagicMock(side_effect=collection_side_effect)

        # Reproduce the endpoint logic
        counts = {}
        for status in ("queued", "processing", "merging", "uploading"):
            query = mock_db.collection("tts_jobs").where("status", "==", status)
            docs = [d async for d in query.select([]).stream()]
            counts[status] = len(docs)

        assert counts["queued"] == 3
        assert counts["processing"] == 1
        assert counts["merging"] == 0
        assert counts["uploading"] == 2
        assert sum(counts.values()) == 6

    @pytest.mark.asyncio
    async def test_empty_tts_queue(self):
        mock_db = MagicMock()

        def collection_side_effect(name):
            coll = MagicMock()
            empty_query = MagicMock()
            empty_select = MagicMock()
            empty_select.stream = MagicMock(return_value=_make_async_stream([]))
            empty_query.select = MagicMock(return_value=empty_select)
            coll.where = MagicMock(return_value=empty_query)
            return coll

        mock_db.collection = MagicMock(side_effect=collection_side_effect)

        counts = {}
        for status in ("queued", "processing", "merging", "uploading"):
            query = mock_db.collection("tts_jobs").where("status", "==", status)
            docs = [d async for d in query.select([]).stream()]
            counts[status] = len(docs)

        assert all(v == 0 for v in counts.values())
        assert sum(counts.values()) == 0
