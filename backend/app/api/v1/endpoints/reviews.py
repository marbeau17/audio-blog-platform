"""Review/rating endpoints."""

from fastapi import APIRouter, Query

from app.core.security import CurrentUser, OptionalUser
from app.schemas import ReviewCreate, ReviewUpdate
from app.services import get_review_service
from app.services.review_service import ReviewService

router = APIRouter()


def _svc() -> ReviewService:
    return get_review_service()


@router.post("/contents/{content_id}/reviews", status_code=201)
async def create_review(content_id: str, body: ReviewCreate, user: CurrentUser):
    svc = _svc()
    result = await svc.create_review(content_id, body, user.uid, user.display_name)
    return {"data": result}


@router.get("/contents/{content_id}/reviews")
async def list_reviews(
    content_id: str,
    cursor: str | None = None,
    limit: int = Query(20, ge=1, le=50),
):
    svc = _svc()
    items, next_cursor = await svc.get_reviews(content_id, cursor=cursor, limit=limit)
    return {
        "data": items,
        "pagination": {"cursor": next_cursor, "has_more": next_cursor is not None, "limit": limit},
    }


@router.put("/contents/{content_id}/reviews/{review_id}")
async def update_review(content_id: str, review_id: str, body: ReviewUpdate, user: CurrentUser):
    svc = _svc()
    result = await svc.update_review(content_id, review_id, body, user.uid)
    return {"data": result}


@router.delete("/contents/{content_id}/reviews/{review_id}", status_code=204)
async def delete_review(content_id: str, review_id: str, user: CurrentUser):
    svc = _svc()
    await svc.delete_review(content_id, review_id, user.uid, is_admin=user.is_admin)
