"""
Budget Routes - API key management and budget control endpoints.

Endpoints:
- POST   /api/keys              - Add a new API key (AES-256 encrypted)
- GET    /api/keys              - List all API keys (masked)
- PUT    /api/keys/{id}         - Update API key settings / budget
- DELETE /api/keys/{id}         - Delete an API key
- GET    /api/budget             - Get full budget summary
- PUT    /api/budget/overall     - Set overall budget limit
- POST   /api/budget/reset       - Reset budget counters
- POST   /api/budget/reset/{id}  - Reset single key budget
"""
import logging
from typing import Dict, Any, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

from routes.auth import require_auth
from services.encryption import (
    encrypt_aes256,
    decrypt_aes256,
    mask_api_key,
    validate_api_key_format,
    sanitize_for_storage,
)
from services.database import (
    add_api_key,
    get_api_keys,
    get_api_key_by_id,
    update_api_key,
    delete_api_key,
    get_budget_summary,
    set_overall_budget,
    reset_budget,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# =============================================================================
# REQUEST MODELS
# =============================================================================

API_PROVIDERS = [
    "openai", "groq", "xai", "anthropic", "google", "azure",
    "aws", "stripe", "twilio", "sendgrid", "github",
    "openweathermap", "nasa", "spotify", "discord", "slack",
    "coinbase", "coingecko", "newsapi", "custom",
]


class AddApiKeyRequest(BaseModel):
    key_name: str = Field(..., min_length=1, max_length=100, description="Friendly name for this key")
    api_provider: str = Field(..., min_length=1, max_length=50, description="API provider name")
    api_key: str = Field(..., min_length=8, max_length=500, description="The actual API key value")
    budget_limit: float = Field(default=0, ge=0, le=1_000_000, description="Budget limit in USD ($0 = unlimited)")
    budget_period: str = Field(default="monthly", description="Budget period: daily, weekly, monthly, yearly")
    call_limit: int = Field(default=0, ge=0, le=10_000_000, description="Max API calls (0 = unlimited)")
    
    @field_validator("api_provider")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        return v.strip().lower()
    
    @field_validator("budget_period")
    @classmethod
    def validate_period(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ("daily", "weekly", "monthly", "yearly"):
            raise ValueError("Budget period must be daily, weekly, monthly, or yearly")
        return v
    
    @field_validator("key_name")
    @classmethod
    def validate_key_name(cls, v: str) -> str:
        return sanitize_for_storage(v.strip())


class UpdateApiKeyRequest(BaseModel):
    key_name: Optional[str] = Field(None, min_length=1, max_length=100)
    is_active: Optional[bool] = None
    budget_limit: Optional[float] = Field(None, ge=0, le=1_000_000)
    budget_period: Optional[str] = None
    call_limit: Optional[int] = Field(None, ge=0, le=10_000_000)
    
    @field_validator("budget_period")
    @classmethod
    def validate_period(cls, v):
        if v is not None:
            v = v.strip().lower()
            if v not in ("daily", "weekly", "monthly", "yearly"):
                raise ValueError("Budget period must be daily, weekly, monthly, or yearly")
        return v


class SetOverallBudgetRequest(BaseModel):
    budget_limit: float = Field(..., ge=0, le=10_000_000, description="Overall budget limit in USD")
    alert_threshold: float = Field(default=80, ge=0, le=100, description="Alert when usage reaches this % (0-100)")
    period: str = Field(default="monthly", description="Budget period: daily, weekly, monthly, yearly")
    
    @field_validator("period")
    @classmethod
    def validate_period(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in ("daily", "weekly", "monthly", "yearly"):
            raise ValueError("Budget period must be daily, weekly, monthly, or yearly")
        return v


# =============================================================================
# API KEY ENDPOINTS
# =============================================================================

@router.post("/api/keys")
async def create_api_key(req: AddApiKeyRequest, user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """Add a new API key with optional budget limit. Key is encrypted with AES-256."""
    try:
        # Validate API key format
        is_valid, error_msg = validate_api_key_format(req.api_key, req.api_provider)
        if not is_valid:
            return {"status": "error", "message": error_msg}
        
        # Encrypt the API key with AES-256
        encrypted_key = encrypt_aes256(req.api_key)
        
        key_id = await add_api_key(
            user_id=user["id"],
            key_name=req.key_name,
            api_provider=req.api_provider,
            encrypted_key=encrypted_key,
            budget_limit=req.budget_limit,
            budget_period=req.budget_period,
            call_limit=req.call_limit,
        )
        
        return {
            "status": "success",
            "message": f"API key '{req.key_name}' added successfully",
            "key": {
                "id": key_id,
                "key_name": req.key_name,
                "api_provider": req.api_provider,
                "masked_key": mask_api_key(req.api_key),
                "budget_limit": req.budget_limit,
                "budget_period": req.budget_period,
                "call_limit": req.call_limit,
            }
        }
    except ValueError as e:
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Failed to add API key: {e}")
        return {"status": "error", "message": "Failed to add API key"}


@router.get("/api/keys")
async def list_api_keys(user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """List all API keys for the authenticated user (keys are masked)."""
    try:
        keys = await get_api_keys(user["id"])
        
        return {
            "status": "success",
            "keys": keys,
            "count": len(keys),
        }
    except Exception as e:
        logger.error(f"Failed to list API keys: {e}")
        return {"status": "error", "keys": [], "count": 0, "message": "Failed to fetch keys"}


@router.put("/api/keys/{key_id}")
async def update_key(
    key_id: int,
    req: UpdateApiKeyRequest,
    user: Dict = Depends(require_auth)
) -> Dict[str, Any]:
    """Update an API key's name, status, budget, or call limit."""
    try:
        # Build updates dict from non-None values
        updates = {}
        if req.key_name is not None:
            updates["key_name"] = sanitize_for_storage(req.key_name)
        if req.is_active is not None:
            updates["is_active"] = 1 if req.is_active else 0
        if req.budget_limit is not None:
            updates["budget_limit"] = req.budget_limit
        if req.budget_period is not None:
            updates["budget_period"] = req.budget_period
        if req.call_limit is not None:
            updates["call_limit"] = req.call_limit
        
        if not updates:
            return {"status": "error", "message": "No updates provided"}
        
        success = await update_api_key(key_id, user["id"], updates)
        
        if not success:
            return {"status": "error", "message": "API key not found or no changes made"}
        
        return {"status": "success", "message": "API key updated successfully"}
    except Exception as e:
        logger.error(f"Failed to update API key: {e}")
        return {"status": "error", "message": "Failed to update API key"}


@router.delete("/api/keys/{key_id}")
async def remove_key(key_id: int, user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """Delete an API key."""
    try:
        success = await delete_api_key(key_id, user["id"])
        
        if not success:
            return {"status": "error", "message": "API key not found"}
        
        return {"status": "success", "message": "API key deleted successfully"}
    except Exception as e:
        logger.error(f"Failed to delete API key: {e}")
        return {"status": "error", "message": "Failed to delete API key"}


# =============================================================================
# BUDGET ENDPOINTS
# =============================================================================

@router.get("/api/budget")
async def get_budget(user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """Get complete budget summary with per-key and overall breakdown."""
    try:
        summary = await get_budget_summary(user["id"])
        return summary
    except Exception as e:
        logger.error(f"Failed to get budget: {e}")
        return {"status": "error", "message": "Failed to fetch budget summary"}


@router.put("/api/budget/overall")
async def update_overall_budget(
    req: SetOverallBudgetRequest,
    user: Dict = Depends(require_auth)
) -> Dict[str, Any]:
    """Set the overall budget limit across all API keys."""
    try:
        success = await set_overall_budget(
            user_id=user["id"],
            budget_limit=req.budget_limit,
            alert_threshold=req.alert_threshold,
            period=req.period
        )
        
        if not success:
            return {"status": "error", "message": "Failed to update budget"}
        
        return {
            "status": "success",
            "message": f"Overall budget set to ${req.budget_limit:.2f}/{req.period}",
            "budget": {
                "limit": req.budget_limit,
                "alert_threshold": req.alert_threshold,
                "period": req.period,
            }
        }
    except Exception as e:
        logger.error(f"Failed to set overall budget: {e}")
        return {"status": "error", "message": "Failed to update budget"}


@router.post("/api/budget/reset")
async def reset_all_budgets(user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """Reset all budget counters (overall + all keys)."""
    try:
        await reset_budget(user["id"])
        return {"status": "success", "message": "All budget counters reset to zero"}
    except Exception as e:
        logger.error(f"Failed to reset budgets: {e}")
        return {"status": "error", "message": "Failed to reset budgets"}


@router.post("/api/budget/reset/{key_id}")
async def reset_key_budget(key_id: int, user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """Reset budget counter for a single API key."""
    try:
        await reset_budget(user["id"], key_id=key_id)
        return {"status": "success", "message": "Key budget counter reset to zero"}
    except Exception as e:
        logger.error(f"Failed to reset key budget: {e}")
        return {"status": "error", "message": "Failed to reset key budget"}
