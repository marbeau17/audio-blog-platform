"""Admin endpoints - user management, moderation, platform analytics."""

from fastapi import APIRouter, Query

from app.core.security import AdminUser
from app.schemas import RoleUpdateRequest, SuspendRequest, ModerateRequest
from app.services import get_admin_service

router = APIRouter()


@router.get("/users")
async def list_users(
    user: AdminUser,
    role: str | None = None,
    cursor: str | None = None,
    limit: int = Query(20, ge=1, le=50),
):
    svc = get_admin_service()
    items, next_cursor = await svc.list_users(role=role, cursor=cursor, limit=limit)
    return {
        "data": items,
        "pagination": {"cursor": next_cursor, "has_more": next_cursor is not None, "limit": limit},
    }


@router.put("/users/{user_id}/role")
async def update_role(user_id: str, body: RoleUpdateRequest, user: AdminUser):
    svc = get_admin_service()
    result = await svc.update_user_role(user_id, body.role)
    return {"data": result}


@router.post("/users/{user_id}/suspend")
async def suspend_user(user_id: str, body: SuspendRequest, user: AdminUser):
    svc = get_admin_service()
    result = await svc.suspend_user(user_id, body.reason)
    return {"data": result}


@router.post("/users/{user_id}/unsuspend")
async def unsuspend_user(user_id: str, user: AdminUser):
    svc = get_admin_service()
    result = await svc.unsuspend_user(user_id)
    return {"data": result}


@router.get("/contents/flagged")
async def flagged_contents(
    user: AdminUser,
    cursor: str | None = None,
    limit: int = Query(20, ge=1, le=50),
):
    svc = get_admin_service()
    items, next_cursor = await svc.list_flagged_contents(cursor=cursor, limit=limit)
    return {
        "data": items,
        "pagination": {"cursor": next_cursor, "has_more": next_cursor is not None, "limit": limit},
    }


@router.post("/contents/{content_id}/moderate")
async def moderate_content(content_id: str, body: ModerateRequest, user: AdminUser):
    svc = get_admin_service()
    result = await svc.moderate_content(content_id, body.action, body.reason, user.uid)
    return {"data": result}


@router.get("/analytics/platform")
async def platform_analytics(user: AdminUser):
    svc = get_admin_service()
    result = await svc.get_platform_analytics()
    return {"data": result}


@router.get("/system/health")
async def system_health(user: AdminUser):
    svc = get_admin_service()
    result = await svc.get_system_health()
    return {"data": result}


@router.put("/system/config")
async def update_system_config(user: AdminUser, config: dict):
    from app.core.firebase import get_async_firestore_client
    from datetime import datetime, timezone
    db = get_async_firestore_client()
    for key, value in config.items():
        await db.collection("system_config").document(key).set(
            {"value": value, "updated_at": datetime.now(timezone.utc), "updated_by": user.uid},
            merge=True,
        )
    return {"data": {"updated": list(config.keys())}}


@router.get("/tts/queue")
async def tts_queue_status(user: AdminUser):
    from app.core.firebase import get_async_firestore_client
    db = get_async_firestore_client()

    counts = {}
    for status in ("queued", "processing", "merging", "uploading"):
        query = db.collection("tts_jobs").where("status", "==", status)
        docs = [d async for d in query.select([]).stream()]
        counts[status] = len(docs)

    return {"data": {"queue": counts, "total_active": sum(counts.values())}}
