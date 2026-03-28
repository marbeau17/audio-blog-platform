"""Content management endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.security import CurrentUser, OptionalUser, CreatorUser
from app.schemas import ContentCreate, ContentUpdate, ContentResponse
from app.services import get_content_service
from app.services.content_service import ContentService

router = APIRouter()


def _svc() -> ContentService:
    return get_content_service()


@router.get("")
async def list_contents(
    user: OptionalUser = None,
    status: str = Query("published"),
    category: str | None = None,
    tag: str | None = None,
    creator_id: str | None = None,
    series_id: str | None = None,
    sort: str = Query("newest"),
    has_audio: bool | None = None,
    pricing: str | None = None,
    q: str | None = None,
    cursor: str | None = None,
    limit: int = Query(20, ge=1, le=50),
):
    svc = _svc()
    items, next_cursor = await svc.list_contents(
        status=status, category=category, tag=tag, creator_id=creator_id,
        sort=sort, has_audio=has_audio, pricing=pricing, q=q,
        cursor=cursor, limit=limit,
    )
    return {
        "data": items,
        "pagination": {"cursor": next_cursor, "has_more": next_cursor is not None, "limit": limit},
    }


@router.get("/{content_id}")
async def get_content(content_id: str, user: OptionalUser = None):
    svc = _svc()
    content = await svc.get_content(content_id)

    # Hide body for unpurchased paid content
    if content.get("pricing", {}).get("type") == "paid":
        if not user:
            content["body_markdown"] = None
            content["body_html"] = None
        else:
            from app.services import get_payment_service
            pay_svc = get_payment_service()
            purchased = await pay_svc.check_purchase(user.uid, content_id)
            if not purchased and content.get("creator_id") != user.uid and not user.is_admin:
                content["body_markdown"] = None
                content["body_html"] = None

    return {"data": content}


@router.post("", status_code=201)
async def create_content(body: ContentCreate, user: CreatorUser):
    svc = _svc()
    result = await svc.create_content(body, user.uid, user.display_name)
    return {"data": result}


@router.put("/{content_id}")
async def update_content(content_id: str, body: ContentUpdate, user: CreatorUser):
    svc = _svc()
    result = await svc.update_content(content_id, body, user.uid)
    return {"data": result}


@router.delete("/{content_id}", status_code=204)
async def delete_content(content_id: str, user: CreatorUser):
    svc = _svc()
    await svc.delete_content(content_id, user.uid, is_admin=user.is_admin)


@router.post("/{content_id}/publish")
async def publish_content(content_id: str, user: CreatorUser):
    svc = _svc()
    result = await svc.publish_content(content_id, user.uid)
    return {"data": result}


@router.post("/{content_id}/unpublish")
async def unpublish_content(content_id: str, user: CreatorUser):
    svc = _svc()
    result = await svc.unpublish_content(content_id, user.uid)
    return {"data": result}


@router.get("/{content_id}/versions")
async def get_versions(content_id: str, user: CreatorUser):
    svc = _svc()
    versions = await svc.get_versions(content_id)
    return {"data": versions}


@router.post("/{content_id}/versions/{version_id}/restore")
async def restore_version(content_id: str, version_id: str, user: CreatorUser):
    svc = _svc()
    versions = await svc.get_versions(content_id)
    target = next((v for v in versions if v["version_id"] == version_id), None)
    if not target:
        from app.core.exceptions import NotFoundException
        raise NotFoundException("Version")

    result = await svc.update_content(
        content_id,
        ContentUpdate(body_markdown=target.get("body_markdown"), title=target.get("title")),
        user.uid,
    )
    return {"data": result}
