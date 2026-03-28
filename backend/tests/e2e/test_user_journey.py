"""End-to-end user journey tests simulating complete workflows."""

import pytest
import os
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient


os.environ["ENVIRONMENT"] = "test"
os.environ["FIREBASE_PROJECT_ID"] = "test-project"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_fake"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test_fake"
os.environ["GCS_AUDIO_BUCKET"] = "test-audio"
os.environ["GCS_IMAGE_BUCKET"] = "test-images"

API = "/api/v1"


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_firebase_mock(role="listener", uid="test_user_123", email="test@example.com"):
    """Return a patched firebase auth mock that issues tokens for the given role."""
    mock_auth = MagicMock()
    mock_auth.verify_id_token.return_value = {
        "uid": uid,
        "email": email,
        "email_verified": True,
        "role": role,
        "name": f"Test {role.capitalize()}",
    }
    # Stubs for registration flow
    user_record = MagicMock()
    user_record.uid = uid
    mock_auth.create_user.return_value = user_record
    mock_auth.set_custom_user_claims = MagicMock()
    mock_auth.EmailAlreadyExistsError = type("EmailAlreadyExistsError", (Exception,), {})
    return mock_auth


def _make_firestore_doc(data, exists=True):
    """Create a mock Firestore document snapshot."""
    doc = MagicMock()
    doc.exists = exists
    doc.to_dict.return_value = data
    doc.id = data.get("content_id") or data.get("uid") or data.get("job_id") or "mock_doc_id"
    doc.reference = MagicMock()
    doc.reference.update = AsyncMock()
    return doc


def _build_client(firebase_auth_mock):
    """Build a TestClient with the given firebase auth mock."""
    with patch("app.core.security.init_firebase"), \
         patch("app.core.security.auth", firebase_auth_mock), \
         patch("app.main.init_firebase"), \
         patch("app.core.firebase.init_firebase"), \
         patch("app.core.firebase.get_async_firestore_client") as mock_db:
        mock_db.return_value = AsyncMock()
        from app.main import create_app
        app = create_app()
        return TestClient(app)


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def listener_auth():
    return _make_firebase_mock(role="listener", uid="listener_001", email="listener@example.com")


@pytest.fixture
def creator_auth():
    return _make_firebase_mock(role="creator", uid="creator_001", email="creator@example.com")


@pytest.fixture
def admin_auth():
    return _make_firebase_mock(role="admin", uid="admin_001", email="admin@example.com")


@pytest.fixture
def listener_client(listener_auth):
    return _build_client(listener_auth)


@pytest.fixture
def creator_client(creator_auth):
    return _build_client(creator_auth)


@pytest.fixture
def admin_client(admin_auth):
    return _build_client(admin_auth)


@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer e2e_test_token"}


@pytest.fixture
def sample_content():
    """A fully-formed content dict as returned by the content service."""
    return {
        "content_id": "content_e2e_001",
        "creator_id": "creator_001",
        "creator_display_name": "Test Creator",
        "title": "E2E Test Article",
        "slug": "e2e-test-article",
        "excerpt": "An article for E2E testing",
        "body_markdown": "# Chapter 1\n\nBody text.",
        "body_html": "<h1>Chapter 1</h1><p>Body text.</p>",
        "thumbnail_url": None,
        "audio": {
            "status": "ready",
            "audio_url": "gs://test-audio/content_e2e_001.mp3",
            "duration_seconds": 300.0,
            "file_size_bytes": 4800000,
            "format": "mp3",
            "tts_voice": "ja-JP-Neural2-B",
            "tts_job_id": "job_001",
            "generated_at": "2025-01-01T00:00:00Z",
        },
        "category_ids": ["business"],
        "tags": ["leadership"],
        "series_id": None,
        "series_order": None,
        "pricing": {"type": "free", "price_jpy": 0, "currency": "JPY"},
        "stats": {
            "view_count": 10,
            "play_count": 5,
            "completion_count": 2,
            "purchase_count": 0,
            "average_rating": 4.5,
            "review_count": 3,
            "total_revenue": 0,
        },
        "status": "published",
        "published_at": "2025-01-01T00:00:00Z",
        "scheduled_at": None,
        "seo": {"meta_title": None, "meta_description": None, "og_image_url": None},
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T00:00:00Z",
        "current_version": 1,
        "is_deleted": False,
    }


