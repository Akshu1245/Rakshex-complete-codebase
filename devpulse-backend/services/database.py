"""
Database Service — SQLAlchemy 2.0 async ORM layer for DevPulse.

Every public function preserves the exact same signature and return
shape as the original SQLite/aiosqlite implementation so that all
routes and service modules keep working without changes.

Engine & session come from ``services.db_config``.
ORM models come from ``models.tables``.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from sqlalchemy import select, update, delete, func, and_, or_, desc, asc, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from services.db_config import (
    AsyncSessionLocal,
    engine,
    init_db as _init_engine_tables,
    close_db as _close_engine,
)
from models.tables import (
    User, ApiKey, BudgetLog, CodeHistory, UsageStat,
    ApiResponse, ChangeAlert, SecurityScan,
    AiSecurityScan, ThreatEvent,
    ApiCallLog, CostBudget,
    Incident, IncidentEvent,
    AlertConfig, AlertHistory, KillSwitch,
    Team, TeamMember,
    MarketplaceTemplate, MarketplaceReview,
    CicdRun, BillingEvent, CustomApi,
)

logger = logging.getLogger(__name__)


# ═════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═════════════════════════════════════════════════════════════════════════════

def _row_to_dict(obj) -> Dict[str, Any]:
    """Convert an ORM instance to a plain dict (matches old ``dict(row)`` output)."""
    if obj is None:
        return {}
    d: dict = {}
    for c in obj.__table__.columns:
        val = getattr(obj, c.name, None)
        # Convert datetime to ISO string (matches SQLite behaviour)
        if isinstance(val, datetime):
            val = val.isoformat()
        d[c.name] = val
    return d


# ═════════════════════════════════════════════════════════════════════════════
# LIFECYCLE
# ═════════════════════════════════════════════════════════════════════════════

async def init_db() -> None:
    """Create all tables via ORM metadata (dev/test)."""
    await _init_engine_tables()


async def close_db() -> None:
    """Dispose connection pool."""
    await _close_engine()


async def get_db():
    """Legacy helper — returns an AsyncSession (for analytics_engine compat)."""
    return AsyncSessionLocal()


# ═════════════════════════════════════════════════════════════════════════════
# USERS
# ═════════════════════════════════════════════════════════════════════════════

async def create_user(email: str, username: str, password_hash: str) -> int:
    """Create a new user. Returns the user id."""
    async with AsyncSessionLocal() as session:
        user = User(email=email, username=username, password_hash=password_hash)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user.id


async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Get user by email address."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        return _row_to_dict(user) if user else None


async def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Get user by primary key."""
    async with AsyncSessionLocal() as session:
        user = await session.get(User, user_id)
        return _row_to_dict(user) if user else None


async def increment_api_calls(user_id: int) -> Dict[str, Any]:
    """Increment daily API call counter, resetting if the date has changed."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    async with AsyncSessionLocal() as session:
        user = await session.get(User, user_id)
        if not user:
            return {"allowed": True, "calls_today": 0}

        if user.api_calls_reset_date != today:
            user.api_calls_today = 0
            user.api_calls_reset_date = today

        user.api_calls_today = (user.api_calls_today or 0) + 1
        calls = user.api_calls_today
        await session.commit()
        return {"allowed": True, "calls_today": calls}


# ═════════════════════════════════════════════════════════════════════════════
# CODE HISTORY
# ═════════════════════════════════════════════════════════════════════════════

async def save_code_history(user_id: Optional[int], use_case: str, language: str,
                            generated_code: str, apis_used: List[str],
                            validation_score: int, validation_grade: str,
                            status: str, tokens_used: int = 0) -> int:
    """Save generated code to history. Returns the new id."""
    async with AsyncSessionLocal() as session:
        entry = CodeHistory(
            user_id=user_id,
            use_case=use_case,
            language=language,
            generated_code=generated_code,
            apis_used=apis_used,
            validation_score=validation_score,
            validation_grade=validation_grade,
            status=status,
            tokens_used=tokens_used,
        )
        session.add(entry)
        await session.commit()
        await session.refresh(entry)
        return entry.id


async def get_code_history(user_id: Optional[int] = None,
                           limit: int = 20) -> List[Dict[str, Any]]:
    """Get code generation history."""
    async with AsyncSessionLocal() as session:
        stmt = select(CodeHistory)
        if user_id is not None:
            stmt = stmt.where(CodeHistory.user_id == user_id)
        stmt = stmt.order_by(desc(CodeHistory.created_at)).limit(limit)
        result = await session.execute(stmt)
        rows = result.scalars().all()
        out = []
        for r in rows:
            d = _row_to_dict(r)
            # apis_used is JSON in ORM — already a list
            if isinstance(d.get("apis_used"), str):
                try:
                    d["apis_used"] = json.loads(d["apis_used"])
                except Exception:
                    d["apis_used"] = []
            out.append(d)
        return out


# ═════════════════════════════════════════════════════════════════════════════
# USAGE STATS / ANALYTICS
# ═════════════════════════════════════════════════════════════════════════════

async def log_usage(user_id: Optional[int], endpoint: str,
                    response_time_ms: float, status_code: int) -> int:
    """Log an API usage event."""
    async with AsyncSessionLocal() as session:
        stat = UsageStat(
            user_id=user_id,
            endpoint=endpoint,
            response_time_ms=response_time_ms,
            status_code=status_code,
        )
        session.add(stat)
        await session.commit()
        await session.refresh(stat)
        return stat.id


async def get_usage_stats(user_id: Optional[int] = None,
                          limit: int = 100) -> List[Dict[str, Any]]:
    """Get usage statistics."""
    async with AsyncSessionLocal() as session:
        stmt = select(UsageStat)
        if user_id is not None:
            stmt = stmt.where(UsageStat.user_id == user_id)
        stmt = stmt.order_by(desc(UsageStat.created_at)).limit(limit)
        result = await session.execute(stmt)
        return [_row_to_dict(r) for r in result.scalars().all()]


# ═════════════════════════════════════════════════════════════════════════════
# API KEYS
# ═════════════════════════════════════════════════════════════════════════════

async def add_api_key(user_id: int, key_name: str, api_provider: str,
                      encrypted_key: str, budget_limit: float = 0,
                      call_limit: int = 0) -> int:
    """Store a new API key. Returns the key id."""
    async with AsyncSessionLocal() as session:
        key = ApiKey(
            user_id=user_id,
            key_name=key_name,
            api_provider=api_provider,
            encrypted_key=encrypted_key,
            budget_limit=budget_limit,
            call_limit=call_limit,
        )
        session.add(key)
        await session.commit()
        await session.refresh(key)
        return key.id


async def get_api_keys(user_id: int) -> List[Dict[str, Any]]:
    """Get all API keys for a user (ordered by created_at DESC)."""
    async with AsyncSessionLocal() as session:
        stmt = (
            select(ApiKey)
            .where(ApiKey.user_id == user_id)
            .order_by(desc(ApiKey.created_at))
        )
        result = await session.execute(stmt)
        return [_row_to_dict(k) for k in result.scalars().all()]


async def get_api_key_by_id(key_id: int, user_id: int) -> Optional[Dict[str, Any]]:
    """Get a single API key by ID, verifying ownership."""
    async with AsyncSessionLocal() as session:
        stmt = select(ApiKey).where(
            and_(ApiKey.id == key_id, ApiKey.user_id == user_id)
        )
        result = await session.execute(stmt)
        key = result.scalar_one_or_none()
        return _row_to_dict(key) if key else None


async def update_api_key(key_id: int, user_id: int, updates: Dict[str, Any]) -> bool:
    """Update an API key's settings. Returns True if updated."""
    allowed_fields = {"key_name", "is_active", "budget_limit", "budget_period", "call_limit"}
    filtered = {k: v for k, v in updates.items() if k in allowed_fields}
    if not filtered:
        return False

    async with AsyncSessionLocal() as session:
        stmt = (
            update(ApiKey)
            .where(and_(ApiKey.id == key_id, ApiKey.user_id == user_id))
            .values(**filtered)
        )
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount > 0


