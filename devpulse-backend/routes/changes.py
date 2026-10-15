"""
Change Detection Routes - Monitor API schema changes.

Endpoints:
- GET  /api/changes/alerts                 - List alerts in the caller's workspaces (auth required)
- GET  /api/changes/alerts/{id}            - View one alert (workspace member)
- POST /api/changes/alerts/{id}/ack        - Acknowledge (workspace OWNER/ADMIN)
- POST /api/changes/alerts/{id}/resolve    - Resolve (workspace OWNER/ADMIN)
- GET    /api/changes/workspaces/{ws}/subscriptions          - list (member)
- POST   /api/changes/workspaces/{ws}/subscriptions          - add (OWNER/ADMIN)
- DELETE /api/changes/workspaces/{ws}/subscriptions/{api}    - remove (OWNER/ADMIN)
- GET  /api/changes/history/{api}          - Schema history for an API (public provider data)
- GET  /api/changes/monitored              - List monitored APIs (public provider data)

Access model:
- 401 unauthenticated / invalid token.
- Alerts belong to a workspace (teams.id). Only ACCEPTED members can list/view.
- Alerts in another workspace, or with no workspace (NULL, pre-migration), return 404
  with the same body as a non-existent id (no existence leak).
- Ack/resolve require role owner|admin in the alert's workspace, else 403.
- Failures return real HTTP error codes, never 200.
"""
import logging
from typing import Dict, Any, Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from routes.auth import require_auth
from services.alert_schema_guard import require_alert_schema
from services.change_detector import get_change_alerts, get_schema_history, get_monitored_apis

logger = logging.getLogger(__name__)
router = APIRouter()
_SCHEMA = [Depends(require_alert_schema)]

MANAGE_ROLES = {"owner", "admin"}
_NOT_FOUND = "Alert not found"


async def _memberships(user: Dict[str, Any]) -> Dict[str, str]:
    """workspace_id -> role, for workspaces where the user is an accepted member."""
    from services.database import get_user_teams
    return {t["id"]: (t.get("role") or "").lower() for t in await get_user_teams(user["id"])}


async def _load_visible_alert(alert_id: int, user: Dict[str, Any]):
    from services.database import get_change_alert_db
    alert = await get_change_alert_db(alert_id)
    roles = await _memberships(user)
    ws = alert.get("workspace_id") if alert else None
    if not alert or not ws or ws not in roles:
        raise HTTPException(status_code=404, detail=_NOT_FOUND)
    return alert, roles[ws]


@router.get("/api/changes/alerts", dependencies=_SCHEMA)
async def list_change_alerts(
    limit: int = Query(50, ge=1, le=200),
    api_name: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    workspace_id: Optional[str] = Query(None),
    user: Dict[str, Any] = Depends(require_auth),
) -> Dict[str, Any]:
    """List alerts from the caller's workspaces (optionally one workspace)."""
    roles = await _memberships(user)
    if workspace_id is not None:
        if workspace_id not in roles:
            raise HTTPException(status_code=404, detail="Workspace not found")
        ids: List[str] = [workspace_id]
    else:
        ids = list(roles)
    try:
        alerts = await get_change_alerts(limit=limit, api_name=api_name, severity=severity, workspace_ids=ids)
    except Exception as e:
        logger.error(f"Error listing change alerts: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve change alerts")
    return {"status": "success", "alerts": alerts, "count": len(alerts)}


@router.get("/api/changes/alerts/{alert_id}", dependencies=_SCHEMA)
async def get_change_alert(alert_id: int, user: Dict[str, Any] = Depends(require_auth)) -> Dict[str, Any]:
    alert, _ = await _load_visible_alert(alert_id, user)
    return {"status": "success", "alert": alert}


