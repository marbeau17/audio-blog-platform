"""Favorites/bookmarks endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Query
from starlette.responses import Response

from app.core.security import CurrentUser
from app.schemas import FavoriteResponse
from app.services import get_favorites_service

router = APIRouter()


@router.post("/{content_id}", status_code=201)
async def add_favorite(content_id: str, user: CurrentUser):
    """Add content to favorites."""
    svc = get_favorites_service()
    result = await svc.add_favorite(user.uid, content_id)
    return {"data": FavoriteResponse(**result).model_dump(mode="json")}


@router.delete("/{content_id}", status_code=204)
async def remove_favorite(content_id: str, user: CurrentUser):
    """Remove content from favorites."""
    svc = get_favorites_service()
    await svc.remove_favorite(user.uid, content_id)
    return Response(status_code=204)


@router.get("")
async def list_favorites(
    user: CurrentUser,
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = Query(None),
):
    """List user's favorites with pagination."""
    svc = get_favorites_service()
    result = await svc.get_favorites(user.uid, limit=limit, cursor=cursor)
    return result


@router.get("/{content_id}/check")
async def check_favorite(content_id: str, user: CurrentUser):
    """Check if content is in favorites."""
    svc = get_favorites_service()
    is_fav = await svc.is_favorite(user.uid, content_id)
    return {"data": {"is_favorite": is_fav}}