async def delete_api_key(key_id: int, user_id: int) -> bool:
    """Delete an API key. Returns True if deleted."""
    async with AsyncSessionLocal() as session:
        stmt = delete(ApiKey).where(
            and_(ApiKey.id == key_id, ApiKey.user_id == user_id)
        )
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount > 0


async def record_api_key_usage(key_id: int, user_id: int,
                               cost: float = 0, endpoint: str = "") -> Dict[str, Any]:
    """
    Record usage against an API key, increment counters, check budget.
    Returns dict with keys: allowed, reason, budget_remaining, calls_remaining.
    """
    async with AsyncSessionLocal() as session:
        # Fetch key
        stmt = select(ApiKey).where(
            and_(ApiKey.id == key_id, ApiKey.user_id == user_id)
        )
        result = await session.execute(stmt)
        key = result.scalar_one_or_none()
        if not key:
            return {"allowed": False, "reason": "API key not found"}

        if not key.is_active:
            return {"allowed": False, "reason": "API key is disabled"}

        # Per-key budget check
        if key.budget_limit and key.budget_limit > 0 and (key.budget_used + cost) > key.budget_limit:
            return {
                "allowed": False,
                "reason": f"API key '{key.key_name}' budget exceeded (${key.budget_used:.2f} / ${key.budget_limit:.2f})",
                "budget_remaining": max(0, key.budget_limit - key.budget_used),
                "calls_remaining": max(0, key.call_limit - key.call_count) if key.call_limit and key.call_limit > 0 else -1,
            }

        # Per-key call limit check
        if key.call_limit and key.call_limit > 0 and key.call_count >= key.call_limit:
            return {
                "allowed": False,
                "reason": f"API key '{key.key_name}' call limit reached ({key.call_count} / {key.call_limit})",
                "budget_remaining": max(0, key.budget_limit - key.budget_used) if key.budget_limit and key.budget_limit > 0 else -1,
                "calls_remaining": 0,
            }

        # Overall user budget check
        user = await session.get(User, user_id)
        if user and user.overall_budget_limit and user.overall_budget_limit > 0:
            if (user.overall_budget_used + cost) > user.overall_budget_limit:
                return {
                    "allowed": False,
                    "reason": f"Overall budget exceeded (${user.overall_budget_used:.2f} / ${user.overall_budget_limit:.2f})",
                    "budget_remaining": max(0, user.overall_budget_limit - user.overall_budget_used),
                    "calls_remaining": max(0, key.call_limit - key.call_count) if key.call_limit and key.call_limit > 0 else -1,
                }

        # All checks passed — record usage
        now = datetime.now(timezone.utc)
        key.budget_used = (key.budget_used or 0) + cost
        key.call_count = (key.call_count or 0) + 1
        key.last_used_at = now

        if user:
            user.overall_budget_used = (user.overall_budget_used or 0) + cost

        # Budget log
        log = BudgetLog(
            user_id=user_id,
            api_key_id=key_id,
            amount=cost,
            description=f"API call to {endpoint or 'unknown'}",
            endpoint=endpoint,
        )
        session.add(log)
        await session.commit()

        new_budget_used = key.budget_used
        new_call_count = key.call_count
        return {
            "allowed": True,
            "reason": "OK",
            "budget_remaining": max(0, key.budget_limit - new_budget_used) if key.budget_limit and key.budget_limit > 0 else -1,
            "calls_remaining": max(0, key.call_limit - new_call_count) if key.call_limit and key.call_limit > 0 else -1,
        }


# ═════════════════════════════════════════════════════════════════════════════
# OVERALL BUDGET OPERATIONS
# ═════════════════════════════════════════════════════════════════════════════

async def set_overall_budget(user_id: int, budget_limit: float,
                             alert_threshold: float = 80,
                             period: str = "monthly") -> bool:
    """Set the user's overall budget limit across all API keys."""
    async with AsyncSessionLocal() as session:
        stmt = (
            update(User)
            .where(User.id == user_id)
            .values(
                overall_budget_limit=budget_limit,
                budget_alert_threshold=alert_threshold,
                budget_period=period,
                updated_at=datetime.now(timezone.utc),
            )
        )
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount > 0


