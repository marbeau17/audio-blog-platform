"""Payment service with Stripe Connect integration."""

import stripe
from datetime import datetime, timezone
from google.cloud.firestore_v1 import AsyncClient
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.exceptions import (
    NotFoundException, ConflictException, ForbiddenException, UpstreamException,
)

logger = get_logger(__name__)


class PaymentService:
    def __init__(self, db: AsyncClient):
        self.db = db
        self.settings = get_settings()
        stripe.api_key = self.settings.STRIPE_SECRET_KEY

    # ─── Purchase Flow ────────────────────────────────

    async def check_purchase(self, user_id: str, content_id: str) -> bool:
        """Check if user has already purchased content."""
        purchases_ref = (
            self.db.collection("users").document(user_id)
            .collection("purchases").document(content_id)
        )
        doc = await purchases_ref.get()
        return doc.exists and doc.to_dict().get("access_granted", False)

    async def create_payment_intent(self, user_id: str, content_id: str) -> dict:
        """Create Stripe PaymentIntent for content purchase."""
        # Check if already purchased
        if await self.check_purchase(user_id, content_id):
            raise ConflictException("Content already purchased")

        # Get content details
        content_doc = await self.db.collection("contents").document(content_id).get()
        if not content_doc.exists:
            raise NotFoundException("Content")

        content = content_doc.to_dict()
        if content["pricing"]["type"] == "free":
            raise ConflictException("Cannot purchase free content")

        price = content["pricing"]["price_jpy"]
        creator_id = content["creator_id"]

        # Get creator's Stripe account
        creator_doc = await self.db.collection("users").document(creator_id).get()
        if not creator_doc.exists:
            raise NotFoundException("Creator")

        creator = creator_doc.to_dict()
        stripe_account_id = creator.get("creator_profile", {}).get("stripe_account_id")
        if not stripe_account_id:
            raise UpstreamException("Stripe", "Creator has no connected Stripe account")

        # Calculate fees
        platform_fee = int(price * self.settings.PLATFORM_FEE_PERCENT / 100)

        # Create PaymentIntent with idempotency key
        idempotency_key = f"{user_id}_{content_id}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}"

        try:
            intent = stripe.PaymentIntent.create(
                amount=price,
                currency="jpy",
                payment_method_types=["card"],
                application_fee_amount=platform_fee,
                transfer_data={"destination": stripe_account_id},
                metadata={
                    "buyer_id": user_id,
                    "content_id": content_id,
                    "creator_id": creator_id,
                    "content_title": content["title"][:100],
                },
                idempotency_key=idempotency_key,
            )

            logger.info("payment_intent_created",
                        intent_id=intent.id, content_id=content_id, amount=price)

            return {
                "client_secret": intent.client_secret,
                "payment_intent_id": intent.id,
                "amount": price,
                "currency": "jpy",
            }

        except stripe.StripeError as e:
            logger.error("stripe_error", error=str(e))
            raise UpstreamException("Stripe", str(e))

    async def handle_payment_succeeded(self, payment_intent: dict) -> None:
        """Handle successful payment webhook."""
        metadata = payment_intent.get("metadata", {})
        buyer_id = metadata.get("buyer_id")
        content_id = metadata.get("content_id")
        creator_id = metadata.get("creator_id")

        if not all([buyer_id, content_id, creator_id]):
            logger.warning("webhook_missing_metadata", intent_id=payment_intent["id"])
            return

        amount = payment_intent["amount"]
        platform_fee = payment_intent.get("application_fee_amount", 0)
        stripe_fee = int(amount * 0.036)  # Approximate
        seller_earnings = amount - platform_fee

        now = datetime.now(timezone.utc)

        # Create transaction record
        tx_ref = self.db.collection("transactions").document()
        await tx_ref.set({
            "buyer_id": buyer_id,
            "seller_id": creator_id,
            "content_id": content_id,
            "type": "purchase",
            "amount": amount,
            "currency": "JPY",
            "platform_fee": platform_fee,
            "stripe_fee": stripe_fee,
            "seller_earnings": seller_earnings,
            "stripe_payment_intent_id": payment_intent["id"],
            "stripe_charge_id": payment_intent.get("latest_charge"),
            "status": "completed",
            "created_at": now,
            "completed_at": now,
        })

        # Create purchase record for buyer
        content_doc = await self.db.collection("contents").document(content_id).get()
        content_data = content_doc.to_dict() if content_doc.exists else {}

        await (
            self.db.collection("users").document(buyer_id)
            .collection("purchases").document(content_id)
            .set({
                "purchase_id": tx_ref.id,
                "content_id": content_id,
                "transaction_id": tx_ref.id,
                "content_title": content_data.get("title", ""),
                "content_thumbnail_url": content_data.get("thumbnail_url"),
                "creator_id": creator_id,
                "creator_display_name": content_data.get("creator_display_name", ""),
                "price_jpy": amount,
                "purchased_at": now,
                "access_granted": True,
                "access_revoked_at": None,
            })
        )

        # Update content stats
        await self.db.collection("contents").document(content_id).update({
            "stats.purchase_count": content_data.get("stats", {}).get("purchase_count", 0) + 1,
            "stats.total_revenue": content_data.get("stats", {}).get("total_revenue", 0) + amount,
        })

        logger.info("purchase_completed",
                     tx_id=tx_ref.id, buyer=buyer_id, content=content_id, amount=amount)

    async def handle_payment_failed(self, payment_intent: dict) -> None:
        """Handle failed payment webhook."""
        logger.warning("payment_failed", intent_id=payment_intent["id"])

    async def handle_refund(self, charge: dict) -> None:
        """Handle refund webhook."""
        intent_id = charge.get("payment_intent")
        if not intent_id:
            return

        # Find original transaction
        query = (
            self.db.collection("transactions")
            .where("stripe_payment_intent_id", "==", intent_id)
            .limit(1)
        )
        docs = [doc async for doc in query.stream()]
        if not docs:
            logger.warning("refund_transaction_not_found", intent_id=intent_id)
            return

        tx = docs[0]
        tx_data = tx.to_dict()
        now = datetime.now(timezone.utc)

        # Update transaction
        await tx.reference.update({
            "status": "refunded",
            "refund": {
                "reason": charge.get("reason", "requested_by_customer"),
                "refunded_amount": charge.get("amount_refunded", tx_data["amount"]),
                "stripe_refund_id": charge.get("refunds", {}).get("data", [{}])[0].get("id", ""),
                "refunded_at": now,
                "processed_by": "system",
            },
        })

        # Revoke access
        await (
            self.db.collection("users").document(tx_data["buyer_id"])
            .collection("purchases").document(tx_data["content_id"])
            .update({
                "access_granted": False,
                "access_revoked_at": now,
            })
        )

        logger.info("refund_processed", tx_id=tx.id, buyer=tx_data["buyer_id"])

    # ─── Stripe Connect Onboarding ────────────────────

    async def create_onboarding_link(self, user_id: str) -> str:
        """Create or retrieve Stripe Connect onboarding link."""
        user_doc = await self.db.collection("users").document(user_id).get()
        if not user_doc.exists:
            raise NotFoundException("User")

        user_data = user_doc.to_dict()
        stripe_account_id = user_data.get("creator_profile", {}).get("stripe_account_id")

        if not stripe_account_id:
            # Create new Connect account
            account = stripe.Account.create(
                type="express",
                country="JP",
                capabilities={"card_payments": {"requested": True}, "transfers": {"requested": True}},
                metadata={"user_id": user_id},
            )
            stripe_account_id = account.id
            await self.db.collection("users").document(user_id).update({
                "creator_profile.stripe_account_id": stripe_account_id,
            })

        # Create onboarding link
        link = stripe.AccountLink.create(
            account=stripe_account_id,
            refresh_url=f"{self.settings.ALLOWED_ORIGINS[0]}/creator/stripe/refresh",
            return_url=f"{self.settings.ALLOWED_ORIGINS[0]}/creator/stripe/complete",
            type="account_onboarding",
        )
        return link.url

    async def get_stripe_status(self, user_id: str) -> dict:
        """Get Stripe Connect account status."""
        user_doc = await self.db.collection("users").document(user_id).get()
        if not user_doc.exists:
            raise NotFoundException("User")

        profile = user_doc.to_dict().get("creator_profile", {})
        stripe_id = profile.get("stripe_account_id")
        if not stripe_id:
            return {"connected": False}

        try:
            account = stripe.Account.retrieve(stripe_id)
            return {
                "connected": True,
                "charges_enabled": account.charges_enabled,
                "payouts_enabled": account.payouts_enabled,
                "details_submitted": account.details_submitted,
            }
        except stripe.StripeError:
            return {"connected": False, "error": True}

    # ─── Tips ─────────────────────────────────────────

    async def create_tip(self, user_id: str, creator_id: str, amount: int, content_id: str | None) -> dict:
        """Create a tip/donation PaymentIntent."""
        creator_doc = await self.db.collection("users").document(creator_id).get()
        if not creator_doc.exists:
            raise NotFoundException("Creator")

        stripe_account_id = creator_doc.to_dict().get("creator_profile", {}).get("stripe_account_id")
        if not stripe_account_id:
            raise UpstreamException("Stripe", "Creator has no connected account")

        platform_fee = int(amount * self.settings.PLATFORM_FEE_PERCENT / 100)

        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency="jpy",
            payment_method_types=["card"],
            application_fee_amount=platform_fee,
            transfer_data={"destination": stripe_account_id},
            metadata={
                "buyer_id": user_id,
                "creator_id": creator_id,
                "content_id": content_id or "",
                "type": "tip",
            },
        )

        return {
            "client_secret": intent.client_secret,
            "payment_intent_id": intent.id,
            "amount": amount,
            "currency": "jpy",
        }

    # ─── Purchase History ─────────────────────────────

    async def get_purchases(self, user_id: str, cursor: str | None = None, limit: int = 20) -> tuple[list[dict], str | None]:
        """Get user's purchase history."""
        query = (
            self.db.collection("users").document(user_id)
            .collection("purchases")
            .order_by("purchased_at", direction="DESCENDING")
        )
        if cursor:
            cursor_doc = await query.document(cursor).get()
            if cursor_doc.exists:
                query = query.start_after(cursor_doc)

        query = query.limit(limit + 1)
        docs = [doc async for doc in query.stream()]

        has_more = len(docs) > limit
        items = docs[:limit]
        next_cursor = items[-1].id if has_more and items else None

        return [{"purchase_id": d.id, **d.to_dict()} for d in items], next_cursor
