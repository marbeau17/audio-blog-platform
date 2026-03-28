"""Payment and purchase endpoints."""

from __future__ import annotations

import stripe
from fastapi import APIRouter, Request, Query

from app.core.config import get_settings
from app.core.security import CurrentUser
from app.core.exceptions import UnauthorizedException
from app.core.logging import get_logger
from app.schemas import PaymentIntentCreate, TipCreate, RefundRequest
from app.services import get_payment_service

logger = get_logger(__name__)
router = APIRouter()


@router.post("/create-intent")
async def create_payment_intent(body: PaymentIntentCreate, user: CurrentUser):
    """Create Stripe PaymentIntent for content purchase."""
    svc = get_payment_service()
    result = await svc.create_payment_intent(user.uid, body.content_id)
    return {"data": result}


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    settings = get_settings()
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except (ValueError, stripe.SignatureVerificationError) as e:
        logger.warning("webhook_signature_invalid", error=str(e))
        raise UnauthorizedException("Invalid webhook signature")

    svc = get_payment_service()

    if event["type"] == "payment_intent.succeeded":
        await svc.handle_payment_succeeded(event["data"]["object"])
    elif event["type"] == "payment_intent.payment_failed":
        await svc.handle_payment_failed(event["data"]["object"])
    elif event["type"] == "charge.refunded":
        await svc.handle_refund(event["data"]["object"])
    elif event["type"] == "account.updated":
        # Update creator Stripe status
        account = event["data"]["object"]
        user_id = account.get("metadata", {}).get("user_id")
        if user_id:
            from app.core.firebase import get_async_firestore_client
            db = get_async_firestore_client()
            await db.collection("users").document(user_id).update({
                "creator_profile.charges_enabled": account.get("charges_enabled", False),
                "creator_profile.stripe_onboarding_complete": account.get("details_submitted", False),
            })
    else:
        logger.info("webhook_unhandled_event", event_type=event["type"])

    return {"received": True}


@router.get("/purchases")
async def list_purchases(
    user: CurrentUser,
    cursor: str | None = None,
    limit: int = Query(20, ge=1, le=50),
):
    """Get user's purchase history."""
    svc = get_payment_service()
    items, next_cursor = await svc.get_purchases(user.uid, cursor=cursor, limit=limit)
    return {
        "data": items,
        "pagination": {"cursor": next_cursor, "has_more": next_cursor is not None, "limit": limit},
    }


@router.get("/purchases/{content_id}/check")
async def check_purchase(content_id: str, user: CurrentUser):
    """Check if content is purchased."""
    svc = get_payment_service()
    purchased = await svc.check_purchase(user.uid, content_id)
    return {"data": {"content_id": content_id, "purchased": purchased}}


@router.post("/tip")
async def send_tip(body: TipCreate, user: CurrentUser):
    """Send a tip/donation to creator."""
    svc = get_payment_service()
    result = await svc.create_tip(user.uid, body.creator_id, body.amount, body.content_id)
    return {"data": result}


@router.post("/refund/{transaction_id}")
async def process_refund(transaction_id: str, body: RefundRequest, user: CurrentUser):
    """Process refund (7-day window for non-admin users; admins can always refund)."""
    svc = get_payment_service()

    # Validate refund eligibility (checks 7-day window for non-admin users)
    await svc.validate_refund_eligibility(transaction_id, user.role)

    from app.core.firebase import get_async_firestore_client
    db = get_async_firestore_client()

    tx_doc = await db.collection("transactions").document(transaction_id).get()
    if not tx_doc.exists:
        from app.core.exceptions import NotFoundException
        raise NotFoundException("Transaction")

    tx = tx_doc.to_dict()
    try:
        refund = stripe.Refund.create(
            payment_intent=tx["stripe_payment_intent_id"],
            reason="requested_by_customer",
        )
        logger.info("refund_created", transaction_id=transaction_id, refund_id=refund.id)
        return {"data": {"refund_id": refund.id, "status": refund.status}}
    except stripe.StripeError as e:
        from app.core.exceptions import UpstreamException
        raise UpstreamException("Stripe", str(e))
