"""
Billing Routes - Stripe subscription management and freemium gates.

Endpoints:
- GET  /api/billing/plans          - List available plans
- POST /api/billing/subscribe      - Subscribe to a plan (direct or Stripe)
- GET  /api/billing/status         - Get current billing status
- GET  /api/billing/history        - Billing event history
- POST /api/billing/cancel         - Cancel subscription
- POST /api/billing/checkout       - Create Stripe Checkout Session
- POST /api/billing/portal         - Create Stripe Customer Portal session
- POST /api/billing/webhook        - Stripe webhook handler
"""
import logging
from typing import Dict, Any, Optional

from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel, Field

from routes.auth import require_auth, PLAN_LIMITS
from services.database import (
    save_billing_event, get_billing_history, update_user_plan,
    get_user_by_id,
)
from services.stripe_billing import StripeBillingService, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_AVAILABLE

logger = logging.getLogger(__name__)
router = APIRouter()

# Plan definitions
PLANS = {
    "free": {
        "name": "Free", "price_monthly": 0, "price_yearly": 0,
        "api_calls_day": 50, "features": [
            "Health monitoring", "Basic dashboard", "5 API keys",
            "Community marketplace (read-only)",
        ],
    },
    "pro": {
        "name": "Pro", "price_monthly": 29, "price_yearly": 290,
        "api_calls_day": 500, "features": [
            "Everything in Free",
            "Change detection", "Security scanning", "Mock servers",
            "Incident timeline", "CI/CD gates", "Multi-channel alerts",
            "Kill switch", "Advanced analytics & forecasting",
            "50 API keys", "Priority support",
        ],
    },
    "enterprise": {
        "name": "Enterprise", "price_monthly": 99, "price_yearly": 990,
        "api_calls_day": 10000, "features": [
            "Everything in Pro",
            "Team RBAC workspaces", "Marketplace publishing",
            "OpenAPI import", "PDF/CSV reports", "Multi-protocol support",
            "Unlimited API keys", "SSO ready", "Dedicated support",
        ],
    },
}


class SubscribeRequest(BaseModel):
    plan: str = Field(..., description="free, pro, enterprise")
    payment_method_id: Optional[str] = Field(default=None, description="Stripe payment method ID")
    billing_period: str = Field(default="monthly", description="monthly or yearly")


class CancelRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


@router.get("/api/billing/plans")
async def list_plans() -> Dict[str, Any]:
    """List available subscription plans."""
    return {"status": "success", "plans": PLANS}


@router.post("/api/billing/subscribe")
async def subscribe(
    req: SubscribeRequest,
    user: Dict = Depends(require_auth),
) -> Dict[str, Any]:
    """Start hosted checkout; entitlements change only after verified provider state."""
    if req.plan not in PLANS:
        return {"status": "error", "error": f"Invalid plan: {req.plan}"}
    if req.plan == "free":
        return {"status": "error", "error": "Use cancellation to manage the existing plan"}
    return await create_checkout(CheckoutRequest(plan=req.plan, billing_period=req.billing_period), user)


