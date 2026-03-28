"""API v1 router - aggregates all endpoint routers."""

from fastapi import APIRouter
from app.api.v1.endpoints import auth, contents, tts, stream, payment, creator, admin, common, reviews, favorites, notifications

api_router = APIRouter()

api_router.include_router(common.router, tags=["Health"])
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(contents.router, prefix="/contents", tags=["Contents"])
api_router.include_router(tts.router, prefix="/tts", tags=["TTS"])
api_router.include_router(stream.router, prefix="/stream", tags=["Streaming"])
api_router.include_router(payment.router, prefix="/payment", tags=["Payment"])
api_router.include_router(creator.router, prefix="/creator", tags=["Creator"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(reviews.router, tags=["Reviews"])
api_router.include_router(favorites.router, prefix="/favorites", tags=["Favorites"])
api_router.include_router(notifications.router, tags=["Notifications"])
