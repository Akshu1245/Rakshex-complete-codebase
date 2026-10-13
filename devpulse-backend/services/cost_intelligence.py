"""
Cost Intelligence Engine — Pillar 2 of the DevPulse v4.0 Platform.

Provides:
- Per-provider, per-model cost tracking
- Token-level cost attribution
- Budget forecasting (linear + weighted moving average)
- Anomaly detection for cost spikes
- ROI calculations
- Cost optimization recommendations

Works with in-memory data when database is unavailable.
"""
import os
import math
import logging
import time
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone, timedelta
from collections import defaultdict

logger = logging.getLogger(__name__)

# ── Pricing data (USD per 1 K tokens, as of 2025-01) ───────────────────────
MODEL_PRICING: Dict[str, Dict[str, float]] = {
    # OpenAI
    "gpt-4o":           {"input": 0.0025, "output": 0.0100},
    "gpt-4o-mini":      {"input": 0.00015, "output": 0.0006},
    "gpt-4-turbo":      {"input": 0.0100, "output": 0.0300},
    "gpt-4":            {"input": 0.0300, "output": 0.0600},
    "gpt-3.5-turbo":    {"input": 0.0005, "output": 0.0015},
    "o1":               {"input": 0.0150, "output": 0.0600},
    "o1-mini":          {"input": 0.0030, "output": 0.0120},
    # Anthropic
    "claude-3.5-sonnet": {"input": 0.0030, "output": 0.0150},
    "claude-3-opus":     {"input": 0.0150, "output": 0.0750},
    "claude-3-haiku":    {"input": 0.00025, "output": 0.00125},
    "claude-4-sonnet":   {"input": 0.0030, "output": 0.0150},
    "claude-4-opus":     {"input": 0.0150, "output": 0.0750},
    # Google
    "gemini-2.0-flash":  {"input": 0.0001, "output": 0.0004},
    "gemini-1.5-pro":    {"input": 0.00125, "output": 0.0050},
    "gemini-1.5-flash":  {"input": 0.000075, "output": 0.0003},
    # Groq (hosted open models)
    "llama-3.3-70b-versatile": {"input": 0.00059, "output": 0.00079},
    "llama-3.1-8b-instant":    {"input": 0.00005, "output": 0.00008},
    "mixtral-8x7b-32768":      {"input": 0.00024, "output": 0.00024},
    # Cohere
    "command-r-plus":   {"input": 0.0030, "output": 0.0150},
    "command-r":        {"input": 0.0005, "output": 0.0015},
}


def calculate_cost(model: str, tokens_input: int, tokens_output: int) -> float:
    """Calculate cost in USD for a single API call."""
    pricing = MODEL_PRICING.get(model, {"input": 0.001, "output": 0.002})
    cost = (tokens_input / 1000 * pricing["input"]) + (tokens_output / 1000 * pricing["output"])
    return round(cost, 6)


def get_supported_models() -> List[Dict[str, Any]]:
    """Return all supported models with pricing info."""
    models = []
    for model, pricing in MODEL_PRICING.items():
        provider = (
            "openai" if model.startswith(("gpt", "o1")) else
            "anthropic" if model.startswith("claude") else
            "google" if model.startswith("gemini") else
            "groq" if model.startswith(("llama", "mixtral")) else
            "cohere" if model.startswith("command") else
            "unknown"
        )
        models.append({
            "model": model,
            "provider": provider,
            "input_per_1k": pricing["input"],
            "output_per_1k": pricing["output"],
        })
    return models


# ═══════════════════════════════════════════════════════════════════════════════
# COST ANALYTICS
# ═══════════════════════════════════════════════════════════════════════════════

