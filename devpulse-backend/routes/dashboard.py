"""
Dashboard Routes - Health check and API monitoring endpoints.
"""
from datetime import datetime, timezone
import logging

from fastapi import APIRouter

from services.health_monitor import get_dashboard_response, get_api_details_list
from services.cache import cache_get, cache_set, health_cache_key

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health_check():
    """
    Health check endpoint.  Cached for 60 seconds.

    Returns:
        {"status": "ok", "timestamp": "<UTC ISO timestamp>"}
    """
    try:
        key = health_cache_key()
        cached = await cache_get(key)
        if cached:
            return {**cached, "cached": True}

        result = {
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await cache_set(key, result, ttl=60)
        return result
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return {
            "status": "error",
            "error": "Health check failed"
        }


@router.get("/api/dashboard")
async def get_dashboard():
    """
    Get dashboard health data with summary.
    
    Returns:
        {
          "apis": {api_name: health_data, ...},
          "summary": {"total": 15, "healthy": n, "degraded": n, "down": n, "last_run": timestamp},
          "status": "success"
        }
    """
    try:
        dashboard_data = get_dashboard_response()
        return dashboard_data
    except ValueError as e:
        logger.error(f"Dashboard value error: {e}")
        return {
            "apis": {},
            "summary": {"total": 0, "healthy": 0, "degraded": 0, "down": 0, "last_run": None},
            "status": "error",
            "error": f"Invalid data: {str(e)}"
        }
    except KeyError as e:
        logger.error(f"Dashboard key error: {e}")
        return {
            "apis": {},
            "summary": {"total": 0, "healthy": 0, "degraded": 0, "down": 0, "last_run": None},
            "status": "error",
            "error": f"Missing key: {str(e)}"
        }
    except Exception as e:
        logger.error(f"Dashboard error: {e}")
        return {
            "apis": {},
            "summary": {"total": 0, "healthy": 0, "degraded": 0, "down": 0, "last_run": None},
            "status": "error",
            "error": "Failed to retrieve dashboard data"
        }


@router.get("/api/api-details")
async def get_api_details():
    """
    Get detailed information for all 15 monitored APIs.
    
    Returns:
        List of API objects with name, category, status, latency_ms,
        last_checked, is_rate_limited, is_timeout, status_code, error
    """
    try:
        api_details = get_api_details_list()
        return {"apis": api_details, "count": len(api_details), "status": "success"}
    except ValueError as e:
        logger.error(f"API details value error: {e}")
        return {"apis": [], "count": 0, "status": "error", "error": f"Invalid data: {str(e)}"}
    except KeyError as e:
        logger.error(f"API details key error: {e}")
        return {"apis": [], "count": 0, "status": "error", "error": f"Missing key: {str(e)}"}
    except Exception as e:
        logger.error(f"API details error: {e}")
        return {"apis": [], "count": 0, "status": "error", "error": "Failed to retrieve API details"}
