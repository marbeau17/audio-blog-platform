"""Integration tests for API endpoints using TestClient."""

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


@pytest.fixture
def mock_firebase_auth():
    with patch("app.core.security.init_firebase"), \
         patch("app.core.security.auth") as mock_auth:
        mock_auth.verify_id_token.return_value = {
            "uid": "test_user_123",
            "email": "test@example.com",
            "email_verified": True,
            "role": "creator",
            "name": "Test Creator",
        }
        yield mock_auth


@pytest.fixture
def client(mock_firebase_auth):
    with patch("app.main.init_firebase"), \
         patch("app.core.firebase.init_firebase"), \
         patch("app.core.firebase.get_async_firestore_client") as mock_db:
        mock_db.return_value = AsyncMock()
        from app.main import create_app
        app = create_app()
        yield TestClient(app)


@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer test_token_123"}


class TestHealthEndpoint:
    def test_health_check(self, client):
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data

    def test_health_has_correct_fields(self, client):
        response = client.get("/api/v1/health")
        data = response.json()
        assert "environment" in data
        assert data["environment"] == "test"


class TestCategoriesEndpoint:
    def _mock_category_docs(self):
        """Create mock Firestore document snapshots for categories."""
        doc1 = MagicMock()
        doc1.id = "business"
        doc1.to_dict.return_value = {
            "name": "Business",
            "slug": "business",
            "order": 1,
            "children": [{"id": "leadership", "name": "Leadership"}],
        }
        doc2 = MagicMock()
        doc2.id = "technology"
        doc2.to_dict.return_value = {
            "name": "Technology",
            "slug": "technology",
            "order": 2,
        }
        return [doc1, doc2]

    def test_list_categories(self, client):
        docs = self._mock_category_docs()
        with patch("app.api.v1.endpoints.common.get_content_service") as mock_svc:
            svc = MagicMock()

            async def _stream():
                for d in docs:
                    yield d

            svc.db.collection.return_value.order_by.return_value.stream = _stream
            mock_svc.return_value = svc

            response = client.get("/api/v1/categories")
            assert response.status_code == 200
            data = response.json()
            assert "data" in data
            categories = data["data"]
            assert len(categories) > 0
            assert any(c["id"] == "business" for c in categories)

    def test_categories_have_required_fields(self, client):
        docs = self._mock_category_docs()
        with patch("app.api.v1.endpoints.common.get_content_service") as mock_svc:
            svc = MagicMock()

            async def _stream():
                for d in docs:
                    yield d

            svc.db.collection.return_value.order_by.return_value.stream = _stream
            mock_svc.return_value = svc

            response = client.get("/api/v1/categories")
            data = response.json()["data"]
            business = next(c for c in data if c["id"] == "business")
            assert "name" in business
            assert "slug" in business
            assert "order" in business
            assert business["name"] == "Business"


class TestAuthEndpoints:
    def test_login_info(self, client):
        response = client.post("/api/v1/auth/login")
        assert response.status_code == 200

    def test_get_me_unauthorized(self, client):
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401

    def test_get_me_with_auth(self, client, auth_headers):
        with patch("app.api.v1.endpoints.auth.get_async_firestore_client") as mock_db:
            doc = MagicMock()
            doc.exists = True
            doc.to_dict.return_value = {
                "uid": "test_user_123",
                "email": "test@example.com",
                "role": "creator",
                "display_name": "Test Creator",
            }
            mock_db.return_value.collection.return_value.document.return_value.get = AsyncMock(return_value=doc)

            response = client.get("/api/v1/auth/me", headers=auth_headers)
            assert response.status_code == 200
            data = response.json()["data"]
            assert data["uid"] == "test_user_123"


class TestContentEndpoints:
    def test_list_contents_no_auth(self, client):
        with patch("app.api.v1.endpoints.contents.get_content_service") as mock_svc:
            svc = MagicMock()
            svc.list_contents = AsyncMock(return_value=([], None))
            mock_svc.return_value = svc

            response = client.get("/api/v1/contents")
            assert response.status_code == 200
            data = response.json()
            assert "data" in data
            assert "pagination" in data

    def test_create_content_unauthorized(self, client):
        response = client.post("/api/v1/contents", json={
            "title": "Test", "body_markdown": "Hello"
        })
        assert response.status_code == 401

    def test_create_content_with_auth(self, client, auth_headers):
        with patch("app.api.v1.endpoints.contents.get_content_service") as mock_svc:
            svc = MagicMock()
            svc.create_content = AsyncMock(return_value={
                "content_id": "new_001",
                "title": "Test Article",
                "creator_id": "test_user_123",
                "status": "draft",
            })
            mock_svc.return_value = svc

            response = client.post(
                "/api/v1/contents",
                json={"title": "Test Article", "body_markdown": "# Hello"},
                headers=auth_headers,
            )
            assert response.status_code == 201
            assert response.json()["data"]["title"] == "Test Article"


class TestTtsEndpoints:
    def test_list_voices_with_auth(self, client, auth_headers):
        response = client.get("/api/v1/tts/voices", headers=auth_headers)
        assert response.status_code == 200
        voices = response.json()["data"]
        assert len(voices) > 0
        assert any(v["language"] == "ja-JP" for v in voices)

    def test_list_voices_unauthorized(self, client):
        response = client.get("/api/v1/tts/voices")
        assert response.status_code == 401


class TestStreamEndpoints:
    def test_get_position_unauthorized(self, client):
        response = client.get("/api/v1/stream/content_1/position")
        assert response.status_code == 401

    def test_save_position_with_auth(self, client, auth_headers):
        with patch("app.api.v1.endpoints.stream.get_stream_service") as mock_svc:
            svc = MagicMock()
            svc.save_playback_position = AsyncMock(return_value={
                "content_id": "c1",
                "position_seconds": 120.0,
                "total_duration_seconds": 600.0,
            })
            mock_svc.return_value = svc

            response = client.put(
                "/api/v1/stream/c1/position",
                json={
                    "position_seconds": 120.0,
                    "total_duration_seconds": 600.0,
                    "playback_speed": 1.0,
                    "device_id": "browser_1",
                },
                headers=auth_headers,
            )
            assert response.status_code == 200


class TestPaymentEndpoints:
    def test_check_purchase(self, client, auth_headers):
        with patch("app.api.v1.endpoints.payment.get_payment_service") as mock_svc:
            svc = MagicMock()
            svc.check_purchase = AsyncMock(return_value=False)
            mock_svc.return_value = svc

            response = client.get("/api/v1/payment/purchases/c1/check", headers=auth_headers)
            assert response.status_code == 200
            assert response.json()["data"]["purchased"] is False

    def test_webhook_no_signature_rejected(self, client):
        response = client.post("/api/v1/payment/webhook", content=b'{}')
        assert response.status_code in (401, 500)


class TestMiddleware:
    def test_security_headers_present(self, client):
        response = client.get("/api/v1/health")
        assert response.headers.get("X-Content-Type-Options") == "nosniff"
        assert response.headers.get("X-Frame-Options") == "DENY"
        assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"

    def test_request_id_returned(self, client):
        response = client.get("/api/v1/health", headers={"X-Request-ID": "req_test_123"})
        assert response.headers.get("X-Request-ID") == "req_test_123"

    def test_cors_preflight(self, client):
        response = client.options(
            "/api/v1/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert response.status_code == 200
