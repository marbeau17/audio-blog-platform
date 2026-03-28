"""Common endpoints - health, categories, search, uploads, reports."""

from datetime import datetime, timezone
from typing import Set

from fastapi import APIRouter, Depends, UploadFile, File

from app.core.config import get_settings
from app.core.exceptions import ValidationException
from app.core.security import CurrentUser, OptionalUser, AdminUser
from app.schemas import HealthResponse, DetailedHealthResponse
from app.services import get_admin_service, get_content_service

router = APIRouter()

# ---------- File upload validation ----------

_IMAGE_EXTENSIONS: Set[str] = {"jpg", "jpeg", "png", "gif", "webp"}
_AUDIO_EXTENSIONS: Set[str] = {"mp3", "wav", "ogg", "m4a", "flac"}

_IMAGE_MAX_SIZE = 10 * 1024 * 1024       # 10 MB
_AUDIO_MAX_SIZE = 100 * 1024 * 1024      # 100 MB

# Mapping of extension -> expected MIME type prefixes
_IMAGE_MIME_MAP: dict[str, list[str]] = {
    "jpg": ["image/jpeg"],
    "jpeg": ["image/jpeg"],
    "png": ["image/png"],
    "gif": ["image/gif"],
    "webp": ["image/webp"],
}

_AUDIO_MIME_MAP: dict[str, list[str]] = {
    "mp3": ["audio/mpeg", "audio/mp3"],
    "wav": ["audio/wav", "audio/x-wav", "audio/wave"],
    "ogg": ["audio/ogg", "audio/vorbis"],
    "m4a": ["audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac"],
    "flac": ["audio/flac", "audio/x-flac"],
}

# Magic number signatures (first N bytes) for image formats
_IMAGE_MAGIC: dict[str, list[bytes]] = {
    "jpg": [b"\xff\xd8\xff"],
    "jpeg": [b"\xff\xd8\xff"],
    "png": [b"\x89PNG\r\n\x1a\n"],
    "gif": [b"GIF87a", b"GIF89a"],
    "webp": [b"RIFF"],  # Full check: RIFF????WEBP
}


async def _validate_file(
    file: UploadFile,
    *,
    allowed_extensions: Set[str],
    mime_map: dict[str, list[str]],
    max_size: int,
    kind: str,
    magic_map: dict[str, list[bytes]] | None = None,
) -> bytes:
    """Read and validate an uploaded file. Returns file data on success."""
    # --- Extension check ---
    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in allowed_extensions:
        raise ValidationException(
            f"Invalid {kind} file extension '.{ext}'. "
            f"Allowed: {', '.join(sorted(allowed_extensions))}"
        )

    # --- MIME type check ---
    content_type = (file.content_type or "").lower()
    expected_mimes = mime_map.get(ext, [])
    if expected_mimes and content_type not in expected_mimes:
        raise ValidationException(
            f"MIME type '{content_type}' does not match extension '.{ext}'. "
            f"Expected one of: {', '.join(expected_mimes)}"
        )

    # --- Read data & size check ---
    data = await file.read()
    if len(data) > max_size:
        limit_mb = max_size // (1024 * 1024)
        raise ValidationException(
            f"{kind.capitalize()} file too large ({len(data)} bytes). Maximum is {limit_mb} MB."
        )
    if len(data) == 0:
        raise ValidationException(f"{kind.capitalize()} file is empty.")

    # --- Magic number check ---
    if magic_map and ext in magic_map:
        signatures = magic_map[ext]
        if not any(data[:len(sig)] == sig for sig in signatures):
            raise ValidationException(
                f"File content does not match the expected {kind} format for '.{ext}'."
            )
        # Extra check for WEBP: bytes 8-12 must be "WEBP"
        if ext == "webp" and data[8:12] != b"WEBP":
            raise ValidationException(
                "File content does not match the expected image format for '.webp'."
            )

    return data


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
    data = await _validate_file(
        file,
        allowed_extensions=_IMAGE_EXTENSIONS,
        mime_map=_IMAGE_MIME_MAP,
        max_size=_IMAGE_MAX_SIZE,
        kind="image",
        magic_map=_IMAGE_MAGIC,
    )

    from google.cloud import storage as gcs
    settings = get_settings()
    client = gcs.Client()
    bucket = client.bucket(settings.GCS_IMAGE_BUCKET)

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename else "jpg"
    blob_name = f"images/{user.uid}/{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.{ext}"
    blob = bucket.blob(blob_name)
    blob.upload_from_string(data, content_type=file.content_type or "image/jpeg")
    blob.make_public()

    return {"data": {"url": blob.public_url, "path": blob_name}}


@router.post("/upload/audio")
async def upload_audio(user: CurrentUser, file: UploadFile = File(...)):
    """Direct audio file upload for creators."""
    if not user.is_creator:
        from app.core.exceptions import ForbiddenException
        raise ForbiddenException("Only creators can upload audio")

    data = await _validate_file(
        file,
        allowed_extensions=_AUDIO_EXTENSIONS,
        mime_map=_AUDIO_MIME_MAP,
        max_size=_AUDIO_MAX_SIZE,
        kind="audio",
    )

    from google.cloud import storage as gcs
    settings = get_settings()
    client = gcs.Client()
    bucket = client.bucket(settings.GCS_AUDIO_BUCKET)

    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename else "mp3"
    blob_name = f"audio/uploads/{user.uid}/{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.{ext}"
    blob = bucket.blob(blob_name)
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
