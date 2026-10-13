"""
Multi-Channel Alert System with Kill-Switch.

Supports webhook, email (SendGrid), Slack, Discord, and in-app alerts.
Kill-switch can instantly block API calls for specific providers.
All data persisted to DB.
"""
import os
import uuid
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

import httpx

logger = logging.getLogger(__name__)

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")

# In-memory kill-switch cache for fast checks
_kill_switch_cache: Dict[str, Dict[str, Any]] = {}


async def create_alert_config(user_id: Optional[int], name: str,
                              channel: str = "in_app", target: str = "",
                              conditions: Dict = None, priority: str = "medium") -> Dict[str, Any]:
    """Create a new alert configuration."""
    from services.database import save_alert_config
    config_id = str(uuid.uuid4())[:12]
    await save_alert_config(config_id, user_id, name, channel, target,
                            conditions or {}, priority)
    return {
        "id": config_id, "name": name, "channel": channel, "target": target,
        "conditions": conditions or {}, "priority": priority, "enabled": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "trigger_count": 0, "last_triggered": None,
    }


async def get_alert_configs(user_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Get alert configurations."""
    from services.database import get_alert_configs_db
    return await get_alert_configs_db(user_id)


async def delete_alert_config(config_id: str) -> bool:
    """Delete an alert config."""
    from services.database import delete_alert_config_db
    return await delete_alert_config_db(config_id)


async def trigger_alert(event_type: str, message: str,
                        priority: str = "medium") -> List[Dict[str, Any]]:
    """Trigger alerts on all matching configs."""
    from services.database import get_alert_configs_db, save_alert_event
    configs = await get_alert_configs_db()
    results = []

    for config in configs:
        if not config.get("enabled", True):
            continue
        channel = config.get("channel", "in_app")
        target = config.get("target", "")
        delivered = False

        try:
            if channel == "webhook" and target:
                delivered = await _send_webhook(target, event_type, message, priority)
            elif channel == "slack":
                delivered = await _send_slack(target or SLACK_WEBHOOK_URL, event_type, message)
            elif channel == "discord":
                delivered = await _send_discord(target or DISCORD_WEBHOOK_URL, event_type, message)
            elif channel == "email" and target and SENDGRID_API_KEY:
                delivered = await _send_email(target, event_type, message)
            elif channel == "in_app":
                delivered = True  # In-app alerts are always stored
        except Exception as e:
            logger.error(f"Alert delivery failed ({channel}): {e}")

        await save_alert_event(config.get("id"), channel, event_type, message, delivered)
        results.append({"config_id": config.get("id"), "channel": channel,
                        "delivered": delivered})

    return results


async def get_alert_history(limit: int = 50) -> List[Dict[str, Any]]:
    """Get alert history."""
    from services.database import get_alert_history_db
    return await get_alert_history_db(limit)


async def activate_kill_switch(api_name: str, reason: str = "",
                               activated_by: str = "user") -> Dict[str, Any]:
    """Activate kill-switch for an API."""
    from services.database import save_kill_switch
    await save_kill_switch(api_name, reason, activated_by)
    now = datetime.now(timezone.utc).isoformat()
    ks = {"api_name": api_name, "active": True, "reason": reason,
          "activated_by": activated_by, "activated_at": now}
    _kill_switch_cache[api_name] = ks
    logger.warning(f"[KILL-SWITCH] Activated for {api_name}: {reason}")
    return ks


async def deactivate_kill_switch(api_name: str) -> bool:
    """Deactivate kill-switch for an API."""
    from services.database import deactivate_kill_switch_db
    result = await deactivate_kill_switch_db(api_name)
    _kill_switch_cache.pop(api_name, None)
    if result:
        logger.info(f"[KILL-SWITCH] Deactivated for {api_name}")
    return result


async def get_kill_switches() -> Dict[str, Any]:
    """Get all active kill-switches."""
    from services.database import get_kill_switches_db
    switches = await get_kill_switches_db()
    active = {}
    for s in switches:
        active[s["api_name"]] = {
            "api_name": s["api_name"], "active": True,
            "reason": s.get("reason", ""),
            "activated_by": s.get("activated_by", "system"),
            "activated_at": s.get("activated_at", ""),
        }
    return {"kill_switches": active, "active": list(active.keys())}


async def is_killed(api_name: str) -> bool:
    """Fast check if an API is kill-switched (uses cache + DB fallback)."""
    if api_name in _kill_switch_cache:
        return True
    from services.database import is_api_killed
    return await is_api_killed(api_name)


# ─── Channel Implementations ─────────────────────────────────

async def _send_webhook(url: str, event_type: str, message: str,
                        priority: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            resp = await client.post(url, json={
                "event": event_type, "message": message,
                "priority": priority, "source": "DevPulse",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            return resp.status_code < 400
    except Exception as e:
        logger.error(f"Webhook delivery failed: {e}")
        return False


async def _send_slack(webhook_url: str, event_type: str, message: str) -> bool:
    if not webhook_url:
        return False
    try:
        emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(event_type, "ℹ️")
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            resp = await client.post(webhook_url, json={
                "text": f"{emoji} *DevPulse Alert*\n*{event_type}*: {message}",
            })
            return resp.status_code < 400
    except Exception:
        return False


async def _send_discord(webhook_url: str, event_type: str, message: str) -> bool:
    if not webhook_url:
        return False
    try:
        color = {"critical": 0xFF0000, "high": 0xFF6600, "medium": 0xFFCC00, "low": 0x00FF00}.get(event_type, 0x0099FF)
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            resp = await client.post(webhook_url, json={
                "embeds": [{"title": f"DevPulse: {event_type}", "description": message, "color": color}],
            })
            return resp.status_code < 400
    except Exception:
        return False


async def _send_email(to_email: str, event_type: str, message: str) -> bool:
    if not SENDGRID_API_KEY:
        return False
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={"Authorization": f"Bearer {SENDGRID_API_KEY}", "Content-Type": "application/json"},
                json={
                    "personalizations": [{"to": [{"email": to_email}]}],
                    "from": {"email": os.getenv("SENDGRID_FROM_EMAIL", "alerts@devpulse.dev")},
                    "subject": f"[DevPulse] {event_type}",
                    "content": [{"type": "text/plain", "value": message}],
                },
            )
            return resp.status_code < 400
    except Exception:
        return False
