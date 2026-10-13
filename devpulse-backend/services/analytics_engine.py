"""
Analytics Engine - Usage trends, forecasting, and insights.

Tracks usage events, computes daily aggregates, and provides
linear regression-based forecasting. DB-backed via SQLAlchemy.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

from sqlalchemy import select, func, case, cast, Date, and_, text
from services.db_config import AsyncSessionLocal, IS_POSTGRES
from models.tables import UsageStat

logger = logging.getLogger(__name__)


def _date_ago(days: int):
    """Return a datetime object for ``days`` ago (UTC)."""
    return datetime.now(timezone.utc) - timedelta(days=days)


def _date_trunc_expr():
    """Return a SQL expression that truncates created_at to DATE.
    Works on both PostgreSQL and SQLite."""
    if IS_POSTGRES:
        return cast(UsageStat.created_at, Date)
    else:
        return func.date(UsageStat.created_at)


async def record_event(user_id: Optional[int], endpoint: str,
                       response_time_ms: float, status_code: int):
    """Record a usage event to DB."""
    from services.database import log_usage
    await log_usage(user_id, endpoint, response_time_ms, status_code)


async def get_usage_trends(days: int = 30) -> Dict[str, Any]:
    """Get daily usage trends from DB."""
    cutoff = _date_ago(days)
    date_col = _date_trunc_expr()

    async with AsyncSessionLocal() as session:
        stmt = (
            select(
                date_col.label("date"),
                func.count().label("total_events"),
                func.sum(
                    case((UsageStat.endpoint.like("%generate%"), 1), else_=0)
                ).label("code_generations"),
                func.sum(
                    case((UsageStat.status_code >= 400, 1), else_=0)
                ).label("errors"),
                func.avg(UsageStat.response_time_ms).label("avg_response_ms"),
            )
            .where(UsageStat.created_at > cutoff)
            .group_by(date_col)
            .order_by(date_col.asc())
        )
        result = await session.execute(stmt)
        rows = [dict(r._mapping) for r in result]

    total_events = sum(r.get("total_events", 0) for r in rows)
    total_generations = sum(r.get("code_generations", 0) for r in rows)
    total_errors = sum(r.get("errors", 0) for r in rows)

    daily = []
    for r in rows:
        daily.append({
            "date": str(r["date"]) if r["date"] else None,
            "total_events": r.get("total_events", 0),
            "api_calls": r.get("total_events", 0) - r.get("code_generations", 0),
            "code_generations": r.get("code_generations", 0),
            "errors": r.get("errors", 0),
        })

    return {
        "period_days": days,
        "daily": daily,
        "totals": {
            "total_events": total_events,
            "api_calls": total_events - total_generations,
            "code_generations": total_generations,
            "errors": total_errors,
        },
    }


async def get_api_breakdown(days: int = 30) -> Dict[str, Any]:
    """Get usage breakdown by endpoint."""
    cutoff = _date_ago(days)
    async with AsyncSessionLocal() as session:
        stmt = (
            select(
                UsageStat.endpoint,
                func.count().label("count"),
                func.avg(UsageStat.response_time_ms).label("avg_ms"),
            )
            .where(UsageStat.created_at > cutoff)
            .group_by(UsageStat.endpoint)
            .order_by(func.count().desc())
            .limit(20)
        )
        result = await session.execute(stmt)
        rows = [dict(r._mapping) for r in result]
    return {"breakdown": rows, "period_days": days}


async def get_performance_insights() -> List[Dict[str, Any]]:
    """Generate performance insights from usage data."""
    insights: List[Dict[str, Any]] = []
    cutoff_1d = _date_ago(1)
    cutoff_2d = _date_ago(2)

    async with AsyncSessionLocal() as session:
        # Error rate last 24h
        stmt = select(
            func.count().label("total"),
            func.sum(case((UsageStat.status_code >= 400, 1), else_=0)).label("errors"),
        ).where(UsageStat.created_at > cutoff_1d)
        result = await session.execute(stmt)
        row = dict(result.one()._mapping)
        total = row.get("total") or 0
        errors = row.get("errors") or 0
        if total > 0:
            error_rate = (errors / total) * 100
            if error_rate > 10:
                insights.append({
                    "type": "error_rate", "severity": "high",
                    "message": f"Error rate is {error_rate:.1f}% in the last 24h ({errors}/{total})",
                    "recommendation": "Check failing endpoints and increase error handling",
                })

        # Slow endpoints
        stmt2 = (
            select(
                UsageStat.endpoint,
                func.avg(UsageStat.response_time_ms).label("avg_ms"),
            )
            .where(UsageStat.created_at > cutoff_1d)
            .group_by(UsageStat.endpoint)
            .having(func.avg(UsageStat.response_time_ms) > 2000)
        )
        result2 = await session.execute(stmt2)
        for s in result2:
            m = dict(s._mapping)
            insights.append({
                "type": "slow_endpoint", "severity": "medium",
                "message": f"Endpoint {m['endpoint']} avg {m['avg_ms']:.0f}ms",
                "recommendation": "Consider caching, optimize queries, or add timeout handling",
            })

        # Usage growth
        today_r = await session.execute(
            select(func.count()).select_from(UsageStat).where(UsageStat.created_at > cutoff_1d)
        )
        today_count = today_r.scalar() or 0

        yesterday_r = await session.execute(
            select(func.count()).select_from(UsageStat).where(
                and_(UsageStat.created_at > cutoff_2d, UsageStat.created_at <= cutoff_1d)
            )
        )
        yesterday_count = yesterday_r.scalar() or 0

        if yesterday_count > 0:
            growth = ((today_count - yesterday_count) / yesterday_count) * 100
            if growth > 50:
                insights.append({
                    "type": "usage_spike", "severity": "info",
                    "message": f"Usage increased {growth:.0f}% vs yesterday",
                    "recommendation": "Monitor capacity and budget limits",
                })

    if not insights:
        insights.append({
            "type": "all_good", "severity": "info",
            "message": "All systems operating normally",
            "recommendation": "No action needed",
        })

    return insights


async def forecast_usage(days_ahead: int = 7) -> Dict[str, Any]:
    """Forecast future usage using linear regression on recent data."""
    cutoff = _date_ago(30)
    date_col = _date_trunc_expr()

    async with AsyncSessionLocal() as session:
        stmt = (
            select(date_col.label("date"), func.count().label("count"))
            .where(UsageStat.created_at > cutoff)
            .group_by(date_col)
            .order_by(date_col.asc())
        )
        result = await session.execute(stmt)
        rows = [dict(r._mapping) for r in result]

    if len(rows) < 3:
        return {
            "forecast": [], "confidence": "low",
            "message": "Not enough historical data (need 3+ days)",
        }

    # Simple linear regression
    n = len(rows)
    x_vals = list(range(n))
    y_vals = [r["count"] for r in rows]
    x_mean = sum(x_vals) / n
    y_mean = sum(y_vals) / n
    numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_vals, y_vals))
    denominator = sum((x - x_mean) ** 2 for x in x_vals)
    slope = numerator / denominator if denominator != 0 else 0
    intercept = y_mean - slope * x_mean

    # Generate forecast
    forecast = []
    today = datetime.now(timezone.utc).date()
    for i in range(1, days_ahead + 1):
        future_date = today + timedelta(days=i)
        predicted = max(0, round(intercept + slope * (n + i - 1)))
        forecast.append({"date": future_date.isoformat(), "predicted_events": predicted})

    confidence = "high" if n >= 14 else "medium" if n >= 7 else "low"
    return {
        "forecast": forecast,
        "confidence": confidence,
        "trend": "increasing" if slope > 0.5 else "decreasing" if slope < -0.5 else "stable",
        "slope": round(slope, 2),
        "historical_days": n,
    }