@router.get("/api/billing/status")
async def billing_status(user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """Get current billing status for the authenticated user."""
    try:
        plan = user.get("plan", "free")
        plan_info = PLANS.get(plan, PLANS["free"])
        return {
            "status": "success",
            "plan": plan,
            "plan_details": plan_info,
            "api_calls_today": user.get("api_calls_today", 0),
            "api_limit": PLAN_LIMITS.get(plan, 50),
            "stripe_customer_id": user.get("stripe_customer_id"),
            "stripe_subscription_id": user.get("stripe_subscription_id"),
        }
    except Exception as e:
        logger.error(f"Billing status error: {e}")
        return {"status": "error", "error": "Failed to get billing status"}


@router.get("/api/billing/history")
async def billing_history_endpoint(user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """Get billing history for the authenticated user."""
    try:
        history = await get_billing_history(user["id"])
        return {"status": "success", "history": history, "count": len(history)}
    except Exception as e:
        logger.error(f"Billing history error: {e}")
        return {"status": "error", "error": "Failed to get billing history"}


@router.post("/api/billing/cancel")
async def cancel_subscription(
    req: CancelRequest,
    user: Dict = Depends(require_auth),
) -> Dict[str, Any]:
    """Schedule provider cancellation; leave access in sync with the provider."""
    subscription_id = user.get("stripe_subscription_id")
    if subscription_id:
        if not STRIPE_AVAILABLE or not STRIPE_SECRET_KEY:
            raise HTTPException(503, "Billing is not configured")
        ok = await StripeBillingService.cancel_subscription(subscription_id)
        if not ok:
            raise HTTPException(502, "Provider did not confirm cancellation")
        return {"status": "success", "message": "Cancellation scheduled at period end"}
    if user.get("trial_ends_at"):
        await update_user_plan(user_id=user["id"], plan="free")
        return {"status": "success", "message": "Trial cancelled"}
    return {"status": "error", "error": "No subscription to cancel"}


# =============================================================================
# STRIPE INTEGRATION ROUTES
# =============================================================================

class CheckoutRequest(BaseModel):
    plan: str = Field(..., description="pro or enterprise")
    billing_period: str = Field(default="monthly", description="monthly or yearly")


@router.post("/api/billing/checkout")
async def create_checkout(
    req: CheckoutRequest,
    user: Dict = Depends(require_auth),
) -> Dict[str, Any]:
    """Create a Stripe Checkout Session for upgrading."""
    if not STRIPE_AVAILABLE or not STRIPE_SECRET_KEY or not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(503, "Billing is not configured")
    if user.get("stripe_subscription_id"):
        raise HTTPException(409, "Manage your existing subscription in the billing portal")
    try:
        if req.plan not in ("pro", "enterprise"):
            return {"status": "error", "error": "Invalid plan"}

        # Get or create Stripe customer
        customer_id = user.get("stripe_customer_id")
        if not customer_id:
            customer_id = await StripeBillingService.create_customer(
                email=user["email"],
                name=user.get("username", user["email"]),
                user_id=user["id"],
            )
            if customer_id:
                await update_user_plan(
                    user_id=user["id"],
                    plan=user.get("plan", "free"),
                    stripe_customer_id=customer_id,
                )

        if not customer_id:
            return {"status": "error", "error": "Failed to create billing customer"}

        url = await StripeBillingService.create_checkout_session(
            customer_id=customer_id,
            plan=req.plan,
            billing_period=req.billing_period,
        )
        if not url:
            return {"status": "error", "error": "Failed to create checkout session"}

        return {"status": "success", "checkout_url": url}
    except Exception as e:
        logger.error(f"Checkout error: {e}")
        return {"status": "error", "error": "Failed to create checkout"}


@router.post("/api/billing/portal")
async def create_portal(user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """Create a Stripe Customer Portal session for managing billing."""
    if not STRIPE_AVAILABLE or not STRIPE_SECRET_KEY:
        raise HTTPException(503, "Billing is not configured")
    try:
        customer_id = user.get("stripe_customer_id")
        if not customer_id:
            return {"status": "error", "error": "No billing account found. Subscribe first."}

        url = await StripeBillingService.create_portal_session(customer_id)
        if not url:
            return {"status": "error", "error": "Failed to create portal session"}

        return {"status": "success", "portal_url": url}
    except Exception as e:
        logger.error(f"Portal error: {e}")
        return {"status": "error", "error": "Failed to create billing portal"}


@router.post("/api/billing/webhook")
async def stripe_webhook(request: Request) -> Dict[str, Any]:
    """Handle Stripe webhook events (no auth — Stripe-signed)."""
    if not STRIPE_AVAILABLE or not STRIPE_SECRET_KEY or not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(503, "Billing is not configured")
    try:
        payload = await request.body()
        sig = request.headers.get("stripe-signature", "")
        result = await StripeBillingService.handle_webhook_event(payload, sig)

        if result.get("handled"):
            logger.info(f"Webhook processed: {result.get('type')}")
            return {"status": "success", "event": result.get("type")}
        else:
            logger.warning(f"Webhook not handled: {result}")
            return {"status": "ignored", "reason": result.get("reason", "unknown")}
    except ValueError:
        raise HTTPException(400, "Invalid webhook signature or payload")
    except Exception:
        logger.exception("Webhook state synchronization failed")
        raise HTTPException(503, "Webhook synchronization must be retried")
