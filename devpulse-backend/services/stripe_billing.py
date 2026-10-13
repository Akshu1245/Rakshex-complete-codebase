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
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Lazy Stripe import – graceful fallback if not installed
try:
    import stripe
    STRIPE_AVAILABLE = True
except ImportError:
    stripe = None  # type: ignore
    STRIPE_AVAILABLE = False
    logger.warning("stripe package not installed – billing runs in stub mode")

# ── Configuration ────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

if STRIPE_AVAILABLE and STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

# Price IDs mapped in your Stripe Dashboard
STRIPE_PRICE_IDS = {
    "pro_monthly": os.getenv("STRIPE_PRICE_PRO_MONTHLY", "price_pro_monthly"),
    "pro_yearly": os.getenv("STRIPE_PRICE_PRO_YEARLY", "price_pro_yearly"),
    "enterprise_monthly": os.getenv("STRIPE_PRICE_ENT_MONTHLY", "price_ent_monthly"),
    "enterprise_yearly": os.getenv("STRIPE_PRICE_ENT_YEARLY", "price_ent_yearly"),
}


class StripeBillingService:
    """Manages all Stripe operations for DevPulse."""

    # ── Customer ─────────────────────────────────────────────────────────────
    @staticmethod
    async def create_customer(email: str, name: str, user_id: int) -> Optional[str]:
        """Create a Stripe customer and return the customer ID."""
        if not STRIPE_AVAILABLE or not STRIPE_SECRET_KEY:
            logger.info("Stripe stub: create_customer(%s)", email)
            return f"cus_stub_{user_id}"
        try:
            customer = stripe.Customer.create(
                email=email,
                name=name,
                metadata={"devpulse_user_id": str(user_id)},
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
            logger.info("Stripe stub: checkout for %s", price_key)
            return f"{FRONTEND_URL}/billing?session=stub&plan={plan}"

        try:
            session = stripe.checkout.Session.create(
                customer=customer_id,
                payment_method_types=["card"],
                line_items=[{"price": price_id, "quantity": 1}],
                mode="subscription",
                success_url=f"{FRONTEND_URL}/billing?success=true",
                cancel_url=f"{FRONTEND_URL}/billing?canceled=true",
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
            return f"{FRONTEND_URL}/billing?portal=stub"
        try:
            session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=f"{FRONTEND_URL}/billing",
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
            logger.info("Stripe stub: cancel %s", subscription_id)
            return True
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
            return {"handled": False, "reason": "stripe not configured"}

        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, STRIPE_WEBHOOK_SECRET,
            )
        except stripe.error.SignatureVerificationError:
            logger.warning("Webhook signature verification failed")
            return {"handled": False, "reason": "bad_signature"}
        except Exception as e:
            logger.error("Webhook parse error: %s", e)
            return {"handled": False, "reason": str(e)}

        event_type = event["type"]
        data = event["data"]["object"]
        logger.info("Processing webhook: %s", event_type)

        if event_type == "checkout.session.completed":
            # Activate subscription
            return {"handled": True, "type": event_type, "customer": data.get("customer")}
        elif event_type == "customer.subscription.updated":
            return {"handled": True, "type": event_type, "status": data.get("status")}
        elif event_type == "customer.subscription.deleted":
            return {"handled": True, "type": event_type, "customer": data.get("customer")}
        elif event_type == "invoice.payment_failed":
            return {"handled": True, "type": event_type, "customer": data.get("customer")}
        else:
            logger.info("Unhandled webhook type: %s", event_type)
            return {"handled": False, "type": event_type}
