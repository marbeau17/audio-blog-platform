"""Unit tests for core modules."""

import pytest
import os
from unittest.mock import patch, MagicMock, AsyncMock
from app.core.exceptions import (
    AppException, UnauthorizedException, ForbiddenException,
    NotFoundException, ConflictException, ValidationException,
    RateLimitException, UpstreamException, ServiceUnavailableException,
)
from app.models.user import AuthenticatedUser


class TestExceptions:
    def test_unauthorized(self):
        exc = UnauthorizedException()
        assert exc.status_code == 401
        assert exc.error_type == "unauthorized"

    def test_forbidden(self):
        exc = ForbiddenException("No access")
        assert exc.status_code == 403
        assert "No access" in exc.detail

    def test_not_found(self):
        exc = NotFoundException("Content")
        assert exc.status_code == 404
        assert "Content" in exc.detail

    def test_not_found_custom_detail(self):
        exc = NotFoundException(detail="カスタムメッセージ")
        assert "カスタム" in exc.detail

    def test_conflict(self):
        exc = ConflictException("Already exists")
        assert exc.status_code == 409

    def test_validation(self):
        exc = ValidationException("Invalid", errors=[{"field": "title", "message": "required"}])
        assert exc.status_code == 422
        assert len(exc.errors) == 1

    def test_rate_limit(self):
        exc = RateLimitException(retry_after=120)
        assert exc.status_code == 429
        assert exc.retry_after == 120

    def test_upstream(self):
        exc = UpstreamException("Stripe", "connection timeout")
        assert exc.status_code == 502
        assert "Stripe" in exc.detail

    def test_service_unavailable(self):
        exc = ServiceUnavailableException()
        assert exc.status_code == 503


class TestAuthenticatedUser:
    def test_listener_properties(self):
        user = AuthenticatedUser(
            uid="u1", email="test@test.com", email_verified=True, role="listener"
        )
        assert not user.is_creator
        assert not user.is_admin

    def test_creator_properties(self):
        user = AuthenticatedUser(
            uid="u1", email="test@test.com", email_verified=True, role="creator",
            stripe_account_id="acct_test"
        )
        assert user.is_creator
        assert not user.is_admin

    def test_admin_properties(self):
        user = AuthenticatedUser(
            uid="u1", email="test@test.com", email_verified=True, role="admin"
        )
        assert user.is_creator  # admin is also creator
        assert user.is_admin


class TestConfig:
    def test_default_settings(self):
        with patch.dict(os.environ, {
            "FIREBASE_PROJECT_ID": "test",
            "STRIPE_SECRET_KEY": "sk_test",
            "STRIPE_WEBHOOK_SECRET": "whsec_test",
        }):
            from app.core.config import Settings
            settings = Settings()
            assert settings.ENVIRONMENT == "development"
            assert settings.API_V1_PREFIX == "/api/v1"
            assert settings.TTS_CHUNK_MAX_BYTES == 4500
            assert settings.PLATFORM_FEE_PERCENT == 20.0
            assert not settings.is_production

    def test_production_flags(self):
        with patch.dict(os.environ, {
            "ENVIRONMENT": "production",
            "FIREBASE_PROJECT_ID": "prod",
            "STRIPE_SECRET_KEY": "sk_live",
            "STRIPE_WEBHOOK_SECRET": "whsec_live",
        }):
            from app.core.config import Settings
            settings = Settings()
            assert settings.is_production
            assert not settings.is_testing

    def test_test_flags(self):
        with patch.dict(os.environ, {
            "ENVIRONMENT": "test",
            "FIREBASE_PROJECT_ID": "test",
            "STRIPE_SECRET_KEY": "sk_test",
            "STRIPE_WEBHOOK_SECRET": "whsec_test",
        }):
            from app.core.config import Settings
            settings = Settings()
            assert settings.is_testing
            assert not settings.is_production
