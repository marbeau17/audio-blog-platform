"""Monkey / fuzz tests for the backend API.

These tests send intentionally malformed, extreme, and random data to every
API endpoint and assert the server never responds with a 500 Internal Server
Error.  A proper HTTP error (400, 401, 403, 422) is always expected.
"""

import os
import random
import string
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------

os.environ["ENVIRONMENT"] = "test"
os.environ["FIREBASE_PROJECT_ID"] = "test-project"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_fake"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test_fake"
os.environ["GCS_AUDIO_BUCKET"] = "test-audio"
os.environ["GCS_IMAGE_BUCKET"] = "test-images"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

ACCEPTABLE_ERROR_CODES = {400, 401, 403, 404, 405, 409, 422}


def _random_string(length: int) -> str:
    """Return a random ASCII string of *length* characters."""
    return "".join(random.choices(string.ascii_letters + string.digits, k=length))


def _assert_not_500(response):
    """Assert that the server did not return a 500 Internal Server Error."""
    assert response.status_code != 500, (
        f"Server returned 500 for request. "
        f"Body: {response.text[:500]}"
    )


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

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


def _make_mock_content_service():
    """Create a content service mock that handles any input without 500."""
    svc = MagicMock()
    svc.list_contents = AsyncMock(return_value=([], None))
    svc.get_content = AsyncMock(return_value={"content_id": "mock_id", "title": "Mock", "status": "published", "creator_id": "test_user_123", "body_markdown": "mock", "body_html": "<p>mock</p>", "excerpt": "", "category_ids": [], "tags": [], "pricing": {"type": "free", "price_jpy": 0, "currency": "JPY"}, "audio": None, "stats": {"view_count": 0, "play_count": 0}, "created_at": "2025-01-01T00:00:00Z", "updated_at": "2025-01-01T00:00:00Z"})
    svc.create_content = AsyncMock(return_value={"content_id": "new_mock_id", "title": "Mock", "creator_id": "test_user_123", "status": "draft"})
    svc.update_content = AsyncMock(return_value={"content_id": "mock_id", "status": "draft"})
    svc.publish_content = AsyncMock(return_value={"content_id": "mock_id", "status": "published"})
    svc.delete_content = AsyncMock()
    return svc


def _make_mock_payment_service():
    """Create a payment service mock."""
    svc = MagicMock()
    svc.create_payment_intent = AsyncMock(return_value={"client_secret": "cs_mock", "payment_intent_id": "pi_mock", "amount": 0, "currency": "jpy"})
    svc.check_purchase = AsyncMock(return_value=False)
    svc.handle_webhook = AsyncMock(return_value={"received": True})
    svc.create_tip = AsyncMock(return_value={"tip_id": "tip_mock", "amount": 0})
    svc.get_purchases = AsyncMock(return_value=([], None))
    return svc


def _make_mock_stream_service():
    """Create a stream service mock."""
    svc = MagicMock()
    svc.get_stream_url = AsyncMock(return_value={"url": "https://example.com/mock.mp3", "expires_at": "2099-01-01T00:00:00Z"})
    svc.save_playback_position = AsyncMock(return_value={"content_id": "mock", "position_seconds": 0})
    svc.get_playback_position = AsyncMock(return_value={"content_id": "mock", "position_seconds": 0})
    return svc


def _make_mock_tts_service():
    """Create a TTS service mock."""
    svc = MagicMock()
    svc.list_voices = MagicMock(return_value=[])
    svc.list_jobs = AsyncMock(return_value=([], None))
    svc.get_job = AsyncMock(return_value={"job_id": "mock", "status": "queued"})
    svc.text_to_ssml = MagicMock(return_value="<speak>mock</speak>")
    svc.synthesize_chunk = AsyncMock(return_value=b"\x00\x00\x00")  # fake audio bytes
    return svc


