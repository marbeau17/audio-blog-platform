"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import JSONResponse

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
        try:
            init_firebase()
            logger.info("firebase_initialized")
        except Exception as exc:
            logger.warning("firebase_init_failed", error=str(exc))
            if settings.is_production:
                raise

    # Sentry
    if settings.SENTRY_DSN and str(settings.SENTRY_DSN).strip() and settings.is_production:
        try:
            import sentry_sdk
            from sentry_sdk.integrations.fastapi import FastApiIntegration
            sentry_sdk.init(dsn=settings.SENTRY_DSN, integrations=[FastApiIntegration()])
            logger.info("sentry_initialized")
        except Exception as exc:
            logger.warning("sentry_init_failed", error=str(exc))

    yield

    # Gracefully close Redis connections used by the rate limiter.
    try:
        _app = app.middleware_stack
        while _app is not None:
            if isinstance(_app, RateLimiterMiddleware) and _app._pool is not None:
                await _app._pool.aclose()
                logger.info("rate_limiter_redis_closed")
                break
            _app = getattr(_app, "app", None)
    except Exception as exc:
        logger.warning("rate_limiter_redis_close_failed", error=str(exc))

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

    # Root-level health check for Cloud Run startup/liveness probes.
    # This must NOT depend on any external services so it always returns 200.
    @app.get("/health")
    async def root_health():
        return JSONResponse({"status": "healthy", "version": settings.APP_VERSION, "environment": settings.ENVIRONMENT})

    return app


app = create_app()
