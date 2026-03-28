"""Notification endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.security import CurrentUser
from app.services import get_notification_service
from app.services.notification_service import NotificationService

router = APIRouter()


def _svc() -> NotificationService:
    return get_notification_service()


@router.get("/notifications")
async def list_notifications(
    user: CurrentUser,
    cursor: str | None = None,
    limit: int = Query(20, ge=1, le=50),
    unread_only: bool = False,
):
    svc = _svc()
    items, next_cursor = await svc.get_notifications(
        user.uid, limit=limit, cursor=cursor, unread_only=unread_only,
    )
    return {
        "data": items,
        "pagination": {"cursor": next_cursor, "has_more": next_cursor is not None, "limit": limit},
    }


@router.get("/notifications/unread-count")
async def get_unread_count(user: CurrentUser):
    svc = _svc()
    count = await svc.get_unread_count(user.uid)
    return {"data": {"unread_count": count}}


@router.put("/notifications/{notification_id}/read")
async def mark_as_read(notification_id: str, user: CurrentUser):
    svc = _svc()
    result = await svc.mark_as_read(user.uid, notification_id)
    return {"data": result}


@router.put("/notifications/read-all")
async def mark_all_read(user: CurrentUser):
    svc = _svc()
    count = await svc.mark_all_read(user.uid)
    return {"data": {"updated_count": count}}