def compute_cost_breakdown(call_logs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Compute cost breakdown from a list of API call logs.
    Each log: {provider, model, tokens_input, tokens_output, cost_usd, created_at}
    """
    total_cost = 0.0
    total_tokens_in = 0
    total_tokens_out = 0
    total_calls = len(call_logs)

    by_provider: Dict[str, float] = defaultdict(float)
    by_model: Dict[str, float] = defaultdict(float)
    by_day: Dict[str, float] = defaultdict(float)
    calls_by_provider: Dict[str, int] = defaultdict(int)

    for log in call_logs:
        cost = log.get("cost_usd", 0)
        total_cost += cost
        total_tokens_in += log.get("tokens_input", 0)
        total_tokens_out += log.get("tokens_output", 0)

        provider = log.get("provider", "unknown")
        model = log.get("model", "unknown")
        by_provider[provider] += cost
        by_model[model] += cost
        calls_by_provider[provider] += 1

        created = log.get("created_at", "")
        if created:
            day = str(created)[:10]
            by_day[day] += cost

    # Find most expensive model
    top_model = max(by_model, key=by_model.get, default="none") if by_model else "none"

    return {
        "total_cost_usd": round(total_cost, 4),
        "total_calls": total_calls,
        "total_tokens_input": total_tokens_in,
        "total_tokens_output": total_tokens_out,
        "avg_cost_per_call": round(total_cost / max(total_calls, 1), 6),
        "by_provider": {k: round(v, 4) for k, v in sorted(by_provider.items(), key=lambda x: -x[1])},
        "by_model": {k: round(v, 4) for k, v in sorted(by_model.items(), key=lambda x: -x[1])},
        "by_day": dict(sorted(by_day.items())),
        "calls_by_provider": dict(calls_by_provider),
        "top_model": top_model,
        "top_model_cost": round(by_model.get(top_model, 0), 4),
    }


def forecast_costs(daily_costs: Dict[str, float], days_ahead: int = 30) -> Dict[str, Any]:
    """
    Forecast future costs using weighted moving average.
    daily_costs: {"2025-01-01": 12.50, "2025-01-02": 15.00, ...}
    """
    if not daily_costs:
        return {
            "method": "weighted_moving_average",
            "days_ahead": days_ahead,
            "predicted_total_usd": 0,
            "predicted_daily_avg_usd": 0,
            "daily_predictions": [],
            "confidence": 0,
            "trend": "insufficient_data",
            "current_daily_avg_usd": 0,
        }

    sorted_days = sorted(daily_costs.items())
    values = [v for _, v in sorted_days]

    # Weighted moving average (recent days weighted more)
    window = min(len(values), 14)
    weights = list(range(1, window + 1))
    recent = values[-window:]
    wma = sum(w * v for w, v in zip(weights, recent)) / sum(weights)

    # Trend detection
    if len(values) >= 7:
        first_half = sum(values[:len(values) // 2]) / max(len(values) // 2, 1)
        second_half = sum(values[len(values) // 2:]) / max(len(values) - len(values) // 2, 1)
        if second_half > first_half * 1.1:
            trend = "increasing"
            trend_factor = 1.02  # 2% daily increase
        elif second_half < first_half * 0.9:
            trend = "decreasing"
            trend_factor = 0.98
        else:
            trend = "stable"
            trend_factor = 1.0
    else:
        trend = "insufficient_data"
        trend_factor = 1.0

    # Generate predictions
    predictions = []
    last_date = datetime.strptime(sorted_days[-1][0], "%Y-%m-%d")
    running_cost = wma
    total_predicted = 0

    for i in range(1, days_ahead + 1):
        pred_date = last_date + timedelta(days=i)
        running_cost *= trend_factor
        total_predicted += running_cost
        predictions.append({
            "date": pred_date.strftime("%Y-%m-%d"),
            "predicted_usd": round(running_cost, 4),
        })

    # Confidence based on data quality
    confidence = min(0.95, 0.5 + (len(values) / 60))

    return {
        "method": "weighted_moving_average",
        "days_ahead": days_ahead,
        "predicted_total_usd": round(total_predicted, 2),
        "predicted_daily_avg_usd": round(total_predicted / days_ahead, 4),
        "daily_predictions": predictions,
        "confidence": round(confidence, 2),
        "trend": trend,
        "current_daily_avg_usd": round(sum(values) / len(values), 4),
    }


def detect_cost_anomalies(daily_costs: Dict[str, float], threshold_std: float = 2.0) -> List[Dict[str, Any]]:
    """Detect anomalous cost spikes using standard deviation."""
    if len(daily_costs) < 5:
        return []

    values = list(daily_costs.values())
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / len(values)
    std = math.sqrt(variance) if variance > 0 else 0

    anomalies = []
    for date, cost in daily_costs.items():
        if std > 0 and abs(cost - mean) > threshold_std * std:
            anomalies.append({
                "date": date,
                "cost_usd": round(cost, 4),
                "daily_avg_usd": round(mean, 4),
                "deviation_factor": round((cost - mean) / std, 2),
                "type": "spike" if cost > mean else "dip",
            })

    return anomalies


# ═══════════════════════════════════════════════════════════════════════════════
# OPTIMIZATION RECOMMENDATIONS
# ═══════════════════════════════════════════════════════════════════════════════

def get_optimization_tips(breakdown: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Generate cost optimization recommendations based on usage patterns."""
    tips: List[Dict[str, Any]] = []
    by_model = breakdown.get("by_model", {})
    total = breakdown.get("total_cost_usd", 0)

    # Tip: Switch expensive models to cheaper alternatives
    expensive_models = {
        "gpt-4": "gpt-4o-mini",
        "gpt-4-turbo": "gpt-4o-mini",
        "claude-3-opus": "claude-3.5-sonnet",
        "claude-4-opus": "claude-4-sonnet",
        "gemini-1.5-pro": "gemini-2.0-flash",
    }
    for model, cost in by_model.items():
        if model in expensive_models and cost > 1.0:
            alt = expensive_models[model]
            alt_pricing = MODEL_PRICING.get(alt, {})
            cur_pricing = MODEL_PRICING.get(model, {})
            if cur_pricing and alt_pricing:
                savings_pct = round(
                    (1 - (alt_pricing["output"] / cur_pricing["output"])) * 100
                )
                tips.append({
                    "type": "model_switch",
                    "priority": "high",
                    "title": f"Switch from {model} to {alt}",
                    "description": f"Save ~{savings_pct}% on output tokens by switching to {alt}.",
                    "estimated_monthly_savings_usd": round(cost * savings_pct / 100, 2),
                    "current_model": model,
                    "suggested_model": alt,
                })

    # Tip: Enable caching
    if breakdown.get("total_calls", 0) > 100:
        tips.append({
            "type": "caching",
            "priority": "medium",
            "title": "Enable semantic caching",
            "description": "Cache identical or similar API requests to avoid redundant calls. "
                           "Typical savings: 20-40% on repeat queries.",
            "estimated_monthly_savings_usd": round(total * 0.25, 2),
        })

    # Tip: Reduce token usage
    avg_tokens = breakdown.get("total_tokens_output", 0) / max(breakdown.get("total_calls", 1), 1)
    if avg_tokens > 2000:
        tips.append({
            "type": "token_optimization",
            "priority": "medium",
            "title": "Reduce output token count",
            "description": f"Average output is {int(avg_tokens)} tokens. "
                           "Use max_tokens limits and concise prompts to reduce costs.",
            "estimated_monthly_savings_usd": round(total * 0.15, 2),
        })

    # Tip: Use batch API
    if breakdown.get("total_calls", 0) > 500:
        tips.append({
            "type": "batching",
            "priority": "low",
            "title": "Use batch / async APIs",
            "description": "OpenAI and Anthropic offer batch APIs with 50% cost reduction "
                           "for non-real-time workloads.",
            "estimated_monthly_savings_usd": round(total * 0.3, 2),
        })

    return sorted(tips, key=lambda t: t.get("estimated_monthly_savings_usd", 0), reverse=True)


# ═══════════════════════════════════════════════════════════════════════════════
# ROI CALCULATOR
# ═══════════════════════════════════════════════════════════════════════════════

def calculate_roi(
    monthly_api_spend: float,
    devpulse_plan_cost: float = 29.0,
    estimated_savings_pct: float = 30.0,
    hours_saved_per_month: float = 10.0,
    engineer_hourly_rate: float = 75.0,
) -> Dict[str, Any]:
    """Calculate ROI of using DevPulse."""
    cost_savings = monthly_api_spend * (estimated_savings_pct / 100)
    time_savings_value = hours_saved_per_month * engineer_hourly_rate
    total_value = cost_savings + time_savings_value
    net_savings = total_value - devpulse_plan_cost
    roi_pct = ((total_value - devpulse_plan_cost) / devpulse_plan_cost * 100) if devpulse_plan_cost > 0 else 0

    return {
        "monthly_api_spend": monthly_api_spend,
        "devpulse_plan_cost": devpulse_plan_cost,
        "estimated_api_savings_usd": round(cost_savings, 2),
        "estimated_time_savings_usd": round(time_savings_value, 2),
        "total_monthly_value": round(total_value, 2),
        "net_monthly_savings": round(net_savings, 2),
        "roi_percentage": round(roi_pct, 1),
        "payback_days": round(devpulse_plan_cost / max(net_savings / 30, 0.01), 1) if net_savings > 0 else 999,
        "annual_savings": round(net_savings * 12, 2),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# DEMO DATA (for UI previews / free tier)
# ═══════════════════════════════════════════════════════════════════════════════

def get_demo_cost_data() -> Dict[str, Any]:
    """Return sample cost data for demo / free-tier users."""
    now = datetime.now(timezone.utc)
    daily_costs = {}
    call_logs = []
    providers = ["openai", "anthropic", "google", "groq"]
    models = ["gpt-4o-mini", "claude-3.5-sonnet", "gemini-2.0-flash", "llama-3.3-70b-versatile"]

    import random
    random.seed(42)  # deterministic demo

    for i in range(30):
        day = (now - timedelta(days=29 - i)).strftime("%Y-%m-%d")
        day_cost = 0
        for _ in range(random.randint(20, 80)):
            provider = random.choice(providers)
            model = random.choice(models)
            tokens_in = random.randint(100, 4000)
            tokens_out = random.randint(50, 2000)
            cost = calculate_cost(model, tokens_in, tokens_out)
            day_cost += cost
            call_logs.append({
                "provider": provider,
                "model": model,
                "tokens_input": tokens_in,
                "tokens_output": tokens_out,
                "cost_usd": cost,
                "created_at": day,
            })
        daily_costs[day] = round(day_cost, 4)

    breakdown = compute_cost_breakdown(call_logs)
    forecast = forecast_costs(daily_costs)
    anomalies = detect_cost_anomalies(daily_costs)
    tips = get_optimization_tips(breakdown)

    return {
        "breakdown": breakdown,
        "forecast": forecast,
        "anomalies": anomalies,
        "optimization_tips": tips,
        "daily_costs": daily_costs,
    }