async def reset_budget(user_id: int, key_id: Optional[int] = None) -> bool:
    """Reset budget usage. If key_id provided, reset just that key; otherwise reset all."""
    async with AsyncSessionLocal() as session:
        if key_id:
            stmt = (
                update(ApiKey)
                .where(and_(ApiKey.id == key_id, ApiKey.user_id == user_id))
                .values(budget_used=0, call_count=0)
            )
            await session.execute(stmt)
        else:
            stmt = (
                update(ApiKey)
                .where(ApiKey.user_id == user_id)
                .values(budget_used=0, call_count=0)
            )
            await session.execute(stmt)
            stmt2 = (
                update(User)
                .where(User.id == user_id)
                .values(overall_budget_used=0)
            )
            await session.execute(stmt2)
        await session.commit()
        return True


async def get_budget_summary(user_id: int) -> Dict[str, Any]:
    """Get complete budget summary for a user."""
    async with AsyncSessionLocal() as session:
        # User overall budget
        user = await session.get(User, user_id)
        if not user:
            return {"status": "error", "message": "User not found"}

        total_limit = user.overall_budget_limit or 0
        total_used = user.overall_budget_used or 0
        alert_pct = user.budget_alert_threshold or 80

        # Per-key budgets
        stmt = (
            select(ApiKey)
            .where(ApiKey.user_id == user_id)
            .order_by(desc(ApiKey.created_at))
        )
        result = await session.execute(stmt)
        key_objs = result.scalars().all()
        keys = [_row_to_dict(k) for k in key_objs]

        # Recent budget logs (with join info)
        log_stmt = (
            select(BudgetLog, ApiKey.key_name, ApiKey.api_provider)
            .outerjoin(ApiKey, BudgetLog.api_key_id == ApiKey.id)
            .where(BudgetLog.user_id == user_id)
            .order_by(desc(BudgetLog.created_at))
            .limit(50)
        )
        log_result = await session.execute(log_stmt)
        logs = []
        for row in log_result:
            bl = row[0]
            d = _row_to_dict(bl)
            d["key_name"] = row[1]
            d["api_provider"] = row[2]
            logs.append(d)

        # Calculate totals
        keys_total_limit = sum(k.get("budget_limit") or 0 for k in keys)
        keys_total_used = sum(k.get("budget_used") or 0 for k in keys)
        total_calls = sum(k.get("call_count") or 0 for k in keys)

        return {
            "status": "success",
            "overall": {
                "budget_limit": total_limit,
                "budget_used": total_used,
                "budget_remaining": max(0, total_limit - total_used) if total_limit > 0 else -1,
                "usage_percentage": round((total_used / total_limit * 100), 1) if total_limit > 0 else 0,
                "alert_threshold": alert_pct,
                "is_over_budget": total_used > total_limit if total_limit > 0 else False,
                "is_near_limit": (total_used / total_limit * 100) >= alert_pct if total_limit > 0 else False,
                "period": user.budget_period,
            },
            "keys": [{
                **k,
                "budget_remaining": max(0, (k.get("budget_limit") or 0) - (k.get("budget_used") or 0)) if (k.get("budget_limit") or 0) > 0 else -1,
                "usage_percentage": round(((k.get("budget_used") or 0) / (k.get("budget_limit") or 1)) * 100, 1) if (k.get("budget_limit") or 0) > 0 else 0,
                "calls_remaining": max(0, (k.get("call_limit") or 0) - (k.get("call_count") or 0)) if (k.get("call_limit") or 0) > 0 else -1,
            } for k in keys],
            "totals": {
                "keys_count": len(keys),
                "active_keys": sum(1 for k in keys if k.get("is_active")),
                "keys_total_limit": keys_total_limit,
                "keys_total_used": keys_total_used,
                "total_calls": total_calls,
            },
            "recent_logs": logs,
        }


# ═════════════════════════════════════════════════════════════════════════════
# API RESPONSE / CHANGE DETECTION
# ═════════════════════════════════════════════════════════════════════════════

async def save_api_response(api_name: str, response_hash: str, schema_json: str,
                            response_keys: str, field_count: int,
                            status_code: int) -> int:
    """Save an API response snapshot for change detection."""
    async with AsyncSessionLocal() as session:
        obj = ApiResponse(
            api_name=api_name,
            response_hash=response_hash,
            schema_json=schema_json,
            response_keys=response_keys,
            field_count=field_count,
            status_code=status_code,
        )
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj.id


async def get_last_api_response(api_name: str) -> Optional[Dict[str, Any]]:
    """Get the most recent response snapshot for an API."""
    async with AsyncSessionLocal() as session:
        stmt = (
            select(ApiResponse)
            .where(ApiResponse.api_name == api_name)
            .order_by(desc(ApiResponse.created_at))
            .limit(1)
        )
        result = await session.execute(stmt)
        obj = result.scalar_one_or_none()
        return _row_to_dict(obj) if obj else None


async def get_api_response_history(api_name: str,
                                   limit: int = 20) -> List[Dict[str, Any]]:
    """Get response history for an API."""
    async with AsyncSessionLocal() as session:
        stmt = (
            select(ApiResponse)
            .where(ApiResponse.api_name == api_name)
            .order_by(desc(ApiResponse.created_at))
            .limit(limit)
        )
        result = await session.execute(stmt)
        return [_row_to_dict(r) for r in result.scalars().all()]


async def save_change_alert(api_name: str, severity: str, summary: str,
                            diff_json: str, old_hash: str,
                            new_hash: str) -> int:
    """Save a change detection alert."""
    async with AsyncSessionLocal() as session:
        obj = ChangeAlert(
            api_name=api_name,
            severity=severity,
            summary=summary,
            diff_json=diff_json,
            old_hash=old_hash,
            new_hash=new_hash,
        )
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj.id


async def get_change_alerts_db(limit: int = 50, api_name: Optional[str] = None,
                               unacked_only: bool = False) -> List[Dict[str, Any]]:
    """Get change alerts from DB."""
    async with AsyncSessionLocal() as session:
        stmt = select(ChangeAlert)
        conditions = []
        if api_name:
            conditions.append(ChangeAlert.api_name == api_name)
        if unacked_only:
            conditions.append(ChangeAlert.acknowledged == False)  # noqa: E712
        if conditions:
            stmt = stmt.where(and_(*conditions))
        stmt = stmt.order_by(desc(ChangeAlert.detected_at)).limit(limit)
        result = await session.execute(stmt)
        return [_row_to_dict(r) for r in result.scalars().all()]