def _make_mock_db():
    """Create a mock Firestore async client that supports common patterns."""
    db = MagicMock()
    # Make document-level async operations work
    doc_ref = MagicMock()
    doc_snapshot = MagicMock(exists=False)
    doc_snapshot.to_dict.return_value = {}
    doc_ref.get = AsyncMock(return_value=doc_snapshot)
    doc_ref.set = AsyncMock()
    doc_ref.update = AsyncMock()
    doc_ref.delete = AsyncMock()
    db.collection.return_value.document.return_value = doc_ref
    db.collection.return_value.add = AsyncMock(return_value=(None, MagicMock(id="mock_id")))

    # Make query chain async-iterable for .stream()
    async def _empty_stream():
        return
        yield  # make it an async generator

    query_mock = MagicMock()
    query_mock.stream = _empty_stream
    query_mock.where.return_value = query_mock
    query_mock.order_by.return_value = query_mock
    query_mock.limit.return_value = query_mock
    query_mock.start_after.return_value = query_mock
    db.collection.return_value.where.return_value = query_mock
    db.collection.return_value.order_by.return_value = query_mock
    return db


@pytest.fixture
def client(mock_firebase_auth):
    mock_db_instance = _make_mock_db()
    mock_content_svc = _make_mock_content_service()
    mock_payment_svc = _make_mock_payment_service()
    mock_stream_svc = _make_mock_stream_service()
    mock_tts_svc = _make_mock_tts_service()
    with patch("app.main.init_firebase"), \
         patch("app.core.firebase.init_firebase"), \
         patch("app.core.firebase.get_async_firestore_client", return_value=mock_db_instance), \
         patch("app.services.get_async_firestore_client", return_value=mock_db_instance), \
         patch("app.services.get_db", return_value=mock_db_instance), \
         patch("app.api.v1.endpoints.contents.get_content_service", return_value=mock_content_svc), \
         patch("app.api.v1.endpoints.payment.get_payment_service", return_value=mock_payment_svc), \
         patch("app.api.v1.endpoints.stream.get_stream_service", return_value=mock_stream_svc), \
         patch("app.api.v1.endpoints.tts.get_tts_service", return_value=mock_tts_svc), \
         patch("app.api.v1.endpoints.tts.get_async_firestore_client", return_value=mock_db_instance), \
         patch("app.api.v1.endpoints.auth.get_async_firestore_client", return_value=mock_db_instance), \
         patch("app.api.v1.endpoints.auth.init_firebase"), \
         patch("app.api.v1.endpoints.auth.auth", mock_firebase_auth):
        from app.main import create_app
        app = create_app()
        yield TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer test_token_123"}


# ===================================================================
# TestFuzzContentEndpoints
# ===================================================================


