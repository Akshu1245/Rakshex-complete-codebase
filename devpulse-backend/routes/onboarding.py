"""
Onboarding Routes - User signup with trial + guided onboarding steps.

Endpoints:
- POST /api/onboarding/signup       - Register with 14-day Pro trial
- GET  /api/onboarding/status       - Get onboarding progress
- POST /api/onboarding/complete     - Mark a step as done
- GET  /api/onboarding/trial-info   - Trial days remaining
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from routes.auth import require_auth, create_token, RegisterRequest
from services.database import create_user
from services.onboarding_store import get_progress, complete_step, start_trial

logger = logging.getLogger(__name__)
router = APIRouter()

ONBOARDING_STEPS = [
    {"id": "add_api", "title": "Add your first API", "description": "Monitor an API endpoint"},
    {"id": "set_budget", "title": "Set a budget alert", "description": "Get notified before cost overruns"},
    {"id": "run_scan", "title": "Run a security scan", "description": "Check your API for vulnerabilities"},
    {"id": "invite_team", "title": "Invite a teammate", "description": "Collaborate with your team"},
]

TRIAL_DAYS = 14


class OnboardingSignupRequest(RegisterRequest):
    pass


class CompleteStepRequest(BaseModel):
    step_id: str = Field(..., description="One of: add_api, set_budget, run_scan, invite_team")


@router.post("/api/onboarding/signup")
async def signup_with_trial(req: OnboardingSignupRequest) -> Dict[str, Any]:
    """Register a new user with a 14-day Pro trial."""
    try:
        password_hash = bcrypt.hashpw(
            req.password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

        user_id = await create_user(req.email, req.username, password_hash)
        if user_id is None:
            return {"status": "error", "message": "Email or username already exists"}

        # Activate Pro trial
        trial_end = datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS)
        await start_trial(user_id, trial_end)
        token = create_token(user_id, req.email)

        return {
            "status": "success",
            "token": token,
            "user": {
                "id": user_id,
                "email": req.email,
                "username": req.username,
                "plan": "pro",
                "trial": True,
                "trial_days_remaining": TRIAL_DAYS,
            },
            "onboarding": {
                "steps": ONBOARDING_STEPS,
                "completed": [],
            },
        }
    except Exception as e:
        logger.error(f"Onboarding signup error: {e}")
        return {"status": "error", "message": "Failed to create account"}


@router.get("/api/onboarding/status")
async def onboarding_status(user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """Get current onboarding progress."""
    completed = await get_progress(user["id"])
    total = len(ONBOARDING_STEPS)
    done = len(completed)

    return {
        "status": "success",
        "steps": ONBOARDING_STEPS,
        "completed": completed,
        "progress_percent": round((done / total) * 100) if total > 0 else 0,
        "all_done": done >= total,
    }


@router.post("/api/onboarding/complete")
async def complete_onboarding_step(
    req: CompleteStepRequest,
    user: Dict = Depends(require_auth),
) -> Dict[str, Any]:
    """Mark an onboarding step as completed."""
    valid_ids = {s["id"] for s in ONBOARDING_STEPS}
    if req.step_id not in valid_ids:
        return {"status": "error", "error": f"Unknown step: {req.step_id}"}

    total = len(ONBOARDING_STEPS)
    completed = await complete_step(user["id"], req.step_id, total)

    return {
        "status": "success",
        "step_id": req.step_id,
        "completed": completed,
        "progress_percent": round((len(completed) / total) * 100),
        "all_done": len(completed) >= total,
    }


@router.get("/api/onboarding/trial-info")
async def trial_info(user: Dict = Depends(require_auth)) -> Dict[str, Any]:
    """Get trial status and days remaining."""
    trial_end_str = user.get("trial_ends_at")

    if trial_end_str:
        trial_end = datetime.fromisoformat(trial_end_str)
        if trial_end.tzinfo is None:
            trial_end = trial_end.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        days_left = max(0, (trial_end - now).days)
        expired = trial_end <= now
    else:
        days_left = 0
        expired = True

    return {
        "status": "success",
        "plan": user.get("plan", "free"),
        "trial_active": not expired and user.get("plan") == "pro",
        "trial_days_remaining": days_left,
        "trial_end": trial_end_str,
    }