async def ack_change_alert_db(alert_id: int) -> bool:
    """Acknowledge a change alert."""
    async with AsyncSessionLocal() as session:
        stmt = (
            update(ChangeAlert)
            .where(ChangeAlert.id == alert_id)
            .values(acknowledged=True)
        )
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount > 0


# ═════════════════════════════════════════════════════════════════════════════
# SECURITY SCANS
# ═════════════════════════════════════════════════════════════════════════════

async def save_security_scan(user_id: Optional[int], scan_type: str, target: str,
                             language: str, score: int, grade: str,
                             total_issues: int, results_json: str) -> int:
    """Save a security scan result."""
    # results_json may arrive as a string; store as dict/JSON if possible
    parsed = results_json
    if isinstance(results_json, str):
        try:
            parsed = json.loads(results_json)
        except Exception:
            parsed = results_json
    async with AsyncSessionLocal() as session:
        obj = SecurityScan(
            user_id=user_id,
            scan_type=scan_type,
            target=target,
            language=language,
            score=score,
            grade=grade,
            total_issues=total_issues,
            results_json=parsed,
        )
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj.id


async def get_security_scans(user_id: Optional[int] = None,
                             limit: int = 20) -> List[Dict[str, Any]]:
    """Get past security scans."""
    async with AsyncSessionLocal() as session:
        stmt = select(SecurityScan)
        if user_id is not None:
            stmt = stmt.where(SecurityScan.user_id == user_id)
        stmt = stmt.order_by(desc(SecurityScan.created_at)).limit(limit)
        result = await session.execute(stmt)
        return [_row_to_dict(r) for r in result.scalars().all()]


# ═════════════════════════════════════════════════════════════════════════════
# INCIDENTS
# ═════════════════════════════════════════════════════════════════════════════

async def save_incident(incident_id: str, title: str, description: str,
                        severity: str, affected_apis: List[str],
                        detected_by: str) -> str:
    """Create an incident in DB."""
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as session:
        obj = Incident(
            id=incident_id,
            title=title,
            description=description,
            severity=severity,
            affected_apis=affected_apis,
            detected_by=detected_by,
            created_at=now,
            updated_at=now,
        )
        session.add(obj)
        await session.commit()
    return incident_id


async def save_incident_event(event_id: str, incident_id: str,
                              event_type: str, message: str,
                              author: str) -> str:
    """Add an event to incident timeline."""
    async with AsyncSessionLocal() as session:
        obj = IncidentEvent(
            id=event_id,
            incident_id=incident_id,
            event_type=event_type,
            message=message,
            author=author,
        )
        session.add(obj)
        await session.commit()
    return event_id


async def update_incident_status(incident_id: str, status: str,
                                 resolution: Optional[str] = None,
                                 root_cause: Optional[str] = None) -> bool:
    """Update incident status."""
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as session:
        obj = await session.get(Incident, incident_id)
        if not obj:
            return False
        obj.status = status
        obj.updated_at = now
        if status == "resolved":
            obj.resolved_at = now
        if resolution:
            obj.resolution = resolution
        if root_cause:
            obj.root_cause = root_cause
        await session.commit()
        return True


