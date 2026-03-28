"""Shared test fixtures and configuration."""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_firestore():
    """Mock Firestore async client."""
    mock_db = AsyncMock()

    # Mock document reference
    mock_doc_ref = AsyncMock()
    mock_doc_ref.id = "test_doc_id"
    mock_doc_ref.set = AsyncMock()
    mock_doc_ref.update = AsyncMock()
    mock_doc_ref.get = AsyncMock()

    # Mock collection reference
    mock_collection = AsyncMock()
    mock_collection.document = MagicMock(return_value=mock_doc_ref)
    mock_collection.add = AsyncMock(return_value=(None, mock_doc_ref))

    mock_db.collection = MagicMock(return_value=mock_collection)
    return mock_db


@pytest.fixture
def mock_user():
    """Mock authenticated user."""
    from app.models.user import AuthenticatedUser
    return AuthenticatedUser(
        uid="test_user_123",
        email="test@example.com",
        email_verified=True,
        role="listener",
        display_name="Test User",
    )


@pytest.fixture
def mock_creator():
    """Mock creator user."""
    from app.models.user import AuthenticatedUser
    return AuthenticatedUser(
        uid="creator_456",
        email="creator@example.com",
        email_verified=True,
        role="creator",
        stripe_account_id="acct_test_123",
        display_name="Test Creator",
    )


@pytest.fixture
def mock_admin():
    """Mock admin user."""
    from app.models.user import AuthenticatedUser
    return AuthenticatedUser(
        uid="admin_789",
        email="admin@example.com",
        email_verified=True,
        role="admin",
        display_name="Test Admin",
    )


@pytest.fixture
def sample_content_data():
    """Sample content document data."""
    now = datetime.now(timezone.utc)
    return {
        "content_id": "content_001",
        "creator_id": "creator_456",
        "creator_display_name": "Test Creator",
        "title": "テスト記事タイトル",
        "slug": "test-article",
        "excerpt": "テスト概要",
        "body_markdown": "# 第一章\n\nこれはテスト本文です。テキストが音声に変換されます。",
        "body_html": "<div># 第一章...</div>",
        "thumbnail_url": None,
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
        "category_ids": ["business"],
        "tags": ["leadership", "management"],
        "series_id": None,
        "series_order": None,
        "pricing": {"type": "free", "price_jpy": 0, "currency": "JPY"},
        "stats": {
            "view_count": 0, "play_count": 0, "completion_count": 0,
            "purchase_count": 0, "average_rating": 0.0, "review_count": 0,
            "total_revenue": 0,
        },
        "status": "published",
        "published_at": now,
        "scheduled_at": None,
        "seo": {"meta_title": None, "meta_description": None, "og_image_url": None},
        "created_at": now,
        "updated_at": now,
        "current_version": 1,
        "is_deleted": False,
    }


@pytest.fixture
def test_app():
    """Create test FastAPI app with mocked dependencies."""
    import os
    os.environ["ENVIRONMENT"] = "test"
    os.environ["FIREBASE_PROJECT_ID"] = "test-project"
    os.environ["STRIPE_SECRET_KEY"] = "sk_test_fake"
    os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test_fake"

    with patch("app.core.firebase.init_firebase"), \
         patch("app.core.firebase.get_async_firestore_client"):
        from app.main import create_app
        app = create_app()
        return TestClient(app)
