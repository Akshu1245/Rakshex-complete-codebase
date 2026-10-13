"""
Compatibility Routes - API compatibility checking endpoint with Dijkstra path finding.
"""
import logging

from fastapi import APIRouter
from pydantic import ValidationError

from models.schemas import CompatibilityRequest
from services.graph_engine import check_compatibility as calc_compatibility
from services.graph_engine import get_api_names, get_graph_stats, get_all_apis

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/api/compatibility")
async def check_compatibility(request: CompatibilityRequest):
    """
    Check compatibility between two APIs using Dijkstra's shortest path.
    
    Request:
        {"api1": str (min 1, max 100), "api2": str (min 1, max 100)}
    
    Returns:
        {
            "score": int,
            "path": ["API1", "API2", ...],
            "hops": int,
            "reason": str,
            "edge_scores": [{"from": str, "to": str, "score": int}],
            "status": "success"
        }
    """
    try:
        result = calc_compatibility(request.api1, request.api2)
        return result
    except ValidationError as e:
        logger.warning(f"Compatibility validation error: {e}")
        return {
            "status": "error",
            "error": f"Validation error: {str(e)}",
            "score": 0,
            "path": [],
            "hops": 0,
            "reason": "",
            "edge_scores": []
        }
    except ValueError as e:
        logger.error(f"Compatibility value error: {e}")
        return {
            "status": "error",
            "error": f"Invalid input: {str(e)}",
            "score": 0,
            "path": [],
            "hops": 0,
            "reason": "",
            "edge_scores": []
        }
    except Exception as e:
        logger.error(f"Compatibility calculation error: {e}")
        return {
            "status": "error",
            "error": "Failed to calculate compatibility",
            "score": 0,
            "path": [],
            "hops": 0,
            "reason": "",
            "edge_scores": []
        }


@router.get("/api/compatibility/apis")
async def list_available_apis():
    """
    List all available APIs that can be used for compatibility checking.
    
    Returns:
        {"apis": [str], "count": int, "status": "success"}
    """
    try:
        api_names = get_api_names()
        return {
            "apis": api_names,
            "count": len(api_names),
            "status": "success"
        }
    except Exception as e:
        logger.error(f"Error listing APIs: {e}")
        return {
            "apis": [],
            "count": 0,
            "status": "error",
            "error": "Failed to list APIs"
        }


@router.get("/api/compatibility/stats")
async def get_compatibility_stats():
    """
    Get statistics about the API compatibility graph.
    
    Returns:
        {
            "total_nodes": int,
            "total_edges": int,
            "avg_compatibility_score": float,
            "max_compatibility_score": int,
            "min_compatibility_score": int,
            "categories": [str],
            "status": "success"
        }
    """
    try:
        stats = get_graph_stats()
        stats["status"] = "success"
        return stats
    except Exception as e:
        logger.error(f"Error getting graph stats: {e}")
        return {
            "total_nodes": 0,
            "total_edges": 0,
            "avg_compatibility_score": 0.0,
            "max_compatibility_score": 0,
            "min_compatibility_score": 0,
            "categories": [],
            "status": "error",
            "error": "Failed to get graph statistics"
        }


@router.get("/api/compatibility/apis/details")
async def get_apis_details():
    """
    Get detailed information about all APIs including their parameters.
    
    Returns:
        {"apis": [{"name", "category", "input_params", "output_fields"}], "status": "success"}
    """
    try:
        apis = get_all_apis()
        return {
            "apis": apis,
            "count": len(apis),
            "status": "success"
        }
    except Exception as e:
        logger.error(f"Error getting API details: {e}")
        return {
            "apis": [],
            "count": 0,
            "status": "error",
            "error": "Failed to get API details"
        }
