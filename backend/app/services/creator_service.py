"""Creator dashboard and analytics service."""

from datetime import datetime, timezone, timedelta
from google.cloud.firestore_v1 import AsyncClient, FieldFilter

from app.core.logging import get_logger
from app.core.exceptions import NotFoundException

logger = get_logger(__name__)


class CreatorService:
    def __init__(self, db: AsyncClient):
        self.db = db

    async def get_dashboard_summary(self, creator_id: str) -> dict:
        """Aggregate dashboard summary for creator."""
        user_doc = await self.db.collection("users").document(creator_id).get()
        if not user_doc.exists:
            raise NotFoundException("Creator")

        profile = user_doc.to_dict().get("creator_profile", {})

        # Content count
        content_query = (
            self.db.collection("contents")
            .where(filter=FieldFilter("creator_id", "==", creator_id))
            .where(filter=FieldFilter("is_deleted", "==", False))
        )
        contents = [doc async for doc in content_query.stream()]

        total_plays = sum(c.to_dict().get("stats", {}).get("play_count", 0) for c in contents)
        total_purchases = sum(c.to_dict().get("stats", {}).get("purchase_count", 0) for c in contents)

        # Recent earnings (last 30 days)
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        tx_query = (
            self.db.collection("transactions")
            .where(filter=FieldFilter("seller_id", "==", creator_id))
            .where(filter=FieldFilter("status", "==", "completed"))
            .where(filter=FieldFilter("created_at", ">=", thirty_days_ago))
            .order_by("created_at", direction="DESCENDING")
        )
        recent_tx = [doc async for doc in tx_query.stream()]
        recent_earnings_total = sum(t.to_dict().get("seller_earnings", 0) for t in recent_tx)

        # Daily earnings breakdown
        daily_earnings: dict[str, float] = {}
        for tx in recent_tx:
            tx_data = tx.to_dict()
            day_key = tx_data["created_at"].strftime("%Y-%m-%d")
            daily_earnings[day_key] = daily_earnings.get(day_key, 0) + tx_data.get("seller_earnings", 0)

        recent_earnings_list = [
            {"date": k, "amount": v} for k, v in sorted(daily_earnings.items(), reverse=True)
        ]

        # Top content by revenue
        top_content = sorted(
            [{"content_id": c.id, "title": c.to_dict().get("title", ""),
              "revenue": c.to_dict().get("stats", {}).get("total_revenue", 0),
              "plays": c.to_dict().get("stats", {}).get("play_count", 0)}
             for c in contents],
            key=lambda x: x["revenue"], reverse=True,
        )[:10]

        return {
            "total_earnings": profile.get("total_earnings", 0),
            "pending_earnings": recent_earnings_total,
            "total_content": len(contents),
            "total_plays": total_plays,
            "total_purchases": total_purchases,
            "recent_earnings": recent_earnings_list[:30],
            "top_content": top_content,
        }

    async def get_analytics(
        self,
        creator_id: str,
        period: str = "30d",
        content_id: str | None = None,
        metric: str = "all",
        granularity: str = "daily",
    ) -> dict:
        """Get detailed analytics for creator."""
        period_map = {"7d": 7, "30d": 30, "90d": 90, "1y": 365, "all": 3650}
        days = period_map.get(period, 30)
        start_date = datetime.now(timezone.utc) - timedelta(days=days)

        # Transactions in period
        tx_query = (
            self.db.collection("transactions")
            .where(filter=FieldFilter("seller_id", "==", creator_id))
            .where(filter=FieldFilter("status", "==", "completed"))
            .where(filter=FieldFilter("created_at", ">=", start_date))
        )
        if content_id:
            tx_query = tx_query.where(filter=FieldFilter("content_id", "==", content_id))

        transactions = [doc async for doc in tx_query.stream()]

        # Aggregate by granularity
        fmt_map = {"hourly": "%Y-%m-%dT%H", "daily": "%Y-%m-%d", "weekly": "%Y-W%W", "monthly": "%Y-%m"}
        fmt = fmt_map.get(granularity, "%Y-%m-%d")

        time_series: dict[str, dict] = {}
        for tx in transactions:
            tx_data = tx.to_dict()
            key = tx_data["created_at"].strftime(fmt)
            if key not in time_series:
                time_series[key] = {"period": key, "revenue": 0, "purchases": 0, "tips": 0}
            if tx_data.get("type") == "tip":
                time_series[key]["tips"] += tx_data.get("seller_earnings", 0)
            else:
                time_series[key]["revenue"] += tx_data.get("seller_earnings", 0)
            time_series[key]["purchases"] += 1

        return {
            "period": period,
            "granularity": granularity,
            "content_id": content_id,
            "summary": {
                "total_revenue": sum(t.to_dict().get("seller_earnings", 0) for t in transactions),
                "total_transactions": len(transactions),
            },
            "time_series": sorted(time_series.values(), key=lambda x: x["period"]),
        }

    async def get_earnings(self, creator_id: str) -> dict:
        """Get earnings detail with exportable data."""
        user_doc = await self.db.collection("users").document(creator_id).get()
        if not user_doc.exists:
            raise NotFoundException("Creator")

        profile = user_doc.to_dict().get("creator_profile", {})

        # All completed transactions
        tx_query = (
            self.db.collection("transactions")
            .where(filter=FieldFilter("seller_id", "==", creator_id))
            .where(filter=FieldFilter("status", "==", "completed"))
            .order_by("created_at", direction="DESCENDING")
            .limit(100)
        )
        transactions = []
        async for doc in tx_query.stream():
            td = doc.to_dict()
            td["transaction_id"] = doc.id
            transactions.append(td)

        return {
            "total_earnings": profile.get("total_earnings", 0),
            "charges_enabled": profile.get("charges_enabled", False),
            "recent_transactions": transactions,
        }