class TestFuzzContentEndpoints:
    """Fuzz the content CRUD endpoints."""

    @pytest.mark.parametrize("length", [0, 1, 100, 10_000, 100_000])
    def test_create_content_with_random_data(self, client, auth_headers, length):
        """Title and body filled with random strings of various sizes."""
        payload = {
            "title": _random_string(length),
            "body_markdown": _random_string(length),
        }
        response = client.post("/api/v1/contents", json=payload, headers=auth_headers)
        _assert_not_500(response)
        # length==0 should be rejected (title min_length=1)
        if length == 0:
            assert response.status_code == 422

    @pytest.mark.parametrize("value", [
        "\u202e\u0645\u0631\u062d\u0628\u0627",          # RTL Arabic
        "\U0001f600\U0001f4a9\U0001f525",                # Emoji
        "\x00\x01\x02\x03\x04",                           # Null / control chars
        "\u4e16\u754c\u3053\u3093\u306b\u3061\u306f",    # CJK / Hiragana
        "' OR 1=1; DROP TABLE contents; --",               # SQL injection
        "<script>alert('xss')</script>",                   # XSS payload
        "${7*7}{{7*7}}",                                   # Template injection
        "A" * 200_000,                                     # Very long single token
        "\n" * 10_000,                                     # Newlines only
        "\t\r\n" * 5_000,                                  # Mixed whitespace
    ])
    def test_create_content_with_special_chars(self, client, auth_headers, value):
        payload = {
            "title": value[:200] if len(value) > 200 else (value or "x"),
            "body_markdown": value,
        }
        response = client.post("/api/v1/contents", json=payload, headers=auth_headers)
        _assert_not_500(response)

    @pytest.mark.parametrize("payload", [
        # Empty body
        {"title": "Valid Title", "body_markdown": ""},
        # Huge tags list (1000 tags) -- exceeds max_length=10
        {"title": "Valid", "body_markdown": "ok", "tags": [f"tag{i}" for i in range(1_000)]},
        # Negative price
        {"title": "Valid", "body_markdown": "ok", "pricing": {"type": "paid", "price_jpy": -500}},
        # Float-ish price (JSON number)
        {"title": "Valid", "body_markdown": "ok", "pricing": {"type": "paid", "price_jpy": 9.99}},
        # Price 0 for paid type
        {"title": "Valid", "body_markdown": "ok", "pricing": {"type": "paid", "price_jpy": 0}},
        # Missing required field
        {"body_markdown": "no title"},
        # Extra unknown fields
        {"title": "ok", "body_markdown": "ok", "nonexistent_field": True},
        # Null title
        {"title": None, "body_markdown": "ok"},
    ])
    def test_create_content_with_extreme_values(self, client, auth_headers, payload):
        response = client.post("/api/v1/contents", json=payload, headers=auth_headers)
        _assert_not_500(response)

    @pytest.mark.parametrize("content_id", [
        str(uuid.uuid4()),                  # random UUID
        "",                                 # empty
        "a" * 10_000,                       # very long
        "../../etc/passwd",                 # path traversal
        "../../../.env",                    # dotfile traversal
        "<script>alert(1)</script>",        # XSS in path
        "' OR 1=1--",                       # SQL injection
        "\x00\x01\x02",                     # null bytes
        "%00%0a%0d",                        # URL-encoded control chars
        "content/../admin",                 # relative path
    ])
    def test_content_id_fuzzing(self, client, auth_headers, content_id):
        import httpx
        for method in [client.get, client.put, client.delete]:
            try:
                response = method(
                    f"/api/v1/contents/{content_id}",
                    headers=auth_headers,
                )
                _assert_not_500(response)
            except httpx.InvalidURL:
                # Client rejects invalid characters in URL before reaching server
                pass


# ===================================================================
# TestFuzzAuthEndpoints
# ===================================================================


class TestFuzzAuthEndpoints:
    """Fuzz the authentication / registration endpoints."""

    @pytest.mark.parametrize("email", [
        "notanemail",
        "@",
        "a" * 1_000 + "@test.com",
        "",
        None,
        "user@.com",
        "@domain.com",
        "user@domain",
        "user name@domain.com",
        "user@domain..com",
    ])
    def test_register_with_invalid_emails(self, client, email):
        payload = {
            "email": email,
            "password": "ValidPass123!",
            "display_name": "Tester",
        }
        response = client.post("/api/v1/auth/register", json=payload)
        _assert_not_500(response)

    @pytest.mark.parametrize("password", [
        "",
        "x",
        "\U0001f600" * 100,                # emoji-only
        "P" * 10_000,                       # very long
        "\x00\x00\x00",                     # null bytes
        " " * 50,                           # spaces only
        "\t\n\r",                           # whitespace control chars
    ])
    def test_register_with_invalid_passwords(self, client, password):
        payload = {
            "email": "test@example.com",
            "password": password,
            "display_name": "Tester",
        }
        response = client.post("/api/v1/auth/register", json=payload)
        _assert_not_500(response)

    @pytest.mark.parametrize("auth_value", [
        "Bearer ",                          # empty token
        "Bearer " + "x" * 100_000,         # extremely long token
        "Basic dXNlcjpwYXNz",              # wrong scheme
        "NotBearer token123",               # unknown scheme
        "",                                 # empty header
        "Bearer \x00\x01\x02",             # binary in token
        "Bearer " + "\U0001f600" * 50,     # emoji token
        "token_no_scheme",                  # no scheme at all
        "Bearer a b c",                     # spaces in token
    ])
    def test_auth_header_fuzzing(self, client, auth_value):
        import httpx
        headers = {"Authorization": auth_value}
        try:
            response = client.get("/api/v1/auth/me", headers=headers)
        except (httpx.InvalidURL, UnicodeEncodeError):
            # Client rejects non-ASCII/invalid characters before reaching server
            return
        _assert_not_500(response)
        # With mock auth, some fuzzed tokens may pass verification and return 200
        assert response.status_code in (ACCEPTABLE_ERROR_CODES | {200})


