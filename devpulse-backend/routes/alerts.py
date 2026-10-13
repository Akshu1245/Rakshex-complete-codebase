"""
Alerts & Kill-Switch Routes - Multi-channel alerting and emergency kill switch.

Endpoints:
- POST   /api/alerts/configs      - Create alert config
- GET    /api/alerts/configs      - List alert configs
- DELETE /api/alerts/configs/{id} - Delete alert config
- POST   /api/alerts/trigger      - Manually trigger an alert
- GET    /api/alerts/history      - Alert history
- POST   /api/alerts/kill-switch/activate   - Activate kill switch
- POST   /api/alerts/kill-switch/deactivate - Deactivate kill switch
- GET    /api/alerts/kill-switch             - List active kill switches
"""
import logging
from typing import Dict, Any, Optional, List

from fastapi import APIRouter, Query, Depends
from pydantic import BaseModel, Field

from routes.auth import require_auth
from services.alerting import (
    create_alert_config, get_alert_configs, delete_alert_config,
    trigger_alert, get_alert_history,
    activate_kill_switch, deactivate_kill_switch, get_kill_switches,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class CreateAlertConfigRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    channel: str = Field(..., description="webhook, slack, discord, email, in_app")
    event_types: List[str] = Field(default_factory=lambda: ["api_down", "high_latency", "budget_exceeded"])
    destination: str = Field(default="", max_length=500, description="URL or email address")
    threshold: Optional[float] = Field(default=None)


class TriggerAlertRequest(BaseModel):
    event_type: str = Field(..., min_length=1, max_length=50)
    message: str = Field(..., min_length=1, max_length=1000)
    severity: str = Field(default="medium")
    data: Dict[str, Any] = Field(default_factory=dict)


class KillSwitchRequest(BaseModel):
    api_name: str = Field(..., min_length=1, max_length=100)
    reason: str = Field(default="Emergency kill switch activated", max_length=500)
    activated_by: str = Field(default="manual", max_length=100)


class DeactivateKillSwitchRequest(BaseModel):
    api_name: str = Field(..., min_length=1, max_length=100)


@router.post("/api/alerts/configs")
async def create_config(req: CreateAlertConfigRequest, user=Depends(require_auth)) -> Dict[str, Any]:
    """Create a new alert configuration."""
    try:
        result = await create_alert_config(
            user_id=user.get("user_id"), name=req.name, channel=req.channel,
            event_types=req.event_types, destination=req.destination,
            threshold=req.threshold,
        )
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"Error creating alert config: {e}")
        return {"status": "error", "error": "Failed to create alert config"}


@router.get("/api/alerts/configs")
async def list_configs(user=Depends(require_auth)) -> Dict[str, Any]:
    """List all alert configurations."""
    try:
        configs = await get_alert_configs()
        return {"status": "success", "configs": configs, "count": len(configs)}
    except Exception as e:
        logger.error(f"Error listing alert configs: {e}")
        return {"status": "error", "error": "Failed to list alert configs"}


@router.delete("/api/alerts/configs/{config_id}")
async def remove_config(config_id: str, user=Depends(require_auth)) -> Dict[str, Any]:
    """Delete an alert configuration."""
    try:
        ok = await delete_alert_config(config_id)
        if ok:
            return {"status": "success", "message": f"Config {config_id} deleted"}
        return {"status": "error", "error": "Config not found"}
    except Exception as e:
        logger.error(f"Error deleting alert config: {e}")
        return {"status": "error", "error": "Failed to delete alert config"}


@router.post("/api/alerts/trigger")
async def trigger(req: TriggerAlertRequest, user=Depends(require_auth)) -> Dict[str, Any]:
    """Manually trigger an alert to all matching configs."""
    try:
        result = await trigger_alert(
            event_type=req.event_type, message=req.message,
            severity=req.severity, data=req.data,
        )
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"Error triggering alert: {e}")
        return {"status": "error", "error": "Failed to trigger alert"}


@router.get("/api/alerts/history")
async def alert_history(user=Depends(require_auth), limit: int = Query(50, ge=1, le=200)) -> Dict[str, Any]:
    """Get alert history."""
    try:
        history = await get_alert_history(limit)
        return {"status": "success", "history": history, "count": len(history)}
    except Exception as e:
        logger.error(f"Error getting alert history: {e}")
        return {"status": "error", "error": "Failed to get alert history"}


@router.post("/api/alerts/kill-switch/activate")
async def activate_kill(req: KillSwitchRequest, user=Depends(require_auth)) -> Dict[str, Any]:
    """Activate a kill switch for an API."""
    try:
        result = await activate_kill_switch(
            api_name=req.api_name, reason=req.reason,
            activated_by=req.activated_by,
        )
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"Error activating kill switch: {e}")
        return {"status": "error", "error": "Failed to activate kill switch"}


@router.post("/api/alerts/kill-switch/deactivate")
async def deactivate_kill(req: DeactivateKillSwitchRequest, user=Depends(require_auth)) -> Dict[str, Any]:
    """Deactivate a kill switch for an API."""
    try:
        ok = await deactivate_kill_switch(req.api_name)
        if ok:
            return {"status": "success", "message": f"Kill switch for {req.api_name} deactivated"}
        return {"status": "error", "error": "Kill switch not found or already inactive"}
    except Exception as e:
        logger.error(f"Error deactivating kill switch: {e}")
        return {"status": "error", "error": "Failed to deactivate kill switch"}


@router.get("/api/alerts/kill-switch")
async def list_kill_switches(user=Depends(require_auth)) -> Dict[str, Any]:
    """List all active kill switches."""
    try:
        result = await get_kill_switches()
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"Error listing kill switches: {e}")
        return {"status": "error", "error": "Failed to list kill switches"}
