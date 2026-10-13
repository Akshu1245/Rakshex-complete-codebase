"""
Pro Gate Middleware – Enforce plan-based feature limits.

Usage in routes:
    from middleware.pro_gate import require_pro, check_api_limit, check_alert_limit

    @router.post("/api/some-pro-feature")
    async def pro_feature(user: Dict = Depends(require_pro)):
        ...
"""
import logging
from typing import Dict, Any

from fastapi import Depends, HTTPException

from routes.auth import require_auth
from services.cache import cache_get, cache_set, user_plan_key

logger = logging.getLogger(__name__)

# ── Plan limits ──────────────────────────────────────────────────────────────
PLAN_LIMITS = {
    "free": {
        "apis": 3,
        "alerts_per_month": 5,
        "history_days": 7,
        "mock_servers": 1,
        "team_members": 1,
        "features": {
            "security_scan", "cicd_gates", "analytics_forecast",
            "kill_switch", "marketplace_publish", "reports_export",
        },  # features BLOCKED on free
    },
    "pro": {
        "apis": 999,
        "alerts_per_month": 999,
        "history_days": 90,
        "mock_servers": 20,
        "team_members": 20,
        "features": set(),  # nothing blocked
    },
    "enterprise": {
        "apis": 99999,
        "alerts_per_month": 99999,
        "history_days": 365,
        "mock_servers": 100,
        "team_members": 100,
        "features": set(),
    },
}


async def require_pro(user: Dict[str, Any] = Depends(require_auth)) -> Dict[str, Any]:
    """Dependency that requires at least a 'pro' plan. Plan is cached for 10 min."""
    uid = user.get("user_id", 0)
    cache_key = user_plan_key(uid)

    # Try cache first
    cached_plan = await cache_get(cache_key)
    if cached_plan:
        plan = cached_plan.get("plan", "free")
    else:
        plan = user.get("plan", "free")
        await cache_set(cache_key, {"plan": plan, "user_id": uid}, ttl=600)

    if plan == "free":
        raise HTTPException(
            status_code=403,
            detail="This feature requires a Pro or Enterprise plan. "
                   "Upgrade at /billing to unlock it.",
        )
    return user


def get_plan_limits(plan: str) -> Dict[str, Any]:
    """Return limits dict for a plan."""
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])


def check_feature_access(plan: str, feature: str) -> bool:
    """Return True if the plan has access to the given feature."""
    blocked = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["features"]
    return feature not in blocked


def check_api_limit(plan: str, current_count: int) -> bool:
    """Return True if the user can add another API."""
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["apis"]
    return current_count < limit


def check_alert_limit(plan: str, current_count: int) -> bool:
    """Return True if the user can create another alert."""
    limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["alerts_per_month"]
    return current_count < limit
