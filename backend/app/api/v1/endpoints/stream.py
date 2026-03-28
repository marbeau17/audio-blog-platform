"""Streaming and playback endpoints."""

from fastapi import APIRouter

from app.core.security import CurrentUser
from app.schemas import PlaybackPositionUpdate, PlayEventCreate
from app.services import get_stream_service

router = APIRouter()


@router.get("/{content_id}/url")
async def get_stream_url(content_id: str, user: CurrentUser):
    """Get signed streaming URL for audio content."""
    svc = get_stream_service()
    result = await svc.get_stream_url(content_id, user.uid)
    return {"data": result}


@router.get("/{content_id}/chapters")
async def get_chapters(content_id: str, user: CurrentUser):
    """Get chapter list for content."""
    svc = get_stream_service()
    chapters = await svc.get_chapters(content_id)
    return {"data": chapters}


@router.get("/{content_id}/position")
async def get_playback_position(content_id: str, user: CurrentUser):
    """Get saved playback position."""
    svc = get_stream_service()
    position = await svc.get_playback_position(content_id, user.uid)
    if position is None:
        return {"data": {"content_id": content_id, "position_seconds": 0}}
    return {"data": position}


@router.put("/{content_id}/position")
async def save_playback_position(content_id: str, body: PlaybackPositionUpdate, user: CurrentUser):
    """Save playback position (called every 5 seconds)."""
    svc = get_stream_service()
    result = await svc.save_playback_position(
        content_id=content_id,
        user_id=user.uid,
        position_seconds=body.position_seconds,
        total_duration_seconds=body.total_duration_seconds,
        playback_speed=body.playback_speed,
        device_id=body.device_id,
    )
    return {"data": result}


@router.post("/{content_id}/play-event")
async def record_play_event(content_id: str, body: PlayEventCreate, user: CurrentUser):
    """Record play event for analytics."""
    svc = get_stream_service()
    await svc.record_play_event(content_id, user.uid, body.event_type, body.position_seconds)
    return {"data": {"recorded": True}}
