"""
Incident Timeline Routes - Incident lifecycle management.

Endpoints:
- POST /api/incidents           - Create new incident
- GET  /api/incidents           - List incidents
- GET  /api/incidents/stats     - Get incident statistics
- GET  /api/incidents/{id}      - Get single incident with timeline
- POST /api/incidents/{id}/event   - Add timeline event
- POST /api/incidents/{id}/resolve - Resolve incident
"""
import logging
from typing import Dict, Any, Optional, List

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from services.incident_tracker import (
    create_incident, add_timeline_event, resolve_incident,
    get_incidents, get_incident, get_incident_stats,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class CreateIncidentRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    affected_apis: List[str] = Field(default_factory=list)
    severity: str = Field(default="medium", description="critical, high, medium, low")
    detected_by: str = Field(default="manual", description="manual or auto")


class TimelineEventRequest(BaseModel):
    event_type: str = Field(..., max_length=50, description="investigating, identified, monitoring, resolved, update")
    message: str = Field(..., min_length=1, max_length=1000)
    author: str = Field(default="system", max_length=100)


class ResolveRequest(BaseModel):
    resolution: str = Field(..., min_length=1, max_length=2000)
    resolved_by: str = Field(default="manual", max_length=100)


@router.post("/api/incidents")
async def create_new_incident(req: CreateIncidentRequest) -> Dict[str, Any]:
    """Create a new incident."""
    try:
        result = await create_incident(
            title=req.title, description=req.description,
            affected_apis=req.affected_apis, severity=req.severity,
            detected_by=req.detected_by,
        )
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"Error creating incident: {e}")
        return {"status": "error", "error": "Failed to create incident"}


@router.get("/api/incidents")
async def list_incidents(
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> Dict[str, Any]:
    """List all incidents with optional filters."""
    try:
        incidents = await get_incidents(status=status, severity=severity, limit=limit)
        return {"status": "success", "incidents": incidents, "count": len(incidents)}
    except Exception as e:
        logger.error(f"Error listing incidents: {e}")
        return {"status": "error", "error": "Failed to list incidents"}


@router.get("/api/incidents/stats")
async def incident_stats() -> Dict[str, Any]:
    """Get incident statistics."""
    try:
        stats = await get_incident_stats()
        return {"status": "success", **stats}
    except Exception as e:
        logger.error(f"Error getting incident stats: {e}")
        return {"status": "error", "error": "Failed to get incident stats"}


@router.get("/api/incidents/{incident_id}")
async def get_single_incident(incident_id: str) -> Dict[str, Any]:
    """Get a single incident with its full timeline."""
    try:
        incident = await get_incident(incident_id)
        if not incident:
            return {"status": "error", "error": "Incident not found"}
        return {"status": "success", "incident": incident}
    except Exception as e:
        logger.error(f"Error getting incident: {e}")
        return {"status": "error", "error": "Failed to get incident"}


@router.post("/api/incidents/{incident_id}/event")
async def add_event(incident_id: str, req: TimelineEventRequest) -> Dict[str, Any]:
    """Add a timeline event to an incident."""
    try:
        result = await add_timeline_event(
            incident_id=incident_id, event_type=req.event_type,
            message=req.message, author=req.author,
        )
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"Error adding timeline event: {e}")
        return {"status": "error", "error": "Failed to add timeline event"}


@router.post("/api/incidents/{incident_id}/resolve")
async def resolve(incident_id: str, req: ResolveRequest) -> Dict[str, Any]:
    """Resolve an incident."""
    try:
        result = await resolve_incident(
            incident_id=incident_id, resolution=req.resolution,
            resolved_by=req.resolved_by,
        )
        return {"status": "success", **result}
    except Exception as e:
        logger.error(f"Error resolving incident: {e}")
        return {"status": "error", "error": "Failed to resolve incident"}
