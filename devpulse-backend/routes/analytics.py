"""
Analytics Routes - Usage trends, breakdown, insights, and forecasting.

Endpoints:
- GET  /api/analytics/trends    - Usage trends over time
- GET  /api/analytics/breakdown - API breakdown
- GET  /api/analytics/insights  - Performance insights
- GET  /api/analytics/forecast  - Predictive usage forecast
- POST /api/analytics/track     - Record an analytics event
"""
import logging
from typing import Dict, Any

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from services.analytics_engine import (
    get_usage_trends, get_api_breakdown, get_performance_insights,
    forecast_usage, record_event,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class TrackEventRequest(BaseModel):
    endpoint: str = Field(..., min_length=1, max_length=200)
    response_time_ms: float = Field(default=0, ge=0)
    status_code: int = Field(default=200, ge=100, le=599)
    api_name: str = Field(default="", max_length=100)


@router.get("/api/analytics/trends")
async def usage_trends(days: int = Query(30, ge=1, le=365)) -> Dict[str, Any]:
    """Get usage trends over the specified time window."""
    try:
        trends = await get_usage_trends(days)
        return {"status": "success", **trends}
    except Exception as e:
        logger.error(f"Error getting usage trends: {e}")
        return {"status": "error", "error": "Failed to get usage trends"}


@router.get("/api/analytics/breakdown")
async def api_breakdown(days: int = Query(30, ge=1, le=365)) -> Dict[str, Any]:
    """Get API usage breakdown."""
    try:
        breakdown = await get_api_breakdown(days)
        return {"status": "success", **breakdown}
    except Exception as e:
        logger.error(f"Error getting API breakdown: {e}")
        return {"status": "error", "error": "Failed to get API breakdown"}


@router.get("/api/analytics/insights")
async def performance_insights() -> Dict[str, Any]:
    """Get performance insights and recommendations."""
    try:
        insights = await get_performance_insights()
        return {"status": "success", "insights": insights, "count": len(insights)}
    except Exception as e:
        logger.error(f"Error getting insights: {e}")
        return {"status": "error", "error": "Failed to get insights"}


@router.get("/api/analytics/forecast")
async def usage_forecast(days_ahead: int = Query(7, ge=1, le=90)) -> Dict[str, Any]:
    """Get predictive usage forecast."""
    try:
        forecast = await forecast_usage(days_ahead)
        return {"status": "success", **forecast}
    except Exception as e:
        logger.error(f"Error generating forecast: {e}")
        return {"status": "error", "error": "Failed to generate forecast"}


@router.post("/api/analytics/track")
async def track_event(req: TrackEventRequest) -> Dict[str, Any]:
    """Record an analytics event."""
    try:
        await record_event(
            user_id=None, endpoint=req.endpoint,
            response_time_ms=req.response_time_ms,
            status_code=req.status_code,
        )
        return {"status": "success", "message": "Event recorded"}
    except Exception as e:
        logger.error(f"Error tracking event: {e}")
        return {"status": "error", "error": "Failed to record event"}
