"""
Change Detection Routes - Monitor API schema changes.

Endpoints:
- GET  /api/changes/alerts        - List change alerts
- POST /api/changes/alerts/{id}/ack - Acknowledge an alert
- GET  /api/changes/history/{api} - Schema history for an API
- GET  /api/changes/monitored     - List monitored APIs
"""
import logging
from typing import Dict, Any, Optional

from fastapi import APIRouter, Query

from services.change_detector import (
    get_change_alerts, acknowledge_alert, get_schema_history, get_monitored_apis,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/changes/alerts")
async def list_change_alerts(
    limit: int = Query(50, ge=1, le=200),
    api_name: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """Get detected API change alerts."""
    try:
        alerts = await get_change_alerts(limit=limit, api_name=api_name, severity=severity)
        return {"status": "success", "alerts": alerts, "count": len(alerts)}
    except Exception as e:
        logger.error(f"Error listing change alerts: {e}")
        return {"status": "error", "error": "Failed to retrieve change alerts"}


@router.post("/api/changes/alerts/{alert_id}/ack")
async def ack_change_alert(alert_id: int) -> Dict[str, Any]:
    """Acknowledge a change alert."""
    try:
        ok = await acknowledge_alert(alert_id)
        if ok:
            return {"status": "success", "message": f"Alert {alert_id} acknowledged"}
        return {"status": "error", "error": "Alert not found"}
    except Exception as e:
        logger.error(f"Error acknowledging alert: {e}")
        return {"status": "error", "error": "Failed to acknowledge alert"}


@router.get("/api/changes/history/{api_name}")
async def get_schema_changes(
    api_name: str,
    limit: int = Query(20, ge=1, le=100),
) -> Dict[str, Any]:
    """Get schema change history for a specific API."""
    try:
        history = await get_schema_history(api_name, limit)
        return {"status": "success", "api_name": api_name, "history": history}
    except Exception as e:
        logger.error(f"Error getting schema history: {e}")
        return {"status": "error", "error": "Failed to retrieve schema history"}


@router.get("/api/changes/monitored")
async def list_monitored_apis() -> Dict[str, Any]:
    """Get list of currently monitored APIs."""
    try:
        apis = get_monitored_apis()
        return {"status": "success", "apis": apis, "count": len(apis)}
    except Exception as e:
        logger.error(f"Error listing monitored APIs: {e}")
        return {"status": "error", "error": "Failed to list monitored APIs"}
