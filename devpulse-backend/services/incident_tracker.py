"""
Incident Tracker Service - DB-backed incident lifecycle management.

Provides create, timeline events, resolve, auto-detect, and statistics.
All data persisted to SQLite via database.py.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


async def create_incident(title: str, description: str, affected_apis: List[str],
                          severity: str = "medium", detected_by: str = "manual") -> Dict[str, Any]:
    """Create a new incident, persist to DB, return it."""
    from services.database import save_incident, save_incident_event, get_incident_db

    incident_id = f"INC-{uuid.uuid4().hex[:8].upper()}"
    await save_incident(incident_id, title, description, severity, affected_apis, detected_by)

    event_id = str(uuid.uuid4())
    await save_incident_event(event_id, incident_id, "detected",
                              f"Incident detected: {title}", detected_by)

    return await get_incident_db(incident_id) or {"id": incident_id, "title": title}


async def add_timeline_event(incident_id: str, event_type: str, message: str,
                             author: str = "system",
                             new_status: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Add a timeline event to an incident."""
    from services.database import save_incident_event, update_incident_status, get_incident_db

    event_id = str(uuid.uuid4())
    await save_incident_event(event_id, incident_id, event_type, message, author)

    if new_status:
        await update_incident_status(incident_id, new_status)
        s_event_id = str(uuid.uuid4())
        await save_incident_event(s_event_id, incident_id, "status_change",
                                  f"Status changed to: {new_status}", author)

    return await get_incident_db(incident_id)


async def resolve_incident(incident_id: str, resolution: str,
                           author: str = "system") -> Optional[Dict[str, Any]]:
    """Resolve an incident."""
    from services.database import update_incident_status, save_incident_event, get_incident_db

    await update_incident_status(incident_id, "resolved", resolution=resolution)
    event_id = str(uuid.uuid4())
    await save_incident_event(event_id, incident_id, "resolved",
                              f"Resolved: {resolution}", author)

    return await get_incident_db(incident_id)


async def get_incidents(status: Optional[str] = None,
                        severity: Optional[str] = None,
                        limit: int = 50) -> List[Dict[str, Any]]:
    """Get incidents from DB with optional filters."""
    from services.database import get_incidents_db
    return await get_incidents_db(limit=limit, status=status, severity=severity)


async def get_incident(incident_id: str) -> Optional[Dict[str, Any]]:
    """Get a single incident with timeline."""
    from services.database import get_incident_db
    return await get_incident_db(incident_id)


async def get_incident_stats() -> Dict[str, Any]:
    """Get incident statistics."""
    from services.database import get_incident_stats_db
    return await get_incident_stats_db()


async def auto_detect_incident(health_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Auto-detect incidents from health monitoring data."""
    unhealthy = []
    for api_name, info in health_data.items():
        if isinstance(info, dict):
            st = info.get("status", "unknown")
            if st in ("down", "unhealthy", "error"):
                unhealthy.append(api_name)
    if not unhealthy:
        return None

    # Check if there's already an active incident for these APIs
    active = await get_incidents(status="detected")
    active += await get_incidents(status="investigating")
    for inc in active:
        existing_apis = inc.get("affected_apis", [])
        if isinstance(existing_apis, str):
            import json
            try:
                existing_apis = json.loads(existing_apis)
            except Exception:
                existing_apis = []
        if any(api in existing_apis for api in unhealthy):
            return None

    severity = "critical" if len(unhealthy) >= 3 else "high" if len(unhealthy) >= 2 else "medium"
    apis_str = ", ".join(unhealthy[:3])
    return await create_incident(
        title=f"API{'s' if len(unhealthy) > 1 else ''} Down: {apis_str}",
        description=f"Auto-detected {len(unhealthy)} unhealthy API(s) via health monitor.",
        affected_apis=unhealthy, severity=severity, detected_by="auto_detect",
    )