async def _change_state(alert_id: int, user: Dict[str, Any], action: str) -> Dict[str, Any]:
    from services.database import set_change_alert_state_db
    alert, role = await _load_visible_alert(alert_id, user)
    if role not in MANAGE_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient role")
    try:
        ok = await set_change_alert_state_db(alert_id, alert["workspace_id"], user["id"], action)
    except Exception as e:
        logger.error(f"Error on alert {action}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to {action} alert")
    if not ok:
        raise HTTPException(status_code=404, detail=_NOT_FOUND)
    logger.info(f"Alert {alert_id} {action} by user {user['id']} in workspace {alert['workspace_id']}")
    verb = "acknowledged" if action == "ack" else "resolved"
    return {"status": "success", "message": f"Alert {alert_id} {verb}"}


@router.post("/api/changes/alerts/{alert_id}/ack", dependencies=_SCHEMA)
async def ack_change_alert(alert_id: int, user: Dict[str, Any] = Depends(require_auth)) -> Dict[str, Any]:
    return await _change_state(alert_id, user, "ack")


@router.post("/api/changes/alerts/{alert_id}/resolve", dependencies=_SCHEMA)
async def resolve_change_alert(alert_id: int, user: Dict[str, Any] = Depends(require_auth)) -> Dict[str, Any]:
    return await _change_state(alert_id, user, "resolve")


class SubscriptionRequest(BaseModel):
    api_name: str = Field(..., min_length=1, max_length=255)
    source: str = Field(default="manual", pattern="^(manual|integration|repo_connect)$")


async def _workspace_role(workspace_id: str, user: Dict[str, Any]) -> str:
    roles = await _memberships(user)
    if workspace_id not in roles:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return roles[workspace_id]


@router.get("/api/changes/workspaces/{workspace_id}/subscriptions", dependencies=_SCHEMA)
async def list_subscriptions(workspace_id: str, user: Dict[str, Any] = Depends(require_auth)) -> Dict[str, Any]:
    from services.database import list_workspace_subscriptions_db
    await _workspace_role(workspace_id, user)
    subs = await list_workspace_subscriptions_db(workspace_id)
    return {"status": "success", "subscriptions": subs, "count": len(subs)}


@router.post("/api/changes/workspaces/{workspace_id}/subscriptions", dependencies=_SCHEMA, status_code=201)
async def add_subscription(workspace_id: str, req: SubscriptionRequest,
                           user: Dict[str, Any] = Depends(require_auth)) -> Dict[str, Any]:
    """Register that this workspace depends on a monitored API (called on repo connect /
    integration register, or manually). Future upstream changes fan out only to subscribers."""
    from services.database import add_workspace_subscription_db
    if await _workspace_role(workspace_id, user) not in MANAGE_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient role")
    sub = await add_workspace_subscription_db(workspace_id, req.api_name, req.source, user["id"])
    return {"status": "success", "subscription": sub}


@router.delete("/api/changes/workspaces/{workspace_id}/subscriptions/{api_name}", dependencies=_SCHEMA)
async def remove_subscription(workspace_id: str, api_name: str,
                              user: Dict[str, Any] = Depends(require_auth)) -> Dict[str, Any]:
    from services.database import delete_workspace_subscription_db
    if await _workspace_role(workspace_id, user) not in MANAGE_ROLES:
        raise HTTPException(status_code=403, detail="Insufficient role")
    if not await delete_workspace_subscription_db(workspace_id, api_name):
        raise HTTPException(status_code=404, detail="Subscription not found")
    return {"status": "success"}


@router.get("/api/changes/history/{api_name}")
async def get_schema_changes(
    api_name: str,
    limit: int = Query(20, ge=1, le=100),
) -> Dict[str, Any]:
    """Get schema change history for a specific public API."""
    try:
        history = await get_schema_history(api_name, limit)
    except Exception as e:
        logger.error(f"Error getting schema history: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve schema history")
    return {"status": "success", "api_name": api_name, "history": history}


@router.get("/api/changes/monitored")
async def list_monitored_apis() -> Dict[str, Any]:
    """Get list of currently monitored public APIs."""
    try:
        apis = get_monitored_apis()
    except Exception as e:
        logger.error(f"Error listing monitored APIs: {e}")
        raise HTTPException(status_code=500, detail="Failed to list monitored APIs")
    return {"status": "success", "apis": apis, "count": len(apis)}
