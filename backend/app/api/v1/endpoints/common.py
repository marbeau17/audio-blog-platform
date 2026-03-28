"""Common endpoints - health, categories, search, uploads, reports."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File

from app.core.config import get_settings
from app.core.security import CurrentUser, OptionalUser, AdminUser
from app.schemas import HealthResponse, DetailedHealthResponse
from app.services import get_admin_service, get_content_service

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    settings = get_settings()
    return {"status": "ok", "version": settings.APP_VERSION, "environment": settings.ENVIRONMENT}


@router.get("/health/detailed", response_model=DetailedHealthResponse)
async def detailed_health(user: AdminUser):
    settings = get_settings()
    svc = get_admin_service()
    services = await svc.get_system_health()
    return {
        "status": "ok" if all(v == "healthy" for v in services.values()) else "degraded",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "services": {k: {"status": v} for k, v in services.items()},
    }


@router.get("/categories")
async def list_categories():
    """Return category tree."""
    return {
        "data": [
            {"id": "business", "name": "ビジネス", "children": [
                {"id": "strategy", "name": "経営戦略"},
                {"id": "marketing", "name": "マーケティング"},
                {"id": "leadership", "name": "リーダーシップ"},
                {"id": "finance", "name": "ファイナンス"},
            ]},
            {"id": "self-improvement", "name": "自己啓発", "children": [
                {"id": "mindset", "name": "マインドセット"},
                {"id": "habits", "name": "習慣形成"},
                {"id": "communication", "name": "コミュニケーション"},
                {"id": "time-management", "name": "時間管理"},
            ]},
            {"id": "technology", "name": "テクノロジー", "children": [
                {"id": "ai-ml", "name": "AI・機械学習"},
                {"id": "programming", "name": "プログラミング"},
                {"id": "product-dev", "name": "プロダクト開発"},
                {"id": "data-science", "name": "データサイエンス"},
            ]},
            {"id": "lifestyle", "name": "ライフスタイル", "children": [
                {"id": "health", "name": "健康・ウェルネス"},
                {"id": "money", "name": "マネー・投資"},
                {"id": "career", "name": "キャリア"},
            ]},
        ]
    }


@router.get("/search")
async def global_search(q: str, limit: int = 20):
    """Cross-entity search (contents + creators)."""
    svc = get_content_service()
    contents, _ = await svc.list_contents(q=q, limit=limit)
    return {"data": contents, "query": q}


@router.post("/upload/image")
async def upload_image(user: CurrentUser, file: UploadFile = File(...)):
    """Upload image to GCS. Returns URL."""
    from google.cloud import storage as gcs
    settings = get_settings()
    client = gcs.Client()
    bucket = client.bucket(settings.GCS_IMAGE_BUCKET)

    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    blob_name = f"images/{user.uid}/{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.{ext}"
    blob = bucket.blob(blob_name)
    data = await file.read()
    blob.upload_from_string(data, content_type=file.content_type or "image/jpeg")
    blob.make_public()

    return {"data": {"url": blob.public_url, "path": blob_name}}


@router.post("/upload/audio")
async def upload_audio(user: CurrentUser, file: UploadFile = File(...)):
    """Direct audio file upload for creators."""
    if not user.is_creator:
        from app.core.exceptions import ForbiddenException
        raise ForbiddenException("Only creators can upload audio")

    from google.cloud import storage as gcs
    settings = get_settings()
    client = gcs.Client()
    bucket = client.bucket(settings.GCS_AUDIO_BUCKET)

    ext = file.filename.split(".")[-1] if file.filename else "mp3"
    blob_name = f"audio/uploads/{user.uid}/{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.{ext}"
    blob = bucket.blob(blob_name)
    data = await file.read()
    blob.upload_from_string(data, content_type=file.content_type or "audio/mpeg")

    return {"data": {"path": blob_name, "size_bytes": len(data)}}


@router.post("/report")
async def report_content(user: CurrentUser, content_id: str, reason: str):
    """Report content for moderation."""
    from app.services import get_admin_service
    svc = get_admin_service()
    await svc.db.collection("reports").add({
        "content_id": content_id,
        "reporter_id": user.uid,
        "reason": reason,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
    })
    return {"data": {"reported": True}}
