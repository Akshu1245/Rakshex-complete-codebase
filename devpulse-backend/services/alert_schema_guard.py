"""Refuse to serve alert endpoints if the DB schema isn't migrated (003 + 004).

Production startup runs create_all(), which creates missing TABLES but never adds
COLUMNS to existing ones. Serving with a half-migrated schema would either 500 or,
worse, run unscoped queries. This guard checks once and caches only success.
"""
import logging
from fastapi import HTTPException
from sqlalchemy import inspect

logger = logging.getLogger(__name__)

REQUIRED = {
    "change_alerts": {"workspace_id", "acknowledged_by", "acknowledged_at", "resolved_by", "resolved_at", "event_id"},
    "change_alert_audit": {"alert_id", "workspace_id", "actor_user_id", "action", "created_at"},
    "upstream_change_events": {"api_name", "severity", "legacy_alert_id"},
    "workspace_api_subscriptions": {"workspace_id", "api_name"},
}
_ok = False


async def missing_alert_schema() -> list:
    from services.db_config import engine

    def _check(sync_conn):
        insp = inspect(sync_conn)
        missing = []
        tables = set(insp.get_table_names())
        for t, cols in REQUIRED.items():
            if t not in tables:
                missing.append(t)
                continue
            have = {c["name"] for c in insp.get_columns(t)}
            missing += [f"{t}.{c}" for c in sorted(cols - have)]
        return missing

    async with engine.connect() as conn:
        return await conn.run_sync(_check)


async def require_alert_schema() -> None:
    global _ok
    if _ok:
        return
    try:
        missing = await missing_alert_schema()
    except Exception as e:  # DB unreachable etc.
        logger.error(f"alert schema check failed: {e}")
        raise HTTPException(status_code=503, detail="Alert service unavailable")
    if missing:
        logger.error(f"Alert endpoints disabled; schema not migrated, missing: {missing}. Run `alembic upgrade head`.")
        raise HTTPException(status_code=503, detail="Alert service unavailable: database migration pending")
    _ok = True


def _reset_for_tests() -> None:
    global _ok
    _ok = False
