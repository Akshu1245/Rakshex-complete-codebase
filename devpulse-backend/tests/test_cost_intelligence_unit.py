"""
Tests for Cost Intelligence Engine service (unit tests).
Tests the pure functions without HTTP layer.

Return types:
- MODEL_PRICING: dict[str, {input: float, output: float}] (prices per 1K tokens)
- calculate_cost(model, tokens_in, tokens_out) -> float
- get_supported_models() -> list[{model, provider, input_per_1k, output_per_1k}]
- compute_cost_breakdown(call_logs) -> {total_cost_usd, total_calls, ...}
- forecast_costs(daily_costs, days_ahead) -> {method, predicted_total_usd, ...}
- detect_cost_anomalies(daily_costs, threshold_std) -> list[{date, cost_usd, ...}]
- get_optimization_tips(breakdown) -> list[{type, priority, title, ...}]
- calculate_roi(monthly_api_spend, ...) -> {monthly_api_spend, net_monthly_savings, annual_savings, ...}
- get_demo_cost_data() -> {breakdown, forecast, anomalies, optimization_tips, daily_costs}
"""
import pytest
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.cost_intelligence import (
    MODEL_PRICING,
    calculate_cost,
    get_supported_models,
    compute_cost_breakdown,
    forecast_costs,
    detect_cost_anomalies,
    get_optimization_tips,
    calculate_roi,
    get_demo_cost_data,
)


class TestModelPricing:
    """Verify model pricing data."""

    def test_has_openai_models(self):
        assert "gpt-4o" in MODEL_PRICING
        assert "gpt-4o-mini" in MODEL_PRICING

    def test_has_anthropic_models(self):
        assert "claude-3.5-sonnet" in MODEL_PRICING

    def test_pricing_structure(self):
        for model, pricing in MODEL_PRICING.items():
            assert "input" in pricing, f"{model} missing input"
            assert "output" in pricing, f"{model} missing output"
            assert pricing["input"] >= 0
            assert pricing["output"] >= 0

    def test_at_least_15_models(self):
        assert len(MODEL_PRICING) >= 15


class TestCalculateCost:
    """Test cost calculation function — returns float (USD cost)."""

    def test_basic_calculation(self):
        cost = calculate_cost("gpt-4o", 1000, 500)
        assert isinstance(cost, float)
        assert cost > 0

    def test_zero_tokens(self):
        cost = calculate_cost("gpt-4o", 0, 0)
        assert cost == 0

    def test_input_cost_component(self):
        # Only input tokens, gpt-4o input = $0.0025/1K
        cost = calculate_cost("gpt-4o", 1000, 0)
        expected = 1000 / 1000 * MODEL_PRICING["gpt-4o"]["input"]
        assert abs(cost - expected) < 0.0001

    def test_unknown_model_returns_default_cost(self):
        # Unknown model uses fallback pricing {input: 0.001, output: 0.002}
        cost = calculate_cost("nonexistent", 1000, 500)
        assert isinstance(cost, float)
        assert cost > 0


class TestCostBreakdown:
    """Test cost breakdown computation — requires call_logs list."""

    def test_has_required_keys(self):
        demo = get_demo_cost_data()
        breakdown = demo["breakdown"]
        assert "by_provider" in breakdown
        assert "by_model" in breakdown
        assert "by_day" in breakdown
        assert "total_cost_usd" in breakdown

    def test_total_is_nonnegative(self):
        demo = get_demo_cost_data()
        breakdown = demo["breakdown"]
        assert breakdown["total_cost_usd"] >= 0


class TestForecast:
    """Test cost forecasting — requires daily_costs dict {date_str: cost}."""

    def test_forecast_returns_fields(self):
        demo = get_demo_cost_data()
        forecast = demo["forecast"]
        assert "predicted_total_usd" in forecast
        assert "predicted_daily_avg_usd" in forecast
        assert "confidence" in forecast
        assert "trend" in forecast

    def test_forecast_positive_values(self):
        demo = get_demo_cost_data()
        forecast = demo["forecast"]
        assert forecast["predicted_total_usd"] >= 0
        assert forecast["predicted_daily_avg_usd"] >= 0


class TestAnomalies:
    """Test anomaly detection — returns list of anomaly dicts."""

    def test_returns_list(self):
        demo = get_demo_cost_data()
        anomalies = demo["anomalies"]
        assert isinstance(anomalies, list)


class TestOptimization:
    """Test optimization recommendations — returns list of tip dicts."""

    def test_returns_list(self):
        demo = get_demo_cost_data()
        tips = demo["optimization_tips"]
        assert isinstance(tips, list)


class TestROI:
    """Test ROI calculator — returns dict with savings info."""

    def test_positive_savings(self):
        result = calculate_roi(monthly_api_spend=5000)
        assert result["net_monthly_savings"] > 0
        assert result["annual_savings"] > 0
        assert result["roi_percentage"] > 0

    def test_zero_cost(self):
        result = calculate_roi(monthly_api_spend=0)
        assert "net_monthly_savings" in result
        assert "annual_savings" in result

    def test_small_spend(self):
        result = calculate_roi(monthly_api_spend=500)
        assert "net_monthly_savings" in result
        assert "payback_days" in result


class TestDemoData:
    """Test demo data generator — returns dict with composite data."""

    def test_generates_data(self):
        data = get_demo_cost_data()
        assert isinstance(data, dict)
        assert "breakdown" in data
        assert "forecast" in data
        assert "anomalies" in data
        assert "optimization_tips" in data

    def test_data_structure(self):
        data = get_demo_cost_data()
        assert "daily_costs" in data
        assert isinstance(data["daily_costs"], dict)
        assert len(data["daily_costs"]) > 0
