"""
Cost Intelligence Routes — /api/v1/costs/*

Pillar 2: API Cost Intelligence.
Exposes endpoints for cost tracking, breakdown, forecasting,
anomaly detection, optimization tips, ROI calculation, and model pricing.
All data is DB-backed via the ApiCallLog and CostBudget tables.
"""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from routes.auth import require_auth
from services.cost_intelligence import (
    calculate_cost,
    get_supported_models,
    compute_cost_breakdown,
    forecast_costs,
    detect_cost_anomalies,
    get_optimization_tips,
    calculate_roi,
)
from services.database import (
    save_api_call_log,
    get_api_call_logs,
    get_api_call_daily_costs,
    save_cost_budget,
    get_cost_budgets,
    delete_cost_budget,
)
from services.cache import cache_get, cache_set

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/costs", tags=["Cost Intelligence"])


# ── Request models ──────────────────────────────────────────────────────────

class LogCallRequest(BaseModel):
    provider: str = Field(..., max_length=100)
    model: str = Field(..., max_length=100)
    tokens_input: int = Field(0, ge=0)
    tokens_output: int = Field(0, ge=0)
    endpoint: str = Field("", max_length=500)
    latency_ms: float = Field(0, ge=0)
    status_code: int = Field(200)


class ROIRequest(BaseModel):
    monthly_api_spend: float = Field(..., ge=0, description="Current monthly API spend in USD")
    plan_cost: float = Field(29.0, ge=0)
    estimated_savings_pct: float = Field(30.0, ge=0, le=100)
    hours_saved_per_month: float = Field(10.0, ge=0)
    engineer_hourly_rate: float = Field(75.0, ge=0)


class BudgetRequest(BaseModel):
    name: str = Field(..., max_length=255)
    provider: str = Field("", max_length=100)
    monthly_limit_usd: float = Field(..., gt=0)
    alert_threshold_pct: float = Field(80, ge=0, le=100)
    auto_kill: bool = False


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/models")
async def list_models_endpoint(user=Depends(require_auth)):
    """List all supported AI models with pricing."""
    try:
        models = get_supported_models()
        return {"status": "ok", "models": models, "total": len(models)}
    except Exception as e:
        logger.error(f"List models failed: {e}")
        raise HTTPException(500, "Failed to list models")


@router.post("/calculate")
async def calculate_cost_endpoint(req: LogCallRequest, user=Depends(require_auth)):
    """Calculate cost for a single API call and log it to the database."""
    try:
        cost = calculate_cost(req.model, req.tokens_input, req.tokens_output)
        # Determine provider from model name
        provider = req.provider
        if not provider:
            provider = (
                "openai" if req.model.startswith(("gpt", "o1")) else
                "anthropic" if req.model.startswith("claude") else
                "google" if req.model.startswith("gemini") else
                "groq" if req.model.startswith(("llama", "mixtral")) else
                "cohere" if req.model.startswith("command") else
                "unknown"
            )
        # Persist to database
        user_id = user.get("user_id", 0)
        if user_id:
            try:
                await save_api_call_log(
                    user_id=user_id,
                    provider=provider,
                    model=req.model,
                    endpoint=req.endpoint,
                    tokens_input=req.tokens_input,
                    tokens_output=req.tokens_output,
                    cost_usd=cost,
                    latency_ms=req.latency_ms,
                    status_code=req.status_code,
                )
            except Exception as db_err:
                logger.warning(f"Failed to log API call to DB: {db_err}")
        return {
            "status": "ok",
            "model": req.model,
            "provider": provider,
            "tokens_input": req.tokens_input,
            "tokens_output": req.tokens_output,
            "cost_usd": cost,
            "logged": True,
        }
    except Exception as e:
        logger.error(f"Cost calculation failed: {e}")
        raise HTTPException(500, "Cost calculation failed")


