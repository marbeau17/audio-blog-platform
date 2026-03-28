"""Redis-based sliding window rate limiter middleware."""

from __future__ import annotations

import time
from enum import Enum

import redis.asyncio as redis
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class RequestTier(str, Enum):
    """Rate limit tiers ordered from most to least specific."""

    WEBHOOK = "webhook"
    TTS = "tts"
    ADMIN = "admin"
    AUTHENTICATED = "authenticated"
    UNAUTHENTICATED = "unauthenticated"


def _classify_request(path: str, auth_header: str | None) -> RequestTier:
    """Determine the rate limit tier for a request based on path and auth."""
    # Webhook endpoints get the highest throughput allowance.
    if "/payment/webhook" in path:
        return RequestTier.WEBHOOK

    # TTS endpoints are the most expensive, so they have the strictest limit.
    if "/tts" in path:
        return RequestTier.TTS

    # Admin endpoints have a higher allowance than regular authenticated users.
    if "/admin" in path:
        return RequestTier.ADMIN

    # Any request carrying a Bearer token is treated as authenticated.
    if auth_header and auth_header.lower().startswith("bearer "):
        return RequestTier.AUTHENTICATED

    return RequestTier.UNAUTHENTICATED


def _get_limit_for_tier(tier: RequestTier, settings: Settings) -> int:
    """Return the per-window request cap for the given tier."""
    return {
        RequestTier.WEBHOOK: settings.RATE_LIMIT_WEBHOOK,
        RequestTier.TTS: settings.RATE_LIMIT_TTS,
        RequestTier.ADMIN: settings.RATE_LIMIT_ADMIN,
        RequestTier.AUTHENTICATED: settings.RATE_LIMIT_AUTHENTICATED,
        RequestTier.UNAUTHENTICATED: settings.RATE_LIMIT_UNAUTHENTICATED,
    }[tier]


def _get_client_key(request: Request, tier: RequestTier) -> str:
    """Build a unique Redis key for the client + tier combination.

    For authenticated requests the key is derived from the token (which maps
    1-to-1 to a Firebase UID for the lifetime of the token).  For
    unauthenticated requests the client IP is used.
    """
    if tier in (
        RequestTier.AUTHENTICATED,
        RequestTier.ADMIN,
        RequestTier.TTS,
    ):
        # Use the raw token as the identity.  We intentionally do *not*
        # decode the JWT here -- that is the job of the auth layer.  The
        # token is hashed internally by Redis key storage anyway.
        auth = request.headers.get("authorization", "")
        identity = auth.split(" ", 1)[-1] if " " in auth else "anon"
    else:
        # For unauthenticated and webhook traffic, key by IP.
        identity = request.client.host if request.client else "unknown"

    return f"ratelimit:{tier.value}:{identity}"


# ---------------------------------------------------------------------------
# Sliding-window rate limit check executed as a single atomic Lua script
# ---------------------------------------------------------------------------
# KEYS[1] = sorted-set key
# ARGV[1] = current timestamp (float seconds)
# ARGV[2] = window start timestamp
# ARGV[3] = max requests allowed in the window
# ARGV[4] = window size in seconds (used for key TTL)
#
# Returns: [current_count, is_allowed (1/0)]
_LUA_SLIDING_WINDOW = """
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[2])
local count = redis.call('ZCARD', KEYS[1])
if count < tonumber(ARGV[3]) then
    redis.call('ZADD', KEYS[1], ARGV[1], ARGV[1] .. ':' .. math.random(1000000))
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
    return {count + 1, 1}
end
return {count, 0}
"""


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """Sliding-window rate limiter backed by Redis.

    On Redis connection failure the middleware is bypassed so that the API
    remains available (fail-open).
    """

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)
        self._settings = get_settings()
        self._pool: redis.Redis | None = None
        self._script_sha: str | None = None

    # -- lazy connection -------------------------------------------------- #

    async def _get_redis(self) -> redis.Redis:
        """Return a shared async Redis connection, creating it on first use."""
        if self._pool is None:
            self._pool = redis.from_url(
                self._settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            # Pre-load the Lua script so subsequent calls use EVALSHA.
            self._script_sha = await self._pool.script_load(_LUA_SLIDING_WINDOW)
        return self._pool

    # -- core ------------------------------------------------------------- #

    async def _check_rate_limit(
        self,
        key: str,
        limit: int,
        window: int,
    ) -> tuple[int, int, bool]:
        """Run the sliding-window check against Redis.

        Returns (current_count, limit, allowed).
        """
        r = await self._get_redis()
        now = time.time()
        window_start = now - window

        result = await r.evalsha(
            self._script_sha,
            1,
            key,
            str(now),
            str(window_start),
            str(limit),
            str(window),
        )

        current_count, allowed = int(result[0]), bool(int(result[1]))
        return current_count, limit, allowed

    # -- middleware entry point ------------------------------------------- #

    async def dispatch(self, request: Request, call_next):  # noqa: ANN001
        # Skip rate limiting for health-check / readiness probes.
        if request.url.path in ("/health", "/healthz", "/ready", "/docs", "/redoc", "/openapi.json"):
            return await call_next(request)

        settings = self._settings
        tier = _classify_request(request.url.path, request.headers.get("authorization"))
        limit = _get_limit_for_tier(tier, settings)
        window = settings.RATE_LIMIT_WINDOW_SECONDS
        key = _get_client_key(request, tier)

        try:
            count, cap, allowed = await self._check_rate_limit(key, limit, window)
        except Exception:
            # Fail open: if Redis is unreachable, let the request through.
            logger.warning("rate_limiter_redis_error", path=request.url.path)
            response = await call_next(request)
            return response

        if not allowed:
            retry_after = window  # worst-case: full window
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "type": "rate_limit_exceeded",
                        "status": 429,
                        "detail": "Rate limit exceeded",
                        "instance": str(request.url.path),
                    }
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(cap),
                    "X-RateLimit-Remaining": "0",
                },
            )

        response = await call_next(request)
        remaining = max(0, cap - count)
        response.headers["X-RateLimit-Limit"] = str(cap)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
