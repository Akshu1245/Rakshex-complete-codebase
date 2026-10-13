"""
Tests for Cost Intelligence Engine (Pillar 2)
Covers: model pricing, cost calculation, breakdown, forecast,
anomalies, optimization, ROI, dashboard, budgets.
"""
import pytest
import pytest_asyncio
from typing import Dict
from httpx import AsyncClient


# ── Model Pricing ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_model_pricing(client: AsyncClient, auth_headers: Dict[str, str]):
    """Should return pricing for multiple AI models."""
    resp = await client.get("/api/v1/costs/models", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "models" in data
    models = data["models"]
    assert len(models) >= 10
    # Check a known model
    assert any(m.get("model") == "gpt-4o" for m in models)


# ── Cost Calculation ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_calculate_cost_gpt4o(client: AsyncClient, auth_headers: Dict[str, str]):
    """Should calculate cost for gpt-4o."""
    resp = await client.post("/api/v1/costs/calculate", json={
        "provider": "openai",
        "model": "gpt-4o",
        "tokens_input": 1000,
        "tokens_output": 500,
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "cost_usd" in data
    assert data["cost_usd"] > 0
    assert data["model"] == "gpt-4o"


@pytest.mark.asyncio
async def test_calculate_cost_unknown_model(client: AsyncClient, auth_headers: Dict[str, str]):
    """Unknown model should still return a response (possibly error or zero)."""
    resp = await client.post("/api/v1/costs/calculate", json={
        "provider": "unknown",
        "model": "nonexistent-model",
        "tokens_input": 1000,
        "tokens_output": 500,
    }, headers=auth_headers)
    assert resp.status_code in [200, 400, 404]


@pytest.mark.asyncio
async def test_calculate_cost_zero_tokens(client: AsyncClient, auth_headers: Dict[str, str]):
    """Zero tokens should return zero cost."""
    resp = await client.post("/api/v1/costs/calculate", json={
        "provider": "openai",
        "model": "gpt-4o",
        "tokens_input": 0,
        "tokens_output": 0,
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["cost_usd"] == 0


# ── Cost Breakdown ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cost_breakdown(client: AsyncClient, auth_headers: Dict[str, str]):
    """Should return cost breakdown with by_provider, by_model, by_day."""
    resp = await client.get("/api/v1/costs/breakdown?days=30", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "by_provider" in data
    assert "by_model" in data
    assert "by_day" in data
    assert "total_cost_usd" in data


# ── Forecasting ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cost_forecast(client: AsyncClient, auth_headers: Dict[str, str]):
    """Should return a forecast with daily cost estimate."""
    resp = await client.get("/api/v1/costs/forecast?days=30", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "predicted_daily_avg_usd" in data
    assert "predicted_total_usd" in data
    assert "confidence" in data


# ── Anomaly Detection ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cost_anomalies(client: AsyncClient, auth_headers: Dict[str, str]):
    """Should return anomalies list."""
    resp = await client.get("/api/v1/costs/anomalies", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "anomalies" in data
    assert isinstance(data["anomalies"], list)


# ── Optimization Tips ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_optimization_tips(client: AsyncClient, auth_headers: Dict[str, str]):
    """Should return optimization recommendations."""
    resp = await client.get("/api/v1/costs/optimization", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "tips" in data
    assert isinstance(data["tips"], list)


# ── ROI Calculator ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_roi_calculation(client: AsyncClient, auth_headers: Dict[str, str]):
    """Should calculate ROI with savings estimates."""
    resp = await client.post("/api/v1/costs/roi", json={
        "monthly_api_spend": 5000,
        "plan_cost": 29.0,
    }, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "net_monthly_savings" in data
    assert "annual_savings" in data
    assert "roi_percentage" in data
    assert data["annual_savings"] > 0


# ── Dashboard Composite ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_cost_dashboard_composite(client: AsyncClient, auth_headers: Dict[str, str]):
    """Dashboard should return breakdown, forecast, anomalies, optimization."""
    resp = await client.get("/api/v1/costs/dashboard", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "breakdown" in data
    assert "forecast" in data
    assert "anomalies" in data
    assert "optimization_tips" in data


# ── Budgets ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_and_get_budget(client: AsyncClient, auth_headers: Dict[str, str]):
    """Should create a budget and retrieve it."""
    # Create
    resp = await client.post("/api/v1/costs/budgets", json={
        "name": "Test Budget",
        "provider": "openai",
        "monthly_limit_usd": 100.0,
        "alert_threshold_pct": 80,
    }, headers=auth_headers)
    assert resp.status_code == 200

    # Get
    resp = await client.get("/api/v1/costs/budgets", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "budgets" in data
    assert isinstance(data["budgets"], list)
