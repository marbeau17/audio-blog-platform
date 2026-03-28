"""Admin service - user management and content moderation."""

from datetime import datetime, timezone
from firebase_admin import auth
from google.cloud.firestore_v1 import AsyncClient, FieldFilter

from app.core.logging import get_logger
from app.core.exceptions import NotFoundException
from app.core.firebase import init_firebase

logger = get_logger(__name__)


class AdminService:
    def __init__(self, db: AsyncClient):
        self.db = db

    async def list_users(
        self, role: str | None = None, cursor: str | None = None, limit: int = 20
    ) -> tuple[list[dict], str | None]:
        """List users with optional role filter."""
        query = self.db.collection("users").order_by("created_at", direction="DESCENDING")
        if role:
            query = query.where(filter=FieldFilter("role", "==", role))
        if cursor:
            cursor_doc = await self.db.collection("users").document(cursor).get()
            if cursor_doc.exists:
                query = query.start_after(cursor_doc)
        query = query.limit(limit + 1)

        docs = [doc async for doc in query.stream()]
        has_more = len(docs) > limit
        items = docs[:limit]
        next_cursor = items[-1].id if has_more and items else None

        return [{"uid": d.id, **d.to_dict()} for d in items], next_cursor

    async def update_user_role(self, user_id: str, new_role: str) -> dict:
        """Change user role and update Firebase Custom Claims."""
        doc_ref = self.db.collection("users").document(user_id)
        doc = await doc_ref.get()
        if not doc.exists:
            raise NotFoundException("User")

        init_firebase()
        auth.set_custom_user_claims(user_id, {"role": new_role})

        await doc_ref.update({
            "role": new_role,
            "updated_at": datetime.now(timezone.utc),
        })

        logger.info("role_updated", user_id=user_id, new_role=new_role)
        return {"uid": user_id, "role": new_role}

    async def suspend_user(self, user_id: str, reason: str) -> dict:
        """Suspend user account."""
        doc_ref = self.db.collection("users").document(user_id)
        doc = await doc_ref.get()
        if not doc.exists:
            raise NotFoundException("User")

        init_firebase()
        auth.update_user(user_id, disabled=True)

        await doc_ref.update({
            "is_suspended": True,
            "suspended_reason": reason,
            "updated_at": datetime.now(timezone.utc),
        })

        logger.info("user_suspended", user_id=user_id, reason=reason)
        return {"uid": user_id, "suspended": True}

    async def unsuspend_user(self, user_id: str) -> dict:
        """Restore suspended user."""
        doc_ref = self.db.collection("users").document(user_id)
        doc = await doc_ref.get()
        if not doc.exists:
            raise NotFoundException("User")

        init_firebase()
        auth.update_user(user_id, disabled=False)

        await doc_ref.update({
            "is_suspended": False,
            "suspended_reason": None,
            "updated_at": datetime.now(timezone.utc),
        })

        logger.info("user_unsuspended", user_id=user_id)
        return {"uid": user_id, "suspended": False}

    async def list_flagged_contents(self, cursor: str | None = None, limit: int = 20) -> tuple[list[dict], str | None]:
        """List contents flagged for moderation."""
        query = (
            self.db.collection("reports")
            .where(filter=FieldFilter("status", "==", "pending"))
            .order_by("created_at", direction="DESCENDING")
        )
        if cursor:
            cursor_doc = await self.db.collection("reports").document(cursor).get()
            if cursor_doc.exists:
                query = query.start_after(cursor_doc)
        query = query.limit(limit + 1)

        docs = [doc async for doc in query.stream()]
        has_more = len(docs) > limit
        items = docs[:limit]
        next_cursor = items[-1].id if has_more and items else None

        return [{"report_id": d.id, **d.to_dict()} for d in items], next_cursor

    async def moderate_content(self, content_id: str, action: str, reason: str, admin_id: str) -> dict:
        """Approve, reject, or flag content."""
        doc_ref = self.db.collection("contents").document(content_id)
        doc = await doc_ref.get()
        if not doc.exists:
            raise NotFoundException("Content")

        now = datetime.now(timezone.utc)

        if action == "reject":
            await doc_ref.update({
                "status": "archived",
                "moderation": {"action": "rejected", "reason": reason, "by": admin_id, "at": now},
                "updated_at": now,
            })
        elif action == "approve":
            await doc_ref.update({
                "moderation": {"action": "approved", "reason": reason, "by": admin_id, "at": now},
                "updated_at": now,
            })
        elif action == "flag":
            await doc_ref.update({
                "moderation": {"action": "flagged", "reason": reason, "by": admin_id, "at": now},
                "updated_at": now,
            })

        # Resolve related reports
        reports_query = (
            self.db.collection("reports")
            .where(filter=FieldFilter("content_id", "==", content_id))
            .where(filter=FieldFilter("status", "==", "pending"))
        )
        async for report in reports_query.stream():
            await report.reference.update({"status": "resolved", "resolved_at": now, "resolved_by": admin_id})

        logger.info("content_moderated", content_id=content_id, action=action, admin=admin_id)
        return {"content_id": content_id, "action": action}

    async def get_platform_analytics(self) -> dict:
        """Get platform-wide analytics summary."""
        # User counts by role
        users_ref = self.db.collection("users")
        total_users = len([d async for d in users_ref.select([]).stream()])

        creators_query = users_ref.where(filter=FieldFilter("role", "==", "creator"))
        total_creators = len([d async for d in creators_query.select([]).stream()])

        # Content counts
        contents_ref = self.db.collection("contents").where(filter=FieldFilter("is_deleted", "==", False))
        contents = [doc async for doc in contents_ref.stream()]
        published = [c for c in contents if c.to_dict().get("status") == "published"]

        total_revenue = sum(c.to_dict().get("stats", {}).get("total_revenue", 0) for c in contents)
        total_plays = sum(c.to_dict().get("stats", {}).get("play_count", 0) for c in contents)

        return {
            "users": {"total": total_users, "creators": total_creators, "listeners": total_users - total_creators},
            "content": {"total": len(contents), "published": len(published)},
            "revenue": {"total": total_revenue, "currency": "JPY"},
            "engagement": {"total_plays": total_plays},
        }

    async def get_system_health(self) -> dict:
        """Check system health for all dependencies."""
        health = {"firestore": "healthy", "tts": "unknown", "stripe": "unknown", "gcs": "unknown"}

        # Firestore check
        try:
            await self.db.collection("system_config").document("health_check").get()
        except Exception:
            health["firestore"] = "unhealthy"

        return health
