"""Seed script to create the admin user in Firebase Auth + Firestore.

Usage:
    python -m scripts.seed_admin

Requires:
    - Firebase Admin SDK credentials (FIREBASE_SERVICE_ACCOUNT_PATH or default credentials)
    - FIREBASE_PROJECT_ID environment variable
"""

import os
import sys
from datetime import datetime, timezone

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import firebase_admin
from firebase_admin import auth, credentials, firestore

# ──── Configuration ─────────────────────────────────
ADMIN_EMAIL = "marbeau17@gmail.com"
ADMIN_PASSWORD = "Admin@2026!"  # Change this after first login
ADMIN_DISPLAY_NAME = "Admin"
# ────────────────────────────────────────────────────


def main():
    # Initialize Firebase
    project_id = os.environ.get("FIREBASE_PROJECT_ID", "demo-audio-blog")
    sa_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH")

    if sa_path and os.path.exists(sa_path):
        cred = credentials.Certificate(sa_path)
    else:
        cred = credentials.ApplicationDefault() if not os.environ.get("FIRESTORE_EMULATOR_HOST") else None

    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred, {
            "projectId": project_id,
            "storageBucket": f"{project_id}.appspot.com",
        })

    db = firestore.client()

    # Create or update Firebase Auth user
    try:
        user_record = auth.get_user_by_email(ADMIN_EMAIL)
        print(f"User already exists: {user_record.uid}")
    except auth.UserNotFoundError:
        user_record = auth.create_user(
            email=ADMIN_EMAIL,
            password=ADMIN_PASSWORD,
            display_name=ADMIN_DISPLAY_NAME,
            email_verified=True,
        )
        print(f"Created user: {user_record.uid}")

    # Set admin custom claims
    auth.set_custom_user_claims(user_record.uid, {
        "role": "admin",
        "adminLevel": 1,
    })
    print(f"Set admin claims for: {ADMIN_EMAIL}")

    # Create/update Firestore profile
    now = datetime.now(timezone.utc)
    user_doc = {
        "uid": user_record.uid,
        "email": ADMIN_EMAIL,
        "display_name": ADMIN_DISPLAY_NAME,
        "avatar_url": None,
        "bio": "Platform Administrator",
        "role": "admin",
        "preferences": {
            "default_playback_speed": 1.0,
            "auto_play_next": True,
            "email_notifications": True,
            "push_notifications": False,
            "preferred_language": "ja",
        },
        "creator_profile": {
            "stripe_account_id": None,
            "stripe_onboarding_complete": False,
            "charges_enabled": False,
            "total_earnings": 0,
            "content_count": 0,
            "follower_count": 0,
            "verified_at": None,
        },
        "created_at": now,
        "updated_at": now,
        "last_login_at": now,
        "is_active": True,
        "is_suspended": False,
        "suspended_reason": None,
    }

    db.collection("users").document(user_record.uid).set(user_doc, merge=True)
    print(f"Firestore profile created/updated for: {ADMIN_EMAIL}")

    # Seed default categories
    categories = [
        {"category_id": "technology", "name": "テクノロジー", "slug": "technology", "parent_id": None, "order": 1},
        {"category_id": "business", "name": "ビジネス", "slug": "business", "parent_id": None, "order": 2},
        {"category_id": "self-improvement", "name": "自己啓発", "slug": "self-improvement", "parent_id": None, "order": 3},
        {"category_id": "lifestyle", "name": "ライフスタイル", "slug": "lifestyle", "parent_id": None, "order": 4},
        {"category_id": "science", "name": "サイエンス", "slug": "science", "parent_id": None, "order": 5},
        {"category_id": "education", "name": "教育", "slug": "education", "parent_id": None, "order": 6},
        {"category_id": "entertainment", "name": "エンタメ", "slug": "entertainment", "parent_id": None, "order": 7},
        {"category_id": "health", "name": "健康", "slug": "health", "parent_id": None, "order": 8},
    ]

    for cat in categories:
        db.collection("categories").document(cat["category_id"]).set(cat, merge=True)
    print(f"Seeded {len(categories)} categories")

    # Seed system config
    db.collection("system_config").document("platform").set({
        "platform_fee_percent": 20.0,
        "min_payout_amount": 1000,
        "supported_currencies": ["JPY", "USD"],
        "tts_enabled": True,
        "maintenance_mode": False,
        "updated_at": now,
        "updated_by": user_record.uid,
    }, merge=True)
    print("System config seeded")

    print("\n" + "=" * 50)
    print("Admin user setup complete!")
    print(f"  Email:    {ADMIN_EMAIL}")
    print(f"  Password: {ADMIN_PASSWORD}")
    print(f"  Role:     admin")
    print(f"  UID:      {user_record.uid}")
    print("=" * 50)
    print("\nIMPORTANT: Change the password after first login!")


if __name__ == "__main__":
    main()
