"""Firebase Admin SDK initialization."""

from __future__ import annotations

import firebase_admin
from firebase_admin import credentials, firestore, auth, storage
from google.cloud.firestore_v1 import AsyncClient
from app.core.config import get_settings

_app: firebase_admin.App | None = None


def init_firebase() -> firebase_admin.App:
    """Initialize Firebase Admin SDK (singleton)."""
    global _app
    if _app is not None:
        return _app

    settings = get_settings()

    if settings.FIREBASE_SERVICE_ACCOUNT_PATH:
        cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
    else:
        cred = credentials.ApplicationDefault()

    _app = firebase_admin.initialize_app(
        cred,
        {
            "projectId": settings.FIREBASE_PROJECT_ID,
            "storageBucket": settings.FIREBASE_STORAGE_BUCKET,
        },
    )
    return _app


def get_firestore_client() -> firestore.firestore.Client:
    """Get synchronous Firestore client."""
    init_firebase()
    return firestore.client()


def get_async_firestore_client() -> AsyncClient:
    """Get async Firestore client."""
    app = init_firebase()
    # firebase_admin.firestore.async_client() may not exist in older versions
    if hasattr(firestore, 'async_client'):
        return firestore.async_client()
    # Fallback: create AsyncClient directly from app credentials
    from google.cloud.firestore_v1 import AsyncClient as _AsyncClient
    settings = get_settings()
    return _AsyncClient(
        project=settings.FIREBASE_PROJECT_ID,
        credentials=app.credential.get_credential(),
    )


def get_auth_client():
    """Get Firebase Auth client."""
    init_firebase()
    return auth


def get_storage_bucket():
    """Get Firebase Storage bucket."""
    init_firebase()
    settings = get_settings()
    return storage.bucket(settings.FIREBASE_STORAGE_BUCKET)