async def get_incidents_db(limit: int = 50, status: Optional[str] = None,
                           severity: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get incidents from DB with optional filters."""
    async with AsyncSessionLocal() as session:
        stmt = select(Incident)
        conditions = []
        if status:
            conditions.append(Incident.status == status)
        if severity:
            conditions.append(Incident.severity == severity)
        if conditions:
            stmt = stmt.where(and_(*conditions))
        stmt = stmt.order_by(desc(Incident.created_at)).limit(limit)
        result = await session.execute(stmt)
        rows = []
        for inc in result.scalars().all():
            d = _row_to_dict(inc)
            # affected_apis is JSON in ORM — ensure it's a list
            if isinstance(d.get("affected_apis"), str):
                try:
                    d["affected_apis"] = json.loads(d["affected_apis"])
                except Exception:
                    d["affected_apis"] = []
            rows.append(d)
        return rows


async def get_incident_db(incident_id: str) -> Optional[Dict[str, Any]]:
    """Get single incident with timeline."""
    async with AsyncSessionLocal() as session:
        inc = await session.get(Incident, incident_id)
        if not inc:
            return None
        d = _row_to_dict(inc)
        if isinstance(d.get("affected_apis"), str):
            try:
                d["affected_apis"] = json.loads(d["affected_apis"])
            except Exception:
                d["affected_apis"] = []
        # Timeline events
        stmt = (
            select(IncidentEvent)
            .where(IncidentEvent.incident_id == incident_id)
            .order_by(asc(IncidentEvent.created_at))
        )
        result = await session.execute(stmt)
        d["timeline"] = [_row_to_dict(e) for e in result.scalars().all()]
        return d


async def get_incident_stats_db() -> Dict[str, Any]:
    """Get incident statistics from DB."""
    async with AsyncSessionLocal() as session:
        total_r = await session.execute(select(func.count(Incident.id)))
        total = total_r.scalar() or 0

        active_r = await session.execute(
            select(func.count(Incident.id)).where(Incident.status != "resolved")
        )
        active = active_r.scalar() or 0

        resolved_r = await session.execute(
            select(func.count(Incident.id)).where(Incident.status == "resolved")
        )
        resolved = resolved_r.scalar() or 0

        # last 24h — use func.now() which works on both PG and SQLite
        last_24h_r = await session.execute(
            select(func.count(Incident.id)).where(
                Incident.created_at >= func.now() - text("interval '1 day'")
            )
        )
        try:
            last_24h = last_24h_r.scalar() or 0
        except Exception:
            last_24h = 0

        return {
            "total": total,
            "active": active,
            "resolved": resolved,
            "last_24h": last_24h,
            "mttr_minutes": 0,
            "by_severity": {},
        }


# ═════════════════════════════════════════════════════════════════════════════
# ALERT CONFIGS & KILL-SWITCH
# ═════════════════════════════════════════════════════════════════════════════

async def save_alert_config(config_id: str, user_id: Optional[int], name: str,
                            channel: str, target: str, conditions: Dict,
                            priority: str) -> str:
    """Save an alert configuration."""
    async with AsyncSessionLocal() as session:
        obj = AlertConfig(
            id=config_id,
            user_id=user_id,
            name=name,
            channel=channel,
            target=target,
            conditions_json=conditions,
            priority=priority,
        )
        session.add(obj)
        await session.commit()
    return config_id


async def get_alert_configs_db(user_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Get alert configs."""
    async with AsyncSessionLocal() as session:
        stmt = select(AlertConfig)
        if user_id is not None:
            stmt = stmt.where(AlertConfig.user_id == user_id)
        stmt = stmt.order_by(desc(AlertConfig.created_at))
        result = await session.execute(stmt)
        rows = []
        for ac in result.scalars().all():
            d = _row_to_dict(ac)
            # conditions_json is JSON column — copy as conditions key
            cj = d.get("conditions_json")
            if isinstance(cj, str):
                try:
                    d["conditions"] = json.loads(cj)
                except Exception:
                    d["conditions"] = {}
            elif isinstance(cj, dict):
                d["conditions"] = cj
            else:
                d["conditions"] = {}
            rows.append(d)
        return rows


async def delete_alert_config_db(config_id: str) -> bool:
    """Delete an alert config."""
    async with AsyncSessionLocal() as session:
        stmt = delete(AlertConfig).where(AlertConfig.id == config_id)
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount > 0


async def save_alert_event(config_id: Optional[str], channel: str,
                           event_type: str, message: str,
                           delivered: bool) -> int:
    """Log an alert event."""
    async with AsyncSessionLocal() as session:
        obj = AlertHistory(
            config_id=config_id,
            channel=channel,
            event_type=event_type,
            message=message,
            delivered=delivered,
        )
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj.id


async def get_alert_history_db(limit: int = 50) -> List[Dict[str, Any]]:
    """Get alert history."""
    async with AsyncSessionLocal() as session:
        stmt = (
            select(AlertHistory)
            .order_by(desc(AlertHistory.created_at))
            .limit(limit)
        )
        result = await session.execute(stmt)
        return [_row_to_dict(r) for r in result.scalars().all()]


async def save_kill_switch(api_name: str, reason: str,
                           activated_by: str) -> bool:
    """Activate a kill-switch for an API (upsert)."""
    async with AsyncSessionLocal() as session:
        try:
            # Try to find existing
            stmt = select(KillSwitch).where(KillSwitch.api_name == api_name)
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()
            if existing:
                existing.reason = reason
                existing.activated_by = activated_by
                existing.activated_at = datetime.now(timezone.utc)
                existing.deactivated_at = None
            else:
                obj = KillSwitch(
                    api_name=api_name,
                    reason=reason,
                    activated_by=activated_by,
                )
                session.add(obj)
            await session.commit()
            return True
        except Exception as e:
            logger.error(f"Kill switch save error: {e}")
            await session.rollback()
            return False


async def deactivate_kill_switch_db(api_name: str) -> bool:
    """Deactivate a kill-switch."""
    async with AsyncSessionLocal() as session:
        stmt = (
            update(KillSwitch)
            .where(and_(KillSwitch.api_name == api_name, KillSwitch.deactivated_at.is_(None)))
            .values(deactivated_at=datetime.now(timezone.utc))
        )
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount > 0


async def get_kill_switches_db() -> List[Dict[str, Any]]:
    """Get all active kill-switches."""
    async with AsyncSessionLocal() as session:
        stmt = (
            select(KillSwitch)
            .where(KillSwitch.deactivated_at.is_(None))
            .order_by(desc(KillSwitch.activated_at))
        )
        result = await session.execute(stmt)
        return [_row_to_dict(r) for r in result.scalars().all()]


async def is_api_killed(api_name: str) -> bool:
    """Check if an API has an active kill-switch."""
    async with AsyncSessionLocal() as session:
        stmt = select(func.count(KillSwitch.id)).where(
            and_(KillSwitch.api_name == api_name, KillSwitch.deactivated_at.is_(None))
        )
        result = await session.execute(stmt)
        cnt = result.scalar() or 0
        return cnt > 0


# ═════════════════════════════════════════════════════════════════════════════
# TEAMS
# ═════════════════════════════════════════════════════════════════════════════

async def save_team(team_id: str, name: str, owner_id: int) -> str:
    """Create a team."""
    async with AsyncSessionLocal() as session:
        team = Team(id=team_id, name=name, owner_id=owner_id)
        session.add(team)
        # Add owner as member
        member = TeamMember(
            team_id=team_id,
            user_id=owner_id,
            role="owner",
            accepted=True,
        )
        session.add(member)
        await session.commit()
    return team_id


async def get_team_db(team_id: str) -> Optional[Dict[str, Any]]:
    """Get team with members."""
    async with AsyncSessionLocal() as session:
        team = await session.get(Team, team_id)
        if not team:
            return None
        d = _row_to_dict(team)
        stmt = (
            select(TeamMember, User.email, User.username)
            .join(User, TeamMember.user_id == User.id)
            .where(TeamMember.team_id == team_id)
        )
        result = await session.execute(stmt)
        members = []
        for row in result:
            m = _row_to_dict(row[0])
            m["email"] = row[1]
            m["username"] = row[2]
            members.append(m)
        d["members"] = members
        return d


async def get_user_teams(user_id: int) -> List[Dict[str, Any]]:
    """Get all teams a user belongs to."""
    async with AsyncSessionLocal() as session:
        stmt = (
            select(Team, TeamMember.role)
            .join(TeamMember, Team.id == TeamMember.team_id)
            .where(and_(TeamMember.user_id == user_id, TeamMember.accepted == True))  # noqa: E712
        )
        result = await session.execute(stmt)
        teams = []
        for row in result:
            d = _row_to_dict(row[0])
            d["role"] = row[1]
            teams.append(d)
        return teams


async def add_team_member(team_id: str, user_id: int, role: str,
                          invited_by: int) -> bool:
    """Add a member to a team."""
    async with AsyncSessionLocal() as session:
        try:
            member = TeamMember(
                team_id=team_id,
                user_id=user_id,
                role=role,
                invited_by=invited_by,
            )
            session.add(member)
            await session.commit()
            return True
        except IntegrityError:
            await session.rollback()
            return False


async def update_team_member_role(team_id: str, user_id: int,
                                  role: str) -> bool:
    """Update a team member's role."""
    async with AsyncSessionLocal() as session:
        stmt = (
            update(TeamMember)
            .where(and_(TeamMember.team_id == team_id, TeamMember.user_id == user_id))
            .values(role=role)
        )
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount > 0


async def remove_team_member(team_id: str, user_id: int) -> bool:
    """Remove a member from a team (cannot remove owner)."""
    async with AsyncSessionLocal() as session:
        stmt = delete(TeamMember).where(
            and_(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
                TeamMember.role != "owner",
            )
        )
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount > 0


# ═════════════════════════════════════════════════════════════════════════════
# MARKETPLACE
# ═════════════════════════════════════════════════════════════════════════════

async def save_marketplace_template(template_id: str, name: str, description: str,
                                    author: str, author_id: Optional[int],
                                    category: str, tags: List[str], language: str,
                                    apis_used: List[str], code: str,
                                    version: str) -> str:
    """Publish a template to the marketplace."""
    async with AsyncSessionLocal() as session:
        obj = MarketplaceTemplate(
            id=template_id,
            name=name,
            description=description,
            author=author,
            author_id=author_id,
            category=category,
            tags=tags,
            language=language,
            apis_used=apis_used,
            code=code,
            version=version,
        )
        session.add(obj)
        await session.commit()
    return template_id


async def get_marketplace_templates_db(category: Optional[str] = None,
                                       language: Optional[str] = None,
                                       search: Optional[str] = None,
                                       limit: int = 50) -> List[Dict[str, Any]]:
    """Get marketplace templates with optional filters."""
    async with AsyncSessionLocal() as session:
        stmt = select(MarketplaceTemplate)
        conditions = []
        if category:
            conditions.append(MarketplaceTemplate.category == category)
        if language:
            conditions.append(MarketplaceTemplate.language == language)
        if search:
            like_pat = f"%{search}%"
            conditions.append(
                or_(
                    MarketplaceTemplate.name.ilike(like_pat),
                    MarketplaceTemplate.description.ilike(like_pat),
                )
            )
        if conditions:
            stmt = stmt.where(and_(*conditions))
        stmt = stmt.order_by(desc(MarketplaceTemplate.downloads)).limit(limit)
        result = await session.execute(stmt)
        rows = []
        for t in result.scalars().all():
            d = _row_to_dict(t)
            # tags / apis_used — ensure list
            for field in ("tags", "apis_used"):
                val = d.get(field)
                if isinstance(val, str):
                    try:
                        d[field] = json.loads(val)
                    except Exception:
                        d[field] = []
            rc = d.get("rating_count") or 0
            rs = d.get("rating_sum") or 0
            d["rating"] = round(rs / rc, 1) if rc > 0 else 0
            d["review_count"] = rc
            rows.append(d)
        return rows


async def get_marketplace_template_db(template_id: str) -> Optional[Dict[str, Any]]:
    """Get a single marketplace template."""
    async with AsyncSessionLocal() as session:
        obj = await session.get(MarketplaceTemplate, template_id)
        if not obj:
            return None
        d = _row_to_dict(obj)
        for field in ("tags", "apis_used"):
            val = d.get(field)
            if isinstance(val, str):
                try:
                    d[field] = json.loads(val)
                except Exception:
                    d[field] = []
        rc = d.get("rating_count") or 0
        rs = d.get("rating_sum") or 0
        d["rating"] = round(rs / rc, 1) if rc > 0 else 0
        d["review_count"] = rc
        return d


async def increment_template_downloads(template_id: str) -> bool:
    """Increment download counter."""
    async with AsyncSessionLocal() as session:
        stmt = (
            update(MarketplaceTemplate)
            .where(MarketplaceTemplate.id == template_id)
            .values(downloads=MarketplaceTemplate.downloads + 1)
        )
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount > 0


async def add_template_review(template_id: str, user_id: Optional[int],
                              rating: int, comment: str) -> int:
    """Add a review to a template."""
    async with AsyncSessionLocal() as session:
        review = MarketplaceReview(
            template_id=template_id,
            user_id=user_id,
            rating=rating,
            comment=comment,
        )
        session.add(review)
        # Update aggregate rating on template
        stmt = (
            update(MarketplaceTemplate)
            .where(MarketplaceTemplate.id == template_id)
            .values(
                rating_sum=MarketplaceTemplate.rating_sum + rating,
                rating_count=MarketplaceTemplate.rating_count + 1,
            )
        )
        await session.execute(stmt)
        await session.commit()
        await session.refresh(review)
        return review.id


# ═════════════════════════════════════════════════════════════════════════════
# CI/CD RUNS
# ═════════════════════════════════════════════════════════════════════════════

async def save_cicd_run(run_id: str, pipeline_id: str, repo: str, branch: str,
                        gate_result: str, security_score: int,
                        compatibility_score: int, budget_ok: bool,
                        details: Dict, triggered_by: str) -> str:
    """Save a CI/CD run result."""
    async with AsyncSessionLocal() as session:
        obj = CicdRun(
            id=run_id,
            pipeline_id=pipeline_id,
            repo=repo,
            branch=branch,
            gate_result=gate_result,
            security_score=security_score,
            compatibility_score=compatibility_score,
            budget_ok=budget_ok,
            details_json=details,
            triggered_by=triggered_by,
        )
        session.add(obj)
        await session.commit()
    return run_id


async def get_cicd_runs_db(limit: int = 20,
                           pipeline_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get CI/CD run history."""
    async with AsyncSessionLocal() as session:
        stmt = select(CicdRun)
        if pipeline_id:
            stmt = stmt.where(CicdRun.pipeline_id == pipeline_id)
        stmt = stmt.order_by(desc(CicdRun.created_at)).limit(limit)
        result = await session.execute(stmt)
        rows = []
        for r in result.scalars().all():
            d = _row_to_dict(r)
            dj = d.get("details_json")
            if isinstance(dj, str):
                try:
                    d["details"] = json.loads(dj)
                except Exception:
                    d["details"] = {}
            elif isinstance(dj, dict):
                d["details"] = dj
            else:
                d["details"] = {}
            rows.append(d)
        return rows


# ═════════════════════════════════════════════════════════════════════════════
# BILLING
# ═════════════════════════════════════════════════════════════════════════════

async def save_billing_event(user_id: int, event_type: str, amount_cents: int,
                             currency: str, stripe_event_id: str,
                             description: str) -> int:
    """Log a billing event."""
    async with AsyncSessionLocal() as session:
        obj = BillingEvent(
            user_id=user_id,
            event_type=event_type,
            amount_cents=amount_cents,
            currency=currency,
            stripe_event_id=stripe_event_id,
            description=description,
        )
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj.id


async def get_billing_history(user_id: int,
                              limit: int = 50) -> List[Dict[str, Any]]:
    """Get billing history for a user."""
    async with AsyncSessionLocal() as session:
        stmt = (
            select(BillingEvent)
            .where(BillingEvent.user_id == user_id)
            .order_by(desc(BillingEvent.created_at))
            .limit(limit)
        )
        result = await session.execute(stmt)
        return [_row_to_dict(r) for r in result.scalars().all()]


async def update_user_plan(user_id: int, plan: str,
                           stripe_customer_id: Optional[str] = None,
                           stripe_subscription_id: Optional[str] = None) -> bool:
    """Update user's plan (after Stripe subscription)."""
    async with AsyncSessionLocal() as session:
        vals: dict = {
            "plan": plan,
            "updated_at": datetime.now(timezone.utc),
        }
        if stripe_customer_id:
            vals["stripe_customer_id"] = stripe_customer_id
        if stripe_subscription_id:
            vals["stripe_subscription_id"] = stripe_subscription_id
        stmt = update(User).where(User.id == user_id).values(**vals)
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount > 0


# ═════════════════════════════════════════════════════════════════════════════
# CUSTOM APIS (OpenAPI Import)
# ═════════════════════════════════════════════════════════════════════════════

async def save_custom_api(user_id: int, name: str, protocol: str, base_url: str,
                          spec_json: str, metadata_json: str) -> int:
    """Save a custom API imported via OpenAPI/Swagger."""
    # Parse JSON strings into dicts for the JSON column
    spec = spec_json
    if isinstance(spec_json, str):
        try:
            spec = json.loads(spec_json)
        except Exception:
            spec = spec_json
    meta = metadata_json
    if isinstance(metadata_json, str):
        try:
            meta = json.loads(metadata_json)
        except Exception:
            meta = metadata_json

    async with AsyncSessionLocal() as session:
        obj = CustomApi(
            user_id=user_id,
            name=name,
            protocol=protocol,
            base_url=base_url,
            spec_json=spec,
            metadata_json=meta,
        )
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj.id


async def get_custom_apis(user_id: int) -> List[Dict[str, Any]]:
    """Get user's custom APIs."""
    async with AsyncSessionLocal() as session:
        stmt = (
            select(CustomApi)
            .where(and_(CustomApi.user_id == user_id, CustomApi.is_active == True))  # noqa: E712
            .order_by(desc(CustomApi.created_at))
        )
        result = await session.execute(stmt)
        rows = []
        for r in result.scalars().all():
            d = _row_to_dict(r)
            # spec_json / metadata_json — ensure parsed
            for field in ("spec_json", "metadata_json"):
                val = d.get(field)
                if isinstance(val, str):
                    try:
                        d[field] = json.loads(val)
                    except Exception:
                        pass
            rows.append(d)
        return rows


async def delete_custom_api(api_id: int, user_id: int) -> bool:
    """Soft-delete a custom API."""
    async with AsyncSessionLocal() as session:
        stmt = (
            update(CustomApi)
            .where(and_(CustomApi.id == api_id, CustomApi.user_id == user_id))
            .values(is_active=False)
        )
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount > 0


# ═════════════════════════════════════════════════════════════════════════════
# API CALL LOGS (Cost Intelligence — Pillar 2)
# ═════════════════════════════════════════════════════════════════════════════

async def save_api_call_log(
    user_id: int,
    provider: str,
    model: str,
    endpoint: str,
    tokens_input: int,
    tokens_output: int,
    cost_usd: float,
    latency_ms: float = 0,
    status_code: int = 200,
    cached: bool = False,
    api_key_id: Optional[int] = None,
) -> int:
    """Persist a single API call log to the database."""
    async with AsyncSessionLocal() as session:
        obj = ApiCallLog(
            user_id=user_id,
            api_key_id=api_key_id,
            provider=provider,
            model=model,
            endpoint=endpoint,
            tokens_input=tokens_input,
            tokens_output=tokens_output,
            cost_usd=cost_usd,
            latency_ms=latency_ms,
            status_code=status_code,
            cached=cached,
        )
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj.id


async def get_api_call_logs(
    user_id: int,
    days: int = 30,
    limit: int = 10000,
) -> List[Dict[str, Any]]:
    """Retrieve API call logs for a user within the last N days."""
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    async with AsyncSessionLocal() as session:
        stmt = (
            select(ApiCallLog)
            .where(and_(
                ApiCallLog.user_id == user_id,
                ApiCallLog.created_at >= cutoff,
            ))
            .order_by(desc(ApiCallLog.created_at))
            .limit(limit)
        )
        result = await session.execute(stmt)
        return [_row_to_dict(r) for r in result.scalars().all()]


async def get_api_call_daily_costs(
    user_id: int,
    days: int = 30,
) -> Dict[str, float]:
    """Get daily aggregated costs for a user."""
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    async with AsyncSessionLocal() as session:
        stmt = (
            select(
                func.date(ApiCallLog.created_at).label("day"),
                func.sum(ApiCallLog.cost_usd).label("total"),
            )
            .where(and_(
                ApiCallLog.user_id == user_id,
                ApiCallLog.created_at >= cutoff,
            ))
            .group_by(func.date(ApiCallLog.created_at))
            .order_by(func.date(ApiCallLog.created_at))
        )
        result = await session.execute(stmt)
        return {str(row.day): round(float(row.total or 0), 4) for row in result}


# ═════════════════════════════════════════════════════════════════════════════
# COST BUDGETS
# ═════════════════════════════════════════════════════════════════════════════

async def save_cost_budget(
    user_id: int,
    name: str,
    provider: str,
    monthly_limit_usd: float,
    alert_threshold_pct: float = 80,
    auto_kill: bool = False,
) -> Dict[str, Any]:
    """Create a cost budget for a user."""
    async with AsyncSessionLocal() as session:
        obj = CostBudget(
            user_id=user_id,
            name=name,
            provider=provider,
            monthly_limit_usd=monthly_limit_usd,
            alert_threshold_pct=alert_threshold_pct,
            auto_kill=auto_kill,
        )
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return _row_to_dict(obj)


async def get_cost_budgets(user_id: int) -> List[Dict[str, Any]]:
    """List all cost budgets for a user with current spend calculated from DB."""
    from datetime import timedelta as td
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as session:
        stmt = (
            select(CostBudget)
            .where(CostBudget.user_id == user_id)
            .order_by(desc(CostBudget.created_at))
        )
        result = await session.execute(stmt)
        budgets = []
        for b in result.scalars().all():
            d = _row_to_dict(b)
            # Calculate current spend from api_call_logs in the budget's period
            period_start = b.period_start or (now - td(days=30))
            conditions = [
                ApiCallLog.user_id == user_id,
                ApiCallLog.created_at >= period_start,
            ]
            if b.provider:
                conditions.append(ApiCallLog.provider == b.provider)
            spend_stmt = (
                select(func.coalesce(func.sum(ApiCallLog.cost_usd), 0))
                .where(and_(*conditions))
            )
            spend_result = await session.execute(spend_stmt)
            current_spend = float(spend_result.scalar() or 0)
            d["current_spend_usd"] = round(current_spend, 4)
            d["usage_pct"] = round(
                (current_spend / b.monthly_limit_usd * 100)
                if b.monthly_limit_usd > 0 else 0,
                1,
            )
            d["status"] = (
                "exceeded" if d["usage_pct"] >= 100 else
                "warning" if d["usage_pct"] >= (b.alert_threshold_pct or 80) else
                "active"
            )
            budgets.append(d)
        return budgets


async def delete_cost_budget(budget_id: int, user_id: int) -> bool:
    """Delete a cost budget."""
    async with AsyncSessionLocal() as session:
        stmt = (
            delete(CostBudget)
            .where(and_(CostBudget.id == budget_id, CostBudget.user_id == user_id))
        )
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount > 0


# ═════════════════════════════════════════════════════════════════════════════
# AI SECURITY SCAN HISTORY  (score-history from real data)
# ═════════════════════════════════════════════════════════════════════════════

async def save_ai_security_scan(
    user_id: int,
    scan_type: str,
    target: str,
    score: int,
    grade: str,
    threats_found: int,
    critical_count: int = 0,
    high_count: int = 0,
    medium_count: int = 0,
    low_count: int = 0,
    results_json: Optional[dict] = None,
    fix_suggestions_json: Optional[list] = None,
    owasp_results_json: Optional[dict] = None,
) -> int:
    """Persist an AI security scan result."""
    async with AsyncSessionLocal() as session:
        obj = AiSecurityScan(
            user_id=user_id,
            scan_type=scan_type,
            target=target[:500] if target else "",
            score=score,
            grade=grade,
            threats_found=threats_found,
            critical_count=critical_count,
            high_count=high_count,
            medium_count=medium_count,
            low_count=low_count,
            results_json=results_json or {},
            fix_suggestions_json=fix_suggestions_json or [],
            owasp_results_json=owasp_results_json or {},
        )
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj.id


async def get_ai_security_score_history(
    user_id: int,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """Get security scan score history for a user from real DB data."""
    async with AsyncSessionLocal() as session:
        stmt = (
            select(AiSecurityScan)
            .where(AiSecurityScan.user_id == user_id)
            .order_by(desc(AiSecurityScan.created_at))
            .limit(limit)
        )
        result = await session.execute(stmt)
        history = []
        for scan in result.scalars().all():
            history.append({
                "scan_id": scan.id,
                "score": scan.score,
                "grade": scan.grade,
                "threats_found": scan.threats_found,
                "scan_type": scan.scan_type,
                "scanned_at": scan.created_at.isoformat() if scan.created_at else None,
            })
        return history


# ═════════════════════════════════════════════════════════════════════════════
# THREAT EVENTS (real DB-backed threat feed)
# ═════════════════════════════════════════════════════════════════════════════

async def save_threat_event(
    threat_type: str,
    severity: str,
    source: str,
    description: str,
    api_endpoint: str = "",
    user_id: Optional[int] = None,
) -> int:
    """Save a threat event to the database."""
    async with AsyncSessionLocal() as session:
        obj = ThreatEvent(
            user_id=user_id,
            threat_type=threat_type,
            severity=severity,
            source=source,
            description=description,
            api_endpoint=api_endpoint,
        )
        session.add(obj)
        await session.commit()
        await session.refresh(obj)
        return obj.id


async def get_threat_events_db(
    limit: int = 50,
    severity: Optional[str] = None,
    unresolved_only: bool = False,
) -> List[Dict[str, Any]]:
    """Get threat events from the database."""
    async with AsyncSessionLocal() as session:
        stmt = select(ThreatEvent)
        conditions = []
        if severity:
            conditions.append(ThreatEvent.severity == severity)
        if unresolved_only:
            conditions.append(ThreatEvent.resolved == False)  # noqa: E712
        if conditions:
            stmt = stmt.where(and_(*conditions))
        stmt = stmt.order_by(desc(ThreatEvent.created_at)).limit(limit)
        result = await session.execute(stmt)
        return [_row_to_dict(r) for r in result.scalars().all()]


async def resolve_threat_event(threat_id: int) -> bool:
    """Mark a threat event as resolved."""
    async with AsyncSessionLocal() as session:
        stmt = (
            update(ThreatEvent)
            .where(ThreatEvent.id == threat_id)
            .values(resolved=True, resolved_at=datetime.now(timezone.utc))
        )
        result = await session.execute(stmt)
        await session.commit()
        return result.rowcount > 0
