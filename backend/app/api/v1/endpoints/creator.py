"""Creator dashboard endpoints."""

from fastapi import APIRouter, Query

from app.core.security import CreatorUser
from app.services import get_creator_service, get_payment_service

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard(user: CreatorUser):
    """Get creator dashboard summary."""
    svc = get_creator_service()
    result = await svc.get_dashboard_summary(user.uid)
    return {"data": result}


@router.get("/analytics")
async def get_analytics(
    user: CreatorUser,
    period: str = Query("30d"),
    content_id: str | None = None,
    metric: str = Query("all"),
    granularity: str = Query("daily"),
):
    """Get detailed analytics."""
    svc = get_creator_service()
    result = await svc.get_analytics(
        user.uid, period=period, content_id=content_id,
        metric=metric, granularity=granularity,
    )
    return {"data": result}


@router.get("/earnings")
async def get_earnings(user: CreatorUser):
    """Get earnings detail."""
    svc = get_creator_service()
    result = await svc.get_earnings(user.uid)
    return {"data": result}


@router.get("/earnings/export")
async def export_earnings(user: CreatorUser, format: str = Query("csv")):
    """Export earnings as CSV."""
    svc = get_creator_service()
    result = await svc.get_earnings(user.uid)

    if format == "csv":
        import csv
        import io
        from fastapi.responses import StreamingResponse

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Transaction ID", "Type", "Amount", "Earnings", "Date"])
        for tx in result.get("recent_transactions", []):
            writer.writerow([
                tx.get("transaction_id", ""),
                tx.get("type", ""),
                tx.get("amount", 0),
                tx.get("seller_earnings", 0),
                str(tx.get("created_at", "")),
            ])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=earnings.csv"},
        )

    return {"data": result}


@router.post("/stripe/onboard")
async def stripe_onboard(user: CreatorUser):
    """Get Stripe Connect onboarding URL."""
    svc = get_payment_service()
    url = await svc.create_onboarding_link(user.uid)
    return {"data": {"onboarding_url": url}}


@router.get("/stripe/status")
async def stripe_status(user: CreatorUser):
    """Get Stripe Connect account status."""
    svc = get_payment_service()
    result = await svc.get_stripe_status(user.uid)
    return {"data": result}
