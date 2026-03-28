"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI

from app.core.config import get_settings
from app.core.logging import setup_logging, get_logger
from app.core.firebase import init_firebase
from app.middleware import setup_middleware, setup_exception_handlers
from app.middleware.rate_limiter import RateLimiterMiddleware
from app.api.v1 import api_router

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown lifecycle."""
    settings = get_settings()
    setup_logging()
    logger.info("app_starting", environment=settings.ENVIRONMENT, version=settings.APP_VERSION)

    # Initialize Firebase
    if not settings.is_testing:
        init_firebase()

    # Sentry
    if settings.SENTRY_DSN and settings.is_production:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        sentry_sdk.init(dsn=settings.SENTRY_DSN, integrations=[FastApiIntegration()])

    yield

    # Gracefully close Redis connections used by the rate limiter.
    _app = app.middleware_stack
    while _app is not None:
        if isinstance(_app, RateLimiterMiddleware) and _app._pool is not None:
            await _app._pool.aclose()
            logger.info("rate_limiter_redis_closed")
            break
        _app = getattr(_app, "app", None)

    logger.info("app_shutting_down")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        lifespan=lifespan,
    )

    setup_middleware(app)
    setup_exception_handlers(app)

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    return app


app = create_app()