# ═════════════════════════════════════════════════════════════════════════════
# Listener Journey
# ═════════════════════════════════════════════════════════════════════════════

class TestListenerJourney:
    """Simulates a listener browsing, registering, purchasing, and playing content."""

    def test_browse_and_read_content(self, listener_client, auth_headers, sample_content):
        """Listener browses the catalogue then reads a specific article."""
        content_list = [sample_content]

        # Step 1: GET /contents  -- browse the catalogue
        with patch("app.services.get_content_service") as mock_svc:
            svc = MagicMock()
            svc.list_contents = AsyncMock(return_value=(content_list, None))
            mock_svc.return_value = svc

            resp = listener_client.get(f"{API}/contents")
            assert resp.status_code == 200
            data = resp.json()
            assert "data" in data
            assert "pagination" in data
            items = data["data"]
            assert len(items) == 1
            target_id = items[0]["content_id"]

        # Step 2: GET /contents/{id}  -- read the article
        with patch("app.api.v1.endpoints.contents.get_content_service") as mock_svc:
            svc = MagicMock()
            svc.get_content = AsyncMock(return_value=sample_content)
            mock_svc.return_value = svc

            resp = listener_client.get(f"{API}/contents/{target_id}")
            assert resp.status_code == 200
            article = resp.json()["data"]
            assert article["content_id"] == target_id
            assert article["title"] == "E2E Test Article"
            assert article["body_markdown"] is not None

    def test_register_and_browse(self, listener_client, auth_headers, sample_content):
        """New user registers, views profile, then browses content."""
        # Step 1: POST /auth/register
        with patch("app.api.v1.endpoints.auth.init_firebase"), \
             patch("app.api.v1.endpoints.auth.auth") as mock_fb_auth, \
             patch("app.api.v1.endpoints.auth.get_async_firestore_client") as mock_db:
            user_record = MagicMock()
            user_record.uid = "new_user_001"
            mock_fb_auth.create_user.return_value = user_record
            mock_fb_auth.set_custom_user_claims = MagicMock()
            mock_fb_auth.EmailAlreadyExistsError = type("EmailAlreadyExistsError", (Exception,), {})
            mock_db.return_value = AsyncMock()

            resp = listener_client.post(
                f"{API}/auth/register",
                params={"email": "new@example.com", "password": "Str0ngPa$$", "display_name": "New User"},
            )
            assert resp.status_code == 200
            reg_data = resp.json()["data"]
            assert reg_data["uid"] == "new_user_001"
            assert reg_data["role"] == "listener"

        # Step 2: GET /auth/me
        with patch("app.api.v1.endpoints.auth.get_async_firestore_client") as mock_db:
            doc = _make_firestore_doc({
                "uid": "listener_001",
                "email": "listener@example.com",
                "role": "listener",
                "display_name": "Listener",
            })
            mock_db.return_value.collection.return_value.document.return_value.get = AsyncMock(return_value=doc)

            resp = listener_client.get(f"{API}/auth/me", headers=auth_headers)
            assert resp.status_code == 200
            assert resp.json()["data"]["uid"] == "listener_001"

        # Step 3: GET /contents
        with patch("app.services.get_content_service") as mock_svc:
            svc = MagicMock()
            svc.list_contents = AsyncMock(return_value=([sample_content], None))
            mock_svc.return_value = svc

            resp = listener_client.get(f"{API}/contents", headers=auth_headers)
            assert resp.status_code == 200
            assert len(resp.json()["data"]) == 1

    def test_purchase_flow(self, listener_client, auth_headers, sample_content):
        """Listener browses, creates a payment intent, and verifies purchase status."""
        # Step 1: Browse content
        with patch("app.services.get_content_service") as mock_svc:
            svc = MagicMock()
            svc.list_contents = AsyncMock(return_value=([sample_content], None))
            mock_svc.return_value = svc

            resp = listener_client.get(f"{API}/contents", headers=auth_headers)
            assert resp.status_code == 200
            target_id = resp.json()["data"][0]["content_id"]

        # Step 2: POST /payment/create-intent
        with patch("app.api.v1.endpoints.payment.get_payment_service") as mock_svc:
            svc = MagicMock()
            svc.create_payment_intent = AsyncMock(return_value={
                "client_secret": "pi_secret_e2e",
                "payment_intent_id": "pi_e2e_001",
                "amount": 500,
                "currency": "jpy",
            })
            mock_svc.return_value = svc

            resp = listener_client.post(
                f"{API}/payment/create-intent",
                json={"content_id": target_id},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            pi_data = resp.json()["data"]
            assert pi_data["client_secret"] == "pi_secret_e2e"
            assert pi_data["amount"] == 500

        # Step 3: Verify purchase check (simulating post-payment webhook completion)
        with patch("app.api.v1.endpoints.payment.get_payment_service") as mock_svc:
            svc = MagicMock()
            svc.check_purchase = AsyncMock(return_value=True)
            mock_svc.return_value = svc

            resp = listener_client.get(
                f"{API}/payment/purchases/{target_id}/check",
                headers=auth_headers,
            )
            assert resp.status_code == 200
            assert resp.json()["data"]["purchased"] is True

    def test_playback_flow(self, listener_client, auth_headers, sample_content):
        """Listener gets a stream URL, saves position, then resumes."""
        content_id = sample_content["content_id"]

        # Step 1: GET /stream/{id}/url
        with patch("app.api.v1.endpoints.stream.get_stream_service") as mock_svc:
            svc = MagicMock()
            svc.get_stream_url = AsyncMock(return_value={
                "url": "https://storage.googleapis.com/signed-url",
                "expires_at": "2025-12-31T23:59:59Z",
                "content_id": content_id,
            })
            mock_svc.return_value = svc

            resp = listener_client.get(f"{API}/stream/{content_id}/url", headers=auth_headers)
            assert resp.status_code == 200
            assert "url" in resp.json()["data"]

        # Step 2: PUT /stream/{id}/position  -- save position at 120s
        with patch("app.api.v1.endpoints.stream.get_stream_service") as mock_svc:
            svc = MagicMock()
            svc.save_playback_position = AsyncMock(return_value={
                "content_id": content_id,
                "position_seconds": 120.0,
                "total_duration_seconds": 300.0,
            })
            mock_svc.return_value = svc

            resp = listener_client.put(
                f"{API}/stream/{content_id}/position",
                json={
                    "position_seconds": 120.0,
                    "total_duration_seconds": 300.0,
                    "playback_speed": 1.0,
                    "device_id": "browser_e2e",
                },
                headers=auth_headers,
            )
            assert resp.status_code == 200

        # Step 3: GET /stream/{id}/position  -- resume later
        with patch("app.api.v1.endpoints.stream.get_stream_service") as mock_svc:
            svc = MagicMock()
            svc.get_playback_position = AsyncMock(return_value={
                "content_id": content_id,
                "position_seconds": 120.0,
                "total_duration_seconds": 300.0,
                "playback_speed": 1.0,
            })
            mock_svc.return_value = svc

            resp = listener_client.get(f"{API}/stream/{content_id}/position", headers=auth_headers)
            assert resp.status_code == 200
            pos = resp.json()["data"]
            assert pos["position_seconds"] == 120.0
            assert pos["content_id"] == content_id


# ═════════════════════════════════════════════════════════════════════════════
# Creator Journey
# ═════════════════════════════════════════════════════════════════════════════

class TestCreatorJourney:
    """Simulates a creator authoring, publishing, converting to audio, and viewing stats."""

    def test_create_and_publish(self, creator_client, auth_headers, sample_content):
        """Creator creates a draft, updates it, publishes, and confirms it appears publicly."""
        # Step 1: POST /contents  -- create draft
        with patch("app.api.v1.endpoints.contents.get_content_service") as mock_svc:
            svc = MagicMock()
            svc.create_content = AsyncMock(return_value={
                "content_id": "new_content_001",
                "title": "Draft Article",
                "creator_id": "creator_001",
                "status": "draft",
            })
            mock_svc.return_value = svc

            resp = creator_client.post(
                f"{API}/contents",
                json={"title": "Draft Article", "body_markdown": "# Draft\n\nInitial body."},
                headers=auth_headers,
            )
            assert resp.status_code == 201
            new_id = resp.json()["data"]["content_id"]
            assert new_id == "new_content_001"

        # Step 2: PUT /contents/{id}  -- edit
        with patch("app.api.v1.endpoints.contents.get_content_service") as mock_svc:
            svc = MagicMock()
            svc.update_content = AsyncMock(return_value={
                "content_id": new_id,
                "title": "Updated Article",
                "status": "draft",
            })
            mock_svc.return_value = svc

            resp = creator_client.put(
                f"{API}/contents/{new_id}",
                json={"title": "Updated Article", "body_markdown": "# Updated\n\nRevised body."},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            assert resp.json()["data"]["title"] == "Updated Article"

        # Step 3: POST /contents/{id}/publish
        with patch("app.api.v1.endpoints.contents.get_content_service") as mock_svc:
            svc = MagicMock()
            svc.publish_content = AsyncMock(return_value={
                "content_id": new_id,
                "title": "Updated Article",
                "status": "published",
            })
            mock_svc.return_value = svc

            resp = creator_client.post(f"{API}/contents/{new_id}/publish", headers=auth_headers)
            assert resp.status_code == 200
            assert resp.json()["data"]["status"] == "published"

        # Step 4: GET /contents  -- verify it is now visible
        published = dict(sample_content, content_id=new_id, title="Updated Article", status="published")
        with patch("app.services.get_content_service") as mock_svc:
            svc = MagicMock()
            svc.list_contents = AsyncMock(return_value=([published], None))
            mock_svc.return_value = svc

            resp = creator_client.get(f"{API}/contents")
            assert resp.status_code == 200
            titles = [c["title"] for c in resp.json()["data"]]
            assert "Updated Article" in titles

    def test_content_to_audio(self, creator_client, auth_headers, sample_content):
        """Creator converts content to audio and checks job status."""
        content_id = sample_content["content_id"]

        # Step 1: POST /tts/convert
        with patch("app.api.v1.endpoints.tts.get_async_firestore_client") as mock_db:
            db_inst = AsyncMock()
            # content doc lookup
            content_doc = _make_firestore_doc({"creator_id": "creator_001", "content_id": content_id})
            db_inst.collection.return_value.document.return_value.get = AsyncMock(return_value=content_doc)
            # job doc creation
            job_ref = MagicMock()
            job_ref.id = "job_e2e_001"
            job_ref.set = AsyncMock()
            db_inst.collection.return_value.document.return_value = job_ref
            # re-wire .get for content lookup only on first call
            call_count = {"n": 0}
            original_doc = db_inst.collection.return_value.document

            def _doc_side_effect(doc_id=None):
                call_count["n"] += 1
                if call_count["n"] == 1:
                    # First call: content lookup
                    m = MagicMock()
                    m.get = AsyncMock(return_value=content_doc)
                    return m
                # Subsequent calls: job ref
                return job_ref

            db_inst.collection.return_value.document = MagicMock(side_effect=_doc_side_effect)
            mock_db.return_value = db_inst

            resp = creator_client.post(
                f"{API}/tts/convert",
                json={"content_id": content_id},
                headers=auth_headers,
            )
            assert resp.status_code == 202
            job_data = resp.json()["data"]
            assert job_data["status"] == "queued"
            assert job_data["content_id"] == content_id
            job_id = job_data["job_id"]

        # Step 2: GET /tts/jobs/{id}  -- check progress
        with patch("app.api.v1.endpoints.tts.get_async_firestore_client") as mock_db:
            db_inst = AsyncMock()
            job_doc = _make_firestore_doc({
                "job_id": job_id,
                "content_id": content_id,
                "creator_id": "creator_001",
                "status": "processing",
                "progress": {
                    "total_chunks": 10,
                    "completed_chunks": 5,
                    "current_step": "synthesizing",
                    "percent_complete": 50,
                },
            })
            db_inst.collection.return_value.document.return_value.get = AsyncMock(return_value=job_doc)
            mock_db.return_value = db_inst

            resp = creator_client.get(f"{API}/tts/jobs/{job_id}", headers=auth_headers)
            assert resp.status_code == 200
            job_status = resp.json()["data"]
            assert job_status["status"] == "processing"
            assert job_status["progress"]["percent_complete"] == 50

    def test_dashboard_flow(self, creator_client, auth_headers, sample_content):
        """Creator publishes content then views dashboard stats."""
        # Step 1: Create + publish (abbreviated)
        with patch("app.api.v1.endpoints.contents.get_content_service") as mock_svc:
            svc = MagicMock()
            svc.create_content = AsyncMock(return_value={
                "content_id": "dash_content_001",
                "title": "Dashboard Test",
                "creator_id": "creator_001",
                "status": "draft",
            })
            mock_svc.return_value = svc

            resp = creator_client.post(
                f"{API}/contents",
                json={"title": "Dashboard Test", "body_markdown": "# Test"},
                headers=auth_headers,
            )
            assert resp.status_code == 201

        with patch("app.api.v1.endpoints.contents.get_content_service") as mock_svc:
            svc = MagicMock()
            svc.publish_content = AsyncMock(return_value={
                "content_id": "dash_content_001",
                "status": "published",
            })
            mock_svc.return_value = svc

            resp = creator_client.post(f"{API}/contents/dash_content_001/publish", headers=auth_headers)
            assert resp.status_code == 200

        # Step 2: GET /creator/dashboard
        with patch("app.api.v1.endpoints.creator.get_creator_service") as mock_svc:
            svc = MagicMock()
            svc.get_dashboard_summary = AsyncMock(return_value={
                "total_earnings": 15000,
                "pending_earnings": 3000,
                "total_content": 5,
                "total_plays": 120,
                "total_purchases": 8,
                "recent_earnings": [{"date": "2025-01-15", "amount": 2000}],
                "top_content": [{"content_id": "dash_content_001", "title": "Dashboard Test", "plays": 25}],
            })
            mock_svc.return_value = svc

            resp = creator_client.get(f"{API}/creator/dashboard", headers=auth_headers)
            assert resp.status_code == 200
            dash = resp.json()["data"]
            assert dash["total_content"] == 5
            assert dash["total_earnings"] == 15000
            assert len(dash["top_content"]) >= 1


# ═════════════════════════════════════════════════════════════════════════════
# Admin Journey
# ═════════════════════════════════════════════════════════════════════════════

class TestAdminJourney:
    """Simulates admin user-management, moderation, and system-health workflows."""

    def test_user_management(self, admin_client, auth_headers):
        """Admin lists users, changes a role, and suspends a user."""
        target_user_id = "user_to_manage"

        # Step 1: GET /admin/users
        with patch("app.api.v1.endpoints.admin.get_admin_service") as mock_svc:
            svc = MagicMock()
            svc.list_users = AsyncMock(return_value=(
                [
                    {"uid": target_user_id, "email": "managed@example.com", "role": "listener", "is_suspended": False},
                    {"uid": "user_other", "email": "other@example.com", "role": "creator", "is_suspended": False},
                ],
                None,
            ))
            mock_svc.return_value = svc

            resp = admin_client.get(f"{API}/admin/users", headers=auth_headers)
            assert resp.status_code == 200
            users = resp.json()["data"]
            assert len(users) == 2
            assert any(u["uid"] == target_user_id for u in users)

        # Step 2: PUT /admin/users/{id}/role
        with patch("app.api.v1.endpoints.admin.get_admin_service") as mock_svc:
            svc = MagicMock()
            svc.update_user_role = AsyncMock(return_value={
                "uid": target_user_id,
                "role": "creator",
                "updated": True,
            })
            mock_svc.return_value = svc

            resp = admin_client.put(
                f"{API}/admin/users/{target_user_id}/role",
                json={"role": "creator"},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            assert resp.json()["data"]["role"] == "creator"

        # Step 3: POST /admin/users/{id}/suspend
        with patch("app.api.v1.endpoints.admin.get_admin_service") as mock_svc:
            svc = MagicMock()
            svc.suspend_user = AsyncMock(return_value={
                "uid": target_user_id,
                "is_suspended": True,
                "suspended_reason": "Policy violation",
            })
            mock_svc.return_value = svc

            resp = admin_client.post(
                f"{API}/admin/users/{target_user_id}/suspend",
                json={"reason": "Policy violation"},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            assert resp.json()["data"]["is_suspended"] is True
            assert resp.json()["data"]["suspended_reason"] == "Policy violation"

    def test_content_moderation(self, admin_client, auth_headers):
        """Admin reviews flagged content and takes moderation action."""
        # Step 1: GET /admin/contents/flagged
        with patch("app.api.v1.endpoints.admin.get_admin_service") as mock_svc:
            svc = MagicMock()
            svc.list_flagged_contents = AsyncMock(return_value=(
                [
                    {"content_id": "flagged_001", "title": "Suspicious Article", "flag_reason": "spam", "creator_id": "c1"},
                    {"content_id": "flagged_002", "title": "Reported Post", "flag_reason": "inappropriate", "creator_id": "c2"},
                ],
                None,
            ))
            mock_svc.return_value = svc

            resp = admin_client.get(f"{API}/admin/contents/flagged", headers=auth_headers)
            assert resp.status_code == 200
            flagged = resp.json()["data"]
            assert len(flagged) == 2
            target_content = flagged[0]["content_id"]

        # Step 2: POST /admin/contents/{id}/moderate
        with patch("app.api.v1.endpoints.admin.get_admin_service") as mock_svc:
            svc = MagicMock()
            svc.moderate_content = AsyncMock(return_value={
                "content_id": target_content,
                "action": "reject",
                "reason": "Confirmed spam content",
                "moderated_by": "admin_001",
            })
            mock_svc.return_value = svc

            resp = admin_client.post(
                f"{API}/admin/contents/{target_content}/moderate",
                json={"action": "reject", "reason": "Confirmed spam content"},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            mod = resp.json()["data"]
            assert mod["action"] == "reject"
            assert mod["content_id"] == target_content

    def test_system_health(self, admin_client, auth_headers):
        """Admin checks system health and views platform analytics."""
        # Step 1: GET /admin/system/health
        with patch("app.api.v1.endpoints.admin.get_admin_service") as mock_svc:
            svc = MagicMock()
            svc.get_system_health = AsyncMock(return_value={
                "firestore": {"status": "healthy", "latency_ms": 12},
                "cloud_storage": {"status": "healthy", "latency_ms": 8},
                "tts_service": {"status": "healthy", "latency_ms": 45},
                "stripe": {"status": "healthy", "latency_ms": 120},
            })
            mock_svc.return_value = svc

            resp = admin_client.get(f"{API}/admin/system/health", headers=auth_headers)
            assert resp.status_code == 200
            health = resp.json()["data"]
            assert "firestore" in health
            assert health["firestore"]["status"] == "healthy"

        # Step 2: GET /admin/analytics/platform
        with patch("app.api.v1.endpoints.admin.get_admin_service") as mock_svc:
            svc = MagicMock()
            svc.get_platform_analytics = AsyncMock(return_value={
                "total_users": 1500,
                "total_creators": 200,
                "total_contents": 850,
                "total_plays": 45000,
                "total_revenue": 1200000,
                "active_users_30d": 600,
                "new_users_30d": 75,
            })
            mock_svc.return_value = svc

            resp = admin_client.get(f"{API}/admin/analytics/platform", headers=auth_headers)
            assert resp.status_code == 200
            analytics = resp.json()["data"]
            assert analytics["total_users"] == 1500
            assert analytics["total_revenue"] == 1200000
            assert analytics["active_users_30d"] == 600
