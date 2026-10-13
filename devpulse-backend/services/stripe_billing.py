"""
Stripe Billing Service - Real Stripe integration for DevPulse subscriptions.

Handles:
- Customer creation
- Checkout sessions (subscribe)
- Billing portal (manage)
- Webhook event processing
- Subscription lifecycle
"""
import os
import logging
import asyncio
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Lazy Stripe import – graceful fallback if not installed
try:
    import stripe
    STRIPE_AVAILABLE = True
except ImportError:
    stripe = None  # type: ignore
    STRIPE_AVAILABLE = False
    logger.warning("stripe package not installed – billing is disabled")

# ── Configuration ────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

if STRIPE_AVAILABLE and STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

# Price IDs mapped in your Stripe Dashboard
STRIPE_PRICE_IDS = {
    "pro_monthly": os.getenv("STRIPE_PRICE_PRO_MONTHLY", ""),
    "pro_yearly": os.getenv("STRIPE_PRICE_PRO_YEARLY", ""),
    "enterprise_monthly": os.getenv("STRIPE_PRICE_ENT_MONTHLY", ""),
    "enterprise_yearly": os.getenv("STRIPE_PRICE_ENT_YEARLY", ""),
}


class StripeBillingService:
    """Manages all Stripe operations for DevPulse."""

    # ── Customer ─────────────────────────────────────────────────────────────
    @staticmethod
    async def create_customer(email: str, name: str, user_id: int) -> Optional[str]:
        """Create a Stripe customer and return the customer ID."""
        if not STRIPE_AVAILABLE or not STRIPE_SECRET_KEY:
            return None
        try:
            customer = stripe.Customer.create(
                email=email,
                name=name,
                metadata={"devpulse_user_id": str(user_id)},
                idempotency_key=f"devpulse-customer-{user_id}",
            )
            logger.info("Created Stripe customer %s for user %d", customer.id, user_id)
            return customer.id
        except Exception as e:
            logger.error("Stripe create_customer error: %s", e)
            return None

    # ── Checkout Session ─────────────────────────────────────────────────────
    @staticmethod
    async def create_checkout_session(
        customer_id: str,
        plan: str,
        billing_period: str = "monthly",
    ) -> Optional[str]:
        """Create a Stripe Checkout Session and return its URL."""
        price_key = f"{plan}_{billing_period}"
        price_id = STRIPE_PRICE_IDS.get(price_key)
        if not price_id:
            logger.error("Unknown price key: %s", price_key)
            return None

        if not STRIPE_AVAILABLE or not STRIPE_SECRET_KEY:
            return None

        try:
            session = stripe.checkout.Session.create(
                customer=customer_id,
                payment_method_types=["card"],
                line_items=[{"price": price_id, "quantity": 1}],
                mode="subscription",
                success_url=f"{FRONTEND_URL}/settings/billing?success=true",
                cancel_url=f"{FRONTEND_URL}/settings/billing?canceled=true",
                metadata={"plan": plan, "period": billing_period},
            )
            return session.url
        except Exception as e:
            logger.error("Stripe checkout error: %s", e)
            return None

    # ── Billing Portal ───────────────────────────────────────────────────────
    @staticmethod
    async def create_portal_session(customer_id: str) -> Optional[str]:
        """Create a Stripe Customer Portal session URL."""
        if not STRIPE_AVAILABLE or not STRIPE_SECRET_KEY:
            return None
        try:
            session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=f"{FRONTEND_URL}/settings/billing",
            )
            return session.url
        except Exception as e:
            logger.error("Stripe portal error: %s", e)
            return None

    # ── Cancel Subscription ──────────────────────────────────────────────────
    @staticmethod
    async def cancel_subscription(subscription_id: str) -> bool:
        """Cancel a Stripe subscription at period end."""
        if not STRIPE_AVAILABLE or not STRIPE_SECRET_KEY:
            return False
        try:
            stripe.Subscription.modify(
                subscription_id,
                cancel_at_period_end=True,
            )
            return True
        except Exception as e:
            logger.error("Stripe cancel error: %s", e)
            return False

    # ── Webhook ──────────────────────────────────────────────────────────────
    @staticmethod
    async def handle_webhook_event(payload: bytes, sig_header: str) -> Dict[str, Any]:
        """
        Verify and process a Stripe webhook event.
        Returns {"handled": True/False, "type": "<event.type>"}.
        """
        if not STRIPE_AVAILABLE or not STRIPE_SECRET_KEY:
            raise RuntimeError("Stripe is not configured")

        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, STRIPE_WEBHOOK_SECRET,
            )
        except stripe.error.SignatureVerificationError:
            logger.warning("Webhook signature verification failed")
            raise ValueError("Invalid Stripe signature")
        except Exception as e:
            logger.error("Webhook parse error: %s", e)
            raise ValueError("Invalid Stripe event") from e

        from services.billing_sync import apply_verified_event
        return await apply_verified_event(event, stripe, STRIPE_PRICE_IDS)
