"""Application middleware stack."""

import time
import uuid
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.exceptions import AppException, RateLimitException
from app.middleware.rate_limiter import RateLimiterMiddleware

logger = get_logger(__name__)


def setup_middleware(app: FastAPI) -> None:
    """Register all middleware (order matters: last added = first executed)."""
    settings = get_settings()

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
        expose_headers=["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
    )

    # Custom middleware (last added = first executed)
    # Execution order: SecurityHeaders -> RateLimiter -> RequestLogging -> route
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(RateLimiterMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every request with timing and request ID."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        start = time.perf_counter()

        try:
            response = await call_next(request)
            elapsed_ms = (time.perf_counter() - start) * 1000

            logger.info(
                "request_completed",
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                duration_ms=round(elapsed_ms, 2),
                request_id=request_id,
            )

            response.headers["X-Request-ID"] = request_id
            return response

        except Exception as exc:
            elapsed_ms = (time.perf_counter() - start) * 1000
            logger.error(
                "request_failed",
                method=request.method,
                path=request.url.path,
                error=str(exc),
                duration_ms=round(elapsed_ms, 2),
                request_id=request_id,
            )
            raise


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "microphone=(), camera=(), geolocation=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' https://js.stripe.com; "
            "frame-src https://js.stripe.com; "
            "connect-src 'self' https://api.stripe.com https://firestore.googleapis.com https://storage.googleapis.com; "
            "img-src 'self' https://storage.googleapis.com https://firebasestorage.googleapis.com data:; "
            "style-src 'self' 'unsafe-inline'; "
            "font-src 'self' https://fonts.gstatic.com"
        )
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


def setup_exception_handlers(app: FastAPI) -> None:
    """Register global exception handlers."""

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        body = {
            "error": {
                "type": exc.error_type,
                "status": exc.status_code,
                "detail": exc.detail,
                "instance": str(request.url.path),
            }
        }
        if isinstance(exc, RateLimitException):
            return JSONResponse(
                status_code=exc.status_code,
                content=body,
                headers={"Retry-After": str(exc.retry_after)},
            )
        return JSONResponse(status_code=exc.status_code, content=body)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.error("unhandled_exception", error=str(exc), path=request.url.path)
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "type": "internal_error",
                    "status": 500,
                    "detail": "An internal error occurred",
                }
            },
        )