@router.get("/breakdown")
async def cost_breakdown_endpoint(
    user=Depends(require_auth),
    days: int = Query(30, ge=1, le=365),
):
    """Get cost breakdown by provider, model, and day."""
    try:
        cache_key = f"cost_breakdown:{user.get('user_id', 0)}:{days}"
        cached = await cache_get(cache_key)
        if cached:
            return {"status": "ok", **cached, "cached": True}

        # Real DB-backed implementation: query ApiCallLog table
        user_id = user.get("user_id", 0)
        call_logs = await get_api_call_logs(user_id, days=days)
        result = compute_cost_breakdown(call_logs)
        await cache_set(cache_key, result, ttl=120)
        return {"status": "ok", **result, "cached": False}
    except Exception as e:
        logger.error(f"Cost breakdown failed: {e}")
        raise HTTPException(500, "Cost breakdown failed")


@router.get("/forecast")
async def cost_forecast_endpoint(
    user=Depends(require_auth),
    days_ahead: int = Query(30, ge=1, le=90),
):
    """Forecast future API costs based on historical usage."""
    try:
        cache_key = f"cost_forecast:{user.get('user_id', 0)}:{days_ahead}"
        cached = await cache_get(cache_key)
        if cached:
            return {"status": "ok", **cached, "cached": True}

        # Real DB-backed: query daily costs, then forecast
        user_id = user.get("user_id", 0)
        daily_costs = await get_api_call_daily_costs(user_id, days=60)
        result = forecast_costs(daily_costs, days_ahead=days_ahead)
        await cache_set(cache_key, result, ttl=300)
        return {"status": "ok", **result, "cached": False}
    except Exception as e:
        logger.error(f"Cost forecast failed: {e}")
        raise HTTPException(500, "Cost forecast failed")


@router.get("/anomalies")
async def cost_anomalies_endpoint(user=Depends(require_auth)):
    """Detect cost anomalies and spending spikes."""
    try:
        # Real DB-backed anomaly detection
        user_id = user.get("user_id", 0)
        daily_costs = await get_api_call_daily_costs(user_id, days=60)
        anomalies = detect_cost_anomalies(daily_costs)
        return {"status": "ok", "anomalies": anomalies, "total": len(anomalies)}
    except Exception as e:
        logger.error(f"Anomaly detection failed: {e}")
        raise HTTPException(500, "Anomaly detection failed")


@router.get("/optimization")
async def optimization_tips_endpoint(user=Depends(require_auth)):
    """Get AI-powered cost optimization recommendations."""
    try:
        # Real DB-backed optimization tips
        user_id = user.get("user_id", 0)
        call_logs = await get_api_call_logs(user_id, days=30)
        breakdown = compute_cost_breakdown(call_logs)
        tips = get_optimization_tips(breakdown)
        total_potential_savings = sum(t.get("estimated_monthly_savings_usd", 0) for t in tips)
        return {
            "status": "ok",
            "tips": tips,
            "total": len(tips),
            "total_potential_monthly_savings_usd": round(total_potential_savings, 2),
        }
    except Exception as e:
        logger.error(f"Optimization tips failed: {e}")
        raise HTTPException(500, "Optimization tips failed")


@router.post("/roi")
async def roi_calculator_endpoint(req: ROIRequest, user=Depends(require_auth)):
    """Calculate ROI of using DevPulse."""
    try:
        result = calculate_roi(
            monthly_api_spend=req.monthly_api_spend,
            devpulse_plan_cost=req.plan_cost,
            estimated_savings_pct=req.estimated_savings_pct,
            hours_saved_per_month=req.hours_saved_per_month,
            engineer_hourly_rate=req.engineer_hourly_rate,
        )
        return {"status": "ok", **result}
    except Exception as e:
        logger.error(f"ROI calculation failed: {e}")
        raise HTTPException(500, "ROI calculation failed")