# ===================================================================
# TestFuzzPaymentEndpoints
# ===================================================================


class TestFuzzPaymentEndpoints:
    """Fuzz payment-related endpoints."""

    @pytest.mark.parametrize("amount", [0, -1, 0.5, 99_999_999, "abc", None])
    def test_payment_with_invalid_amounts(self, client, auth_headers, amount):
        payload = {
            "content_id": "content_001",
            "amount": amount,
        }
        response = client.post(
            "/api/v1/payment/intents",
            json=payload,
            headers=auth_headers,
        )
        _assert_not_500(response)

    @pytest.mark.parametrize("amount", [99, 100, 50_000, 50_001])
    def test_tip_with_boundary_values(self, client, auth_headers, amount):
        """TipCreate.amount has ge=100, le=50000."""
        payload = {
            "creator_id": "creator_456",
            "amount": amount,
            "content_id": "content_001",
        }
        response = client.post(
            "/api/v1/payment/tip",
            json=payload,
            headers=auth_headers,
        )
        _assert_not_500(response)
        # Boundary violations should be 422
        if amount < 100 or amount > 50_000:
            assert response.status_code == 422

    @pytest.mark.parametrize("signature", [
        "",                                 # empty
        "wrong_signature_value",            # incorrect
        "whsec_" + "a" * 10,               # truncated
        "\x00\x01\xff\xfe",                # binary data
        "a" * 100_000,                      # extremely long
    ])
    def test_webhook_with_invalid_signatures(self, client, signature):
        headers = {"stripe-signature": signature}
        try:
            response = client.post(
                "/api/v1/payment/webhook",
                content=b'{"type":"checkout.session.completed"}',
                headers=headers,
            )
        except (UnicodeEncodeError, UnicodeDecodeError):
            # Client rejects non-ASCII characters in headers before reaching server
            return
        _assert_not_500(response)


# ===================================================================
# TestFuzzTtsEndpoints
# ===================================================================


class TestFuzzTtsEndpoints:
    """Fuzz TTS (text-to-speech) endpoints."""

    @pytest.mark.parametrize("text", [
        "",                                 # empty
        "a",                                # single char
        "x" * 1_000_000,                   # ~1 MB text
    ])
    def test_tts_with_extreme_text(self, client, auth_headers, text):
        payload = {"text": text, "config": {}}
        response = client.post(
            "/api/v1/tts/preview",
            json=payload,
            headers=auth_headers,
        )
        _assert_not_500(response)

    @pytest.mark.parametrize("config_override", [
        {"speaking_rate": 0},               # below ge=0.5
        {"speaking_rate": 100},             # above le=2.0
        {"speaking_rate": -1},              # negative
        {"language_code": "xx-INVALID"},    # bad language
        {"language_code": ""},              # empty language
        {"voice_name": ""},                 # empty voice
        {"voice_name": "x" * 10_000},      # very long voice name
        {"pitch": 999},                     # above le=10.0
        {"sample_rate_hertz": -1},          # negative sample rate
        {"audio_encoding": "INVALID"},      # unknown encoding
    ])
    def test_tts_with_invalid_config(self, client, auth_headers, config_override):
        payload = {
            "text": "Normal text for preview.",
            "config": config_override,
        }
        response = client.post(
            "/api/v1/tts/preview",
            json=payload,
            headers=auth_headers,
        )
        _assert_not_500(response)


# ===================================================================
# TestFuzzStreamEndpoints
# ===================================================================


