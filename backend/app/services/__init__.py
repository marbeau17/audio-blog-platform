"""Service layer dependency injection."""

from functools import lru_cache
from app.core.firebase import get_async_firestore_client
from app.services.content_service import ContentService
from app.services.tts_service import TtsService
from app.services.payment_service import PaymentService
from app.services.stream_service import StreamService
from app.services.creator_service import CreatorService
from app.services.admin_service import AdminService


@lru_cache
def get_db():
    return get_async_firestore_client()


def get_content_service() -> ContentService:
    return ContentService(get_db())


def get_tts_service() -> TtsService:
    return TtsService(get_db())


def get_payment_service() -> PaymentService:
    return PaymentService(get_db())


def get_stream_service() -> StreamService:
    return StreamService(get_db())


def get_creator_service() -> CreatorService:
    return CreatorService(get_db())


def get_admin_service() -> AdminService:
    return AdminService(get_db())