@router.get("/dashboard")
async def cost_dashboard_endpoint(user=Depends(require_auth)):
    """Get complete cost intelligence dashboard data."""
    try:
        cache_key = f"cost_dashboard:{user.get('user_id', 0)}"
        cached = await cache_get(cache_key)
        if cached:
            return {"status": "ok", **cached, "cached": True}

        # Real DB-backed full dashboard
        user_id = user.get("user_id", 0)
        call_logs = await get_api_call_logs(user_id, days=30)
        daily_costs = await get_api_call_daily_costs(user_id, days=30)
        breakdown = compute_cost_breakdown(call_logs)
        forecast = forecast_costs(daily_costs)
        anomalies = detect_cost_anomalies(daily_costs)
        tips = get_optimization_tips(breakdown)
        dashboard_data = {
            "breakdown": breakdown,
            "forecast": forecast,
            "anomalies": anomalies,
            "optimization_tips": tips,
            "daily_costs": daily_costs,
        }
        await cache_set(cache_key, dashboard_data, ttl=120)
        return {"status": "ok", **dashboard_data, "cached": False}
    except Exception as e:
        logger.error(f"Cost dashboard failed: {e}")
        raise HTTPException(500, "Cost dashboard failed")


@router.post("/budgets")
async def create_budget_endpoint(req: BudgetRequest, user=Depends(require_auth)):
    """Create a cost budget with alerts and optional auto-kill. Persisted to DB."""
    try:
        user_id = user.get("user_id", 0)
        budget = await save_cost_budget(
            user_id=user_id,
            name=req.name,
            provider=req.provider,
            monthly_limit_usd=req.monthly_limit_usd,
            alert_threshold_pct=req.alert_threshold_pct,
            auto_kill=req.auto_kill,
        )
        return {"status": "ok", "budget": budget}
    except Exception as e:
        logger.error(f"Create budget failed: {e}")
        raise HTTPException(500, "Budget creation failed")


@router.get("/budgets")
async def list_budgets_endpoint(user=Depends(require_auth)):
    """List all cost budgets for the user. Real DB-backed with live spend calculation."""
    try:
        user_id = user.get("user_id", 0)
        budgets = await get_cost_budgets(user_id)
        return {"status": "ok", "budgets": budgets, "total": len(budgets)}
    except Exception as e:
        logger.error(f"List budgets failed: {e}")
        raise HTTPException(500, "Failed to list budgets")


@router.delete("/budgets/{budget_id}")
async def delete_budget_endpoint(budget_id: int, user=Depends(require_auth)):
    """Delete a cost budget."""
    try:
        user_id = user.get("user_id", 0)
        ok = await delete_cost_budget(budget_id, user_id)
        if ok:
            return {"status": "ok", "message": f"Budget {budget_id} deleted"}
        raise HTTPException(404, "Budget not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete budget failed: {e}")
        raise HTTPException(500, "Failed to delete budget")


@router.post("/log")
async def log_api_call_endpoint(req: LogCallRequest, user=Depends(require_auth)):
    """Manually log an API call for cost tracking."""
    try:
        user_id = user.get("user_id", 0)
        cost = calculate_cost(req.model, req.tokens_input, req.tokens_output)
        provider = req.provider
        if not provider:
            provider = (
                "openai" if req.model.startswith(("gpt", "o1")) else
                "anthropic" if req.model.startswith("claude") else
                "google" if req.model.startswith("gemini") else
                "groq" if req.model.startswith(("llama", "mixtral")) else
                "cohere" if req.model.startswith("command") else
                "unknown"
            )
        log_id = await save_api_call_log(
            user_id=user_id,
            provider=provider,
            model=req.model,
            endpoint=req.endpoint,
            tokens_input=req.tokens_input,
            tokens_output=req.tokens_output,
            cost_usd=cost,
            latency_ms=req.latency_ms,
            status_code=req.status_code,
        )
        return {"status": "ok", "log_id": log_id, "cost_usd": cost}
    except Exception as e:
        logger.error(f"Log API call failed: {e}")
        raise HTTPException(500, "Failed to log API call")


@router.get("/logs")
async def list_api_call_logs_endpoint(
    user=Depends(require_auth),
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(100, ge=1, le=1000),
):
    """List recent API call logs."""
    try:
        user_id = user.get("user_id", 0)
        logs = await get_api_call_logs(user_id, days=days, limit=limit)
        return {"status": "ok", "logs": logs, "total": len(logs)}
    except Exception as e:
        logger.error(f"List API call logs failed: {e}")
        raise HTTPException(500, "Failed to list API call logs")
