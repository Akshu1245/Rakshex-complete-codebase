"""
History Routes - Code generation history endpoints.

Endpoints:
- GET  /api/history - Get code generation history
- GET  /api/history/stats - Get usage statistics
"""
import logging
from typing import Dict, Any, Optional

from fastapi import APIRouter, Depends

from routes.auth import get_current_user
from services.database import get_code_history, get_usage_stats

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/history")
async def get_history(
    limit: int = 20,
    user: Optional[Dict] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get code generation history."""
    try:
        user_id = user["id"] if user else None
        history = await get_code_history(user_id=user_id, limit=min(limit, 100))
        
        return {
            "status": "success",
            "history": history,
            "count": len(history),
        }
    except Exception as e:
        logger.error(f"History fetch error: {e}")
        return {
            "status": "error",
            "history": [],
            "count": 0,
            "message": "Failed to fetch history",
        }


@router.get("/api/history/stats")
async def get_stats(
    days: int = 7,
    user: Optional[Dict] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get usage statistics."""
    try:
        user_id = user["id"] if user else None
        stats = await get_usage_stats(user_id=user_id, days=min(days, 90))
        
        return {
            "status": "success",
            **stats,
        }
    except Exception as e:
        logger.error(f"Stats fetch error: {e}")
        return {
            "status": "error",
            "message": "Failed to fetch stats",
        }