class TestFuzzStreamEndpoints:
    """Fuzz the audio streaming / playback endpoints."""

    @pytest.mark.parametrize("position_data", [
        {"position_seconds": -10, "total_duration_seconds": 600, "playback_speed": 1.0},
        {"position_seconds": 99999, "total_duration_seconds": 600, "playback_speed": 1.0},
        {"position_seconds": float("inf"), "total_duration_seconds": 600, "playback_speed": 1.0},
        {"position_seconds": float("nan"), "total_duration_seconds": 600, "playback_speed": 1.0},
        {"position_seconds": 0, "total_duration_seconds": 0, "playback_speed": 1.0},
        {"position_seconds": 0, "total_duration_seconds": -1, "playback_speed": 1.0},
    ])
    def test_position_with_invalid_values(self, client, auth_headers, position_data):
        try:
            response = client.put(
                "/api/v1/stream/content_1/position",
                json=position_data,
                headers=auth_headers,
            )
        except ValueError:
            # JSON encoder rejects inf/nan values before reaching the server
            return
        _assert_not_500(response)

    @pytest.mark.parametrize("speed", [0, 0.1, 3.0, -1])
    def test_position_with_extreme_speed(self, client, auth_headers, speed):
        """PlaybackPositionUpdate.playback_speed has ge=0.5, le=2.0."""
        payload = {
            "position_seconds": 60.0,
            "total_duration_seconds": 600.0,
            "playback_speed": speed,
            "device_id": "browser_1",
        }
        response = client.put(
            "/api/v1/stream/content_1/position",
            json=payload,
            headers=auth_headers,
        )
        _assert_not_500(response)
        if speed < 0.5 or speed > 2.0:
            assert response.status_code == 422


# ===================================================================
# TestRandomAPISequences
# ===================================================================


class TestRandomAPISequences:
    """Monkey-test: hit random endpoints with random methods and data."""

    ENDPOINTS = [
        "/api/v1/health",
        "/api/v1/categories",
        "/api/v1/contents",
        "/api/v1/contents/random_id",
        "/api/v1/auth/login",
        "/api/v1/auth/me",
        "/api/v1/auth/register",
        "/api/v1/tts/voices",
        "/api/v1/tts/preview",
        "/api/v1/tts/convert",
        "/api/v1/stream/content_1/position",
        "/api/v1/stream/content_1/url",
        "/api/v1/payment/intents",
        "/api/v1/payment/tip",
        "/api/v1/payment/webhook",
        "/api/v1/payment/purchases/c1/check",
    ]

    METHODS = ["get", "post", "put", "patch", "delete"]

    @staticmethod
    def _random_payload() -> dict:
        """Generate a random JSON payload with mixed types."""
        keys = [_random_string(random.randint(1, 30)) for _ in range(random.randint(0, 10))]
        payload = {}
        for key in keys:
            choice = random.randint(0, 5)
            if choice == 0:
                payload[key] = _random_string(random.randint(0, 1_000))
            elif choice == 1:
                payload[key] = random.randint(-1_000_000, 1_000_000)
            elif choice == 2:
                payload[key] = random.random() * 1_000
            elif choice == 3:
                payload[key] = random.choice([True, False, None])
            elif choice == 4:
                payload[key] = [_random_string(10) for _ in range(random.randint(0, 20))]
            else:
                payload[key] = {"nested": _random_string(50)}
        return payload

    def test_random_endpoint_sequence(self, client):
        """Call 50 random endpoints with random HTTP methods and data.

        The server must never return a 500 Internal Server Error regardless
        of what nonsense we throw at it.
        """
        random.seed(42)  # reproducible randomness
        for i in range(50):
            endpoint = random.choice(self.ENDPOINTS)
            method_name = random.choice(self.METHODS)
            method = getattr(client, method_name)

            # Randomly decide whether to include auth and a JSON body
            headers = {}
            if random.random() > 0.5:
                headers["Authorization"] = "Bearer test_token_123"

            kwargs: dict = {"headers": headers}
            if method_name in ("post", "put", "patch"):
                kwargs["json"] = self._random_payload()

            response = method(endpoint, **kwargs)
            assert response.status_code != 500, (
                f"Iteration {i}: {method_name.upper()} {endpoint} "
                f"returned 500. Body: {response.text[:300]}"
            )
