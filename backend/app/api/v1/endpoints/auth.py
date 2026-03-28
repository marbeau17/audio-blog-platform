"""Auth endpoints - registration, login, profile management."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from firebase_admin import auth

from app.core.security import CurrentUser
from app.core.firebase import init_firebase, get_async_firestore_client
from app.core.exceptions import ConflictException, ValidationException
from app.schemas import UserProfileUpdate, UserProfileResponse, CreatorUpgradeRequest

router = APIRouter()


@router.post("/register")
async def register(email: str, password: str, display_name: str = ""):
    """Register new user via Firebase Auth + create Firestore profile."""
    init_firebase()
    try:
        user_record = auth.create_user(email=email, password=password, display_name=display_name)
    except auth.EmailAlreadyExistsError:
        raise ConflictException("Email already registered")

    auth.set_custom_user_claims(user_record.uid, {"role": "listener"})

    db = get_async_firestore_client()
    now = datetime.now(timezone.utc)
    await db.collection("users").document(user_record.uid).set({
        "uid": user_record.uid,
        "email": email,
        "display_name": display_name or email.split("@")[0],
        "avatar_url": None,
        "bio": "",
        "role": "listener",
        "preferences": {
            "default_playback_speed": 1.0,
            "auto_play_next": True,
            "email_notifications": True,
            "push_notifications": False,
            "preferred_language": "ja",
        },
        "created_at": now,
        "updated_at": now,
        "last_login_at": now,
        "is_active": True,
        "is_suspended": False,
        "suspended_reason": None,
    })

    return {"data": {"uid": user_record.uid, "email": email, "role": "listener"}}


@router.post("/login")
async def login():
    """Login is handled client-side via Firebase Auth SDK.
    This endpoint exists for server-side custom token generation if needed."""
    return {"data": {"message": "Use Firebase Auth SDK for client-side login. Send ID token in Authorization header for API calls."}}


@router.get("/me")
async def get_me(user: CurrentUser):
    """Get current user profile."""
    db = get_async_firestore_client()
    doc = await db.collection("users").document(user.uid).get()
    if not doc.exists:
        return {"data": {"uid": user.uid, "email": user.email, "role": user.role}}
    data = doc.to_dict()
    return {"data": data}


@router.put("/me")
async def update_me(user: CurrentUser, body: UserProfileUpdate):
    """Update current user profile."""
    db = get_async_firestore_client()
    update_data = body.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc)
    await db.collection("users").document(user.uid).update(update_data)
    doc = await db.collection("users").document(user.uid).get()
    return {"data": doc.to_dict()}


@router.post("/upgrade-to-creator")
async def upgrade_to_creator(user: CurrentUser, body: CreatorUpgradeRequest):
    """Request upgrade to creator role."""
    if user.role != "listener":
        raise ConflictException("Already a creator or admin")
    if not body.agree_to_terms:
        raise ValidationException("Must agree to creator terms")

    db = get_async_firestore_client()
    now = datetime.now(timezone.utc)

    await db.collection("users").document(user.uid).update({
        "role": "creator",
        "creator_profile": {
            "stripe_account_id": None,
            "stripe_onboarding_complete": False,
            "charges_enabled": False,
            "total_earnings": 0,
            "content_count": 0,
            "follower_count": 0,
            "verified_at": None,
        },
        "updated_at": now,
    })

    init_firebase()
    auth.set_custom_user_claims(user.uid, {"role": "creator"})

    return {"data": {"uid": user.uid, "role": "creator", "message": "Upgraded to creator. Please re-login to refresh token."}}


@router.delete("/me")
async def delete_account(user: CurrentUser):
    """Delete user account (soft delete + anonymize)."""
    db = get_async_firestore_client()
    now = datetime.now(timezone.utc)
    await db.collection("users").document(user.uid).update({
        "is_active": False,
        "email": f"deleted_{user.uid}@deleted.local",
        "display_name": "Deleted User",
        "bio": "",
        "avatar_url": None,
        "updated_at": now,
    })

    init_firebase()
    auth.update_user(user.uid, disabled=True)

    return {"data": {"deleted": True}}
