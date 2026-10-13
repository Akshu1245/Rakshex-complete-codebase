"""Apply verified webhook triggers using the provider's current subscription state."""
import asyncio
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from services.db_config import AsyncSessionLocal
from models.tables import User, BillingWebhook, BillingEvent


async def apply_verified_event(event, stripe_client, price_ids):
    event_id, kind = event["id"], event["type"]
    data = event["data"]["object"]
    customer = data.get("customer")
    if not customer or kind not in (
        "checkout.session.completed", "checkout.session.async_payment_succeeded",
        "customer.subscription.updated", "customer.subscription.deleted",
        "invoice.paid", "invoice.payment_failed",
    ):
        return {"handled": False, "reason": "unsupported event"}
    async with AsyncSessionLocal() as session:
        try:
            async with session.begin():
                user = (await session.execute(select(User).where(
                    User.stripe_customer_id == customer).with_for_update())).scalar_one_or_none()
                if not user:
                    # Retry rather than acknowledging a customer not committed locally yet.
                    raise RuntimeError("Billing customer is not linked")
                if await session.get(BillingWebhook, event_id):
                    return {"handled": True, "type": kind, "duplicate": True}
                subscription_id = user.stripe_subscription_id or data.get("subscription")
                if kind.startswith("customer.subscription."):
                    if subscription_id and subscription_id != data["id"]:
                        return {"handled": False, "reason": "another subscription"}
                    subscription_id = data["id"]
                if not subscription_id:
                    return {"handled": False, "reason": "no subscription"}
                # Read current provider state so out-of-order notifications do not replay stale entitlements.
                subscription = await asyncio.to_thread(stripe_client.Subscription.retrieve, subscription_id)
                if subscription.get("customer") != customer:
                    raise RuntimeError("Subscription customer mismatch")
                plan = "free"
                if subscription.get("status") in ("active", "trialing"):
                    prices = subscription.get("items", {}).get("data", [])
                    known = {value: key.split('_')[0] for key, value in price_ids.items() if value}
                    if len(prices) != 1 or prices[0].get("price", {}).get("id") not in known:
                        raise RuntimeError("Unrecognized subscription price")
                    plan = known[prices[0]["price"]["id"]]
                user.plan = plan
                user.stripe_subscription_id = subscription_id
                user.trial_ends_at = None
                session.add(BillingWebhook(event_id=event_id, user_id=user.id, event_type=kind))
                session.add(BillingEvent(user_id=user.id, event_type=kind[:50], stripe_event_id=event_id,
                    amount_cents=0, description="Subscription state synchronized from provider"))
            return {"handled": True, "type": kind, "plan": plan}
        except IntegrityError:
            await session.rollback()
            if await session.get(BillingWebhook, event_id):
                return {"handled": True, "type": kind, "duplicate": True}
            raise
