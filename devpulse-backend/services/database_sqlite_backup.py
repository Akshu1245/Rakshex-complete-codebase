"""
Database Service - SQLite database layer for DevPulse.

Handles user accounts, API key storage, code history, incidents,
teams, alerts, marketplace, billing, and analytics.
Uses aiosqlite for async database operations.
"""
import os
import json
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

import aiosqlite

logger = logging.getLogger(__name__)

DB_PATH = os.getenv("DEVPULSE_DB_PATH", "devpulse.db")

_db: Optional[aiosqlite.Connection] = None
_db_lock = asyncio.Lock()


async def get_db() -> aiosqlite.Connection:
    """Get the database connection, initializing if needed."""
    global _db
    if _db is None:
        await init_db()
    return _db


async def init_db():
    """Initialize the database and create tables."""
    global _db
    async with _db_lock:
        _db = await aiosqlite.connect(DB_PATH)
        _db.row_factory = aiosqlite.Row

        await _db.executescript("""
            -- ═══ Core Tables ═══
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                plan TEXT DEFAULT 'free',
                stripe_customer_id TEXT,
                stripe_subscription_id TEXT,
                api_calls_today INTEGER DEFAULT 0,
                api_calls_reset_date TEXT,
                overall_budget_limit REAL DEFAULT 0,
                overall_budget_used REAL DEFAULT 0,
                budget_alert_threshold REAL DEFAULT 80,
                budget_period TEXT DEFAULT 'monthly',
                budget_reset_date TEXT,
                kill_switch_active INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                key_name TEXT NOT NULL,
                api_provider TEXT NOT NULL,
                encrypted_key TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                budget_limit REAL DEFAULT 0,
                budget_used REAL DEFAULT 0,
                budget_period TEXT DEFAULT 'monthly',
                budget_reset_date TEXT,
                call_count INTEGER DEFAULT 0,
                call_limit INTEGER DEFAULT 0,
                last_used_at TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS budget_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                api_key_id INTEGER,
                amount REAL NOT NULL,
                description TEXT,
                endpoint TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS code_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                use_case TEXT NOT NULL,
                language TEXT DEFAULT 'python',
                generated_code TEXT,
                apis_used TEXT,
                validation_score INTEGER,
                validation_grade TEXT,
                status TEXT,
                tokens_used INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS usage_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                endpoint TEXT NOT NULL,
                response_time_ms REAL,
                status_code INTEGER,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            );

            -- ═══ API Change Detection ═══
            CREATE TABLE IF NOT EXISTS api_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                api_name TEXT NOT NULL,
                response_hash TEXT NOT NULL,
                schema_json TEXT,
                response_keys TEXT,
                field_count INTEGER DEFAULT 0,
                status_code INTEGER,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS change_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                api_name TEXT NOT NULL,
                severity TEXT DEFAULT 'warning',
                change_type TEXT DEFAULT 'schema_change',
                summary TEXT,
                diff_json TEXT,
                old_hash TEXT,
                new_hash TEXT,
                acknowledged INTEGER DEFAULT 0,
                detected_at TEXT DEFAULT (datetime('now'))
            );

            -- ═══ Security Scanning ═══
            CREATE TABLE IF NOT EXISTS security_scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                scan_type TEXT DEFAULT 'code',
                target TEXT,
                language TEXT,
                score INTEGER DEFAULT 100,
                grade TEXT DEFAULT 'A',
                total_issues INTEGER DEFAULT 0,
                results_json TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            );

            -- ═══ Incidents ═══
            CREATE TABLE IF NOT EXISTS incidents (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                severity TEXT DEFAULT 'medium',
                status TEXT DEFAULT 'detected',
                affected_apis TEXT DEFAULT '[]',
                detected_by TEXT DEFAULT 'manual',
                root_cause TEXT,
                resolution TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now')),
                resolved_at TEXT
            );

            CREATE TABLE IF NOT EXISTS incident_events (
                id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                message TEXT DEFAULT '',
                author TEXT DEFAULT 'system',
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
            );

            -- ═══ Multi-Channel Alerts ═══
            CREATE TABLE IF NOT EXISTS alert_configs (
                id TEXT PRIMARY KEY,
                user_id INTEGER,
                name TEXT NOT NULL,
                channel TEXT DEFAULT 'in_app',
                target TEXT DEFAULT '',
                conditions_json TEXT DEFAULT '{}',
                priority TEXT DEFAULT 'medium',
                enabled INTEGER DEFAULT 1,
                trigger_count INTEGER DEFAULT 0,
                last_triggered_at TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS alert_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                config_id TEXT,
                channel TEXT,
                event_type TEXT,
                message TEXT,
                delivered INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (config_id) REFERENCES alert_configs(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS kill_switches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                api_name TEXT NOT NULL UNIQUE,
                reason TEXT DEFAULT '',
                activated_by TEXT DEFAULT 'system',
                activated_at TEXT DEFAULT (datetime('now')),
                deactivated_at TEXT
            );

            -- ═══ Teams & RBAC ═══
            CREATE TABLE IF NOT EXISTS teams (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                owner_id INTEGER NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS team_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                team_id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                role TEXT DEFAULT 'viewer',
                invited_by INTEGER,
                accepted INTEGER DEFAULT 0,
                joined_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(team_id, user_id)
            );

            -- ═══ Marketplace ═══
            CREATE TABLE IF NOT EXISTS marketplace_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                author TEXT DEFAULT 'anonymous',
                author_id INTEGER,
                category TEXT DEFAULT 'general',
                tags TEXT DEFAULT '[]',
                language TEXT DEFAULT 'python',
                apis_used TEXT DEFAULT '[]',
                code TEXT DEFAULT '',
                downloads INTEGER DEFAULT 0,
                rating_sum REAL DEFAULT 0,
                rating_count INTEGER DEFAULT 0,
                version TEXT DEFAULT '1.0.0',
                verified INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS marketplace_reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                template_id TEXT NOT NULL,
                user_id INTEGER,
                rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
                comment TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (template_id) REFERENCES marketplace_templates(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            );

            -- ═══ CI/CD Pipeline Runs ═══
            CREATE TABLE IF NOT EXISTS cicd_runs (
                id TEXT PRIMARY KEY,
                pipeline_id TEXT,
                repo TEXT,
                branch TEXT DEFAULT 'main',
                gate_result TEXT DEFAULT 'PENDING',
                security_score INTEGER,
                compatibility_score INTEGER,
                budget_ok INTEGER DEFAULT 1,
                details_json TEXT DEFAULT '{}',
                triggered_by TEXT DEFAULT 'api',
                created_at TEXT DEFAULT (datetime('now'))
            );

            -- ═══ Billing ═══
            CREATE TABLE IF NOT EXISTS billing_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                amount_cents INTEGER DEFAULT 0,
                currency TEXT DEFAULT 'usd',
                stripe_event_id TEXT,
                description TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            -- ═══ Custom APIs (OpenAPI Import) ═══
            CREATE TABLE IF NOT EXISTS custom_apis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                name TEXT NOT NULL,
                protocol TEXT DEFAULT 'rest',
                base_url TEXT NOT NULL,
                spec_json TEXT,
                metadata_json TEXT DEFAULT '{}',
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            -- ═══ Indexes ═══
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX IF NOT EXISTS idx_code_history_user ON code_history(user_id);
            CREATE INDEX IF NOT EXISTS idx_usage_stats_user ON usage_stats(user_id);
            CREATE INDEX IF NOT EXISTS idx_usage_stats_created ON usage_stats(created_at);
            CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
            CREATE INDEX IF NOT EXISTS idx_budget_logs_user ON budget_logs(user_id);
            CREATE INDEX IF NOT EXISTS idx_api_responses_name ON api_responses(api_name);
            CREATE INDEX IF NOT EXISTS idx_change_alerts_api ON change_alerts(api_name);
            CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
            CREATE INDEX IF NOT EXISTS idx_incident_events_inc ON incident_events(incident_id);
            CREATE INDEX IF NOT EXISTS idx_alert_history_config ON alert_history(config_id);
            CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
            CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
            CREATE INDEX IF NOT EXISTS idx_marketplace_cat ON marketplace_templates(category);
            CREATE INDEX IF NOT EXISTS idx_cicd_runs_pipeline ON cicd_runs(pipeline_id);
            CREATE INDEX IF NOT EXISTS idx_billing_user ON billing_events(user_id);
            CREATE INDEX IF NOT EXISTS idx_security_scans_user ON security_scans(user_id);
            CREATE INDEX IF NOT EXISTS idx_custom_apis_user ON custom_apis(user_id);
        """)
        await _db.commit()
        logger.info(f"Database initialized at {DB_PATH} (all tables created)")


async def close_db():
    """Close the database connection."""
    global _db
    if _db:
        await _db.close()
        _db = None
        logger.info("Database connection closed")


# =============================================================================
# USER OPERATIONS
# =============================================================================

async def create_user(email: str, username: str, password_hash: str) -> Optional[int]:
    """Create a new user. Returns user ID or None if duplicate."""
    try:
        async with _db_lock:
            cursor = await _db.execute(
                "INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)",
                (email, username, password_hash)
            )
            await _db.commit()
            return cursor.lastrowid
    except aiosqlite.IntegrityError:
        return None


async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Get user by email."""
    async with _db_lock:
        cursor = await _db.execute(
            "SELECT * FROM users WHERE email = ?", (email,)
        )
        row = await cursor.fetchone()
        if row:
            return dict(row)
    return None


async def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Get user by ID."""
    async with _db_lock:
        cursor = await _db.execute(
            "SELECT id, email, username, plan, api_calls_today, created_at FROM users WHERE id = ?",
            (user_id,)
        )
        row = await cursor.fetchone()
        if row:
            return dict(row)
    return None


async def increment_api_calls(user_id: int) -> int:
    """Increment API call counter for user. Returns new count."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    async with _db_lock:
        # Check if we need to reset the counter
        cursor = await _db.execute(
            "SELECT api_calls_today, api_calls_reset_date FROM users WHERE id = ?",
            (user_id,)
        )
        row = await cursor.fetchone()
        if row:
            if row["api_calls_reset_date"] != today:
                # New day - reset counter
                await _db.execute(
                    "UPDATE users SET api_calls_today = 1, api_calls_reset_date = ? WHERE id = ?",
                    (today, user_id)
                )
                await _db.commit()
                return 1
            else:
                new_count = row["api_calls_today"] + 1
                await _db.execute(
                    "UPDATE users SET api_calls_today = ? WHERE id = ?",
                    (new_count, user_id)
                )
                await _db.commit()
                return new_count
    return 0


# =============================================================================
# CODE HISTORY OPERATIONS
# =============================================================================

async def save_code_history(
    user_id: Optional[int],
    use_case: str,
    language: str,
    generated_code: str,
    apis_used: List[str],
    validation_score: int,
    validation_grade: str,
    status: str,
    tokens_used: int
) -> int:
    """Save a code generation result to history."""
    async with _db_lock:
        cursor = await _db.execute(
            """INSERT INTO code_history 
               (user_id, use_case, language, generated_code, apis_used, 
                validation_score, validation_grade, status, tokens_used)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                user_id, use_case, language, generated_code,
                json.dumps(apis_used), validation_score, validation_grade,
                status, tokens_used
            )
        )
        await _db.commit()
        return cursor.lastrowid


async def get_code_history(user_id: Optional[int] = None, limit: int = 20) -> List[Dict[str, Any]]:
    """Get code generation history, optionally filtered by user."""
    async with _db_lock:
        if user_id:
            cursor = await _db.execute(
                "SELECT * FROM code_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
                (user_id, limit)
            )
        else:
            cursor = await _db.execute(
                "SELECT * FROM code_history ORDER BY created_at DESC LIMIT ?",
                (limit,)
            )
        rows = await cursor.fetchall()
        results = []
        for row in rows:
            d = dict(row)
            if d.get("apis_used"):
                d["apis_used"] = json.loads(d["apis_used"])
            results.append(d)
        return results


# =============================================================================
# USAGE STATS
# =============================================================================

async def log_usage(user_id: Optional[int], endpoint: str, response_time_ms: float, status_code: int):
    """Log an API usage event."""
    try:
        async with _db_lock:
            await _db.execute(
                "INSERT INTO usage_stats (user_id, endpoint, response_time_ms, status_code) VALUES (?, ?, ?, ?)",
                (user_id, endpoint, response_time_ms, status_code)
            )
            await _db.commit()
    except Exception as e:
        logger.error(f"Failed to log usage: {e}")


async def get_usage_stats(user_id: Optional[int] = None, days: int = 7) -> Dict[str, Any]:
    """Get usage stats summary."""
    async with _db_lock:
        if user_id:
            cursor = await _db.execute(
                """SELECT endpoint, COUNT(*) as count, AVG(response_time_ms) as avg_time
                   FROM usage_stats 
                   WHERE user_id = ? AND created_at > datetime('now', ?)
                   GROUP BY endpoint""",
                (user_id, f"-{days} days")
            )
        else:
            cursor = await _db.execute(
                """SELECT endpoint, COUNT(*) as count, AVG(response_time_ms) as avg_time
                   FROM usage_stats 
                   WHERE created_at > datetime('now', ?)
                   GROUP BY endpoint""",
                (f"-{days} days",)
            )
        rows = await cursor.fetchall()
        return {
            "endpoints": [dict(row) for row in rows],
            "total_calls": sum(dict(row)["count"] for row in rows) if rows else 0,
        }


# =============================================================================
# API KEY OPERATIONS
# =============================================================================

async def add_api_key(
    user_id: int,
    key_name: str,
    api_provider: str,
    encrypted_key: str,
    budget_limit: float = 0,
    budget_period: str = "monthly",
    call_limit: int = 0,
) -> int:
    """Add a new API key for a user. Returns key ID."""
    async with _db_lock:
        cursor = await _db.execute(
            """INSERT INTO api_keys 
               (user_id, key_name, api_provider, encrypted_key, budget_limit, budget_period, call_limit)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (user_id, key_name, api_provider, encrypted_key, budget_limit, budget_period, call_limit)
        )
        await _db.commit()
        return cursor.lastrowid


async def get_api_keys(user_id: int) -> List[Dict[str, Any]]:
    """Get all API keys for a user (keys are masked)."""
    async with _db_lock:
        cursor = await _db.execute(
            """SELECT id, key_name, api_provider, is_active, 
                      budget_limit, budget_used, budget_period, budget_reset_date,
                      call_count, call_limit, last_used_at, created_at
               FROM api_keys WHERE user_id = ? ORDER BY created_at DESC""",
            (user_id,)
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def get_api_key_by_id(key_id: int, user_id: int) -> Optional[Dict[str, Any]]:
    """Get a single API key by ID, verifying ownership."""
    async with _db_lock:
        cursor = await _db.execute(
            """SELECT id, key_name, api_provider, encrypted_key, is_active,
                      budget_limit, budget_used, budget_period, budget_reset_date,
                      call_count, call_limit, last_used_at, created_at
               FROM api_keys WHERE id = ? AND user_id = ?""",
            (key_id, user_id)
        )
        row = await cursor.fetchone()
        if row:
            return dict(row)
    return None


async def update_api_key(key_id: int, user_id: int, updates: Dict[str, Any]) -> bool:
    """Update an API key's settings. Returns True if updated."""
    allowed_fields = {
        "key_name", "is_active", "budget_limit", "budget_period", "call_limit"
    }
    filtered = {k: v for k, v in updates.items() if k in allowed_fields}
    if not filtered:
        return False
    
    set_clause = ", ".join(f"{k} = ?" for k in filtered.keys())
    values = list(filtered.values()) + [key_id, user_id]
    
    async with _db_lock:
        cursor = await _db.execute(
            f"UPDATE api_keys SET {set_clause} WHERE id = ? AND user_id = ?",
            values
        )
        await _db.commit()
        return cursor.rowcount > 0


async def delete_api_key(key_id: int, user_id: int) -> bool:
    """Delete an API key. Returns True if deleted."""
    async with _db_lock:
        cursor = await _db.execute(
            "DELETE FROM api_keys WHERE id = ? AND user_id = ?",
            (key_id, user_id)
        )
        await _db.commit()
        return cursor.rowcount > 0


async def record_api_key_usage(key_id: int, user_id: int, cost: float = 0, endpoint: str = "") -> Dict[str, Any]:
    """
    Record usage against an API key, increment counters, check budget.
    Returns: {"allowed": bool, "reason": str, "budget_remaining": float, "calls_remaining": int}
    """
    async with _db_lock:
        # Get key info
        cursor = await _db.execute(
            "SELECT * FROM api_keys WHERE id = ? AND user_id = ?",
            (key_id, user_id)
        )
        key = await cursor.fetchone()
        if not key:
            return {"allowed": False, "reason": "API key not found"}
        
        key = dict(key)
        
        if not key["is_active"]:
            return {"allowed": False, "reason": "API key is disabled"}
        
        # Check per-key budget
        if key["budget_limit"] > 0 and (key["budget_used"] + cost) > key["budget_limit"]:
            return {
                "allowed": False,
                "reason": f"API key '{key['key_name']}' budget exceeded (${key['budget_used']:.2f} / ${key['budget_limit']:.2f})",
                "budget_remaining": max(0, key["budget_limit"] - key["budget_used"]),
                "calls_remaining": max(0, key["call_limit"] - key["call_count"]) if key["call_limit"] > 0 else -1,
            }
        
        # Check per-key call limit
        if key["call_limit"] > 0 and key["call_count"] >= key["call_limit"]:
            return {
                "allowed": False,
                "reason": f"API key '{key['key_name']}' call limit reached ({key['call_count']} / {key['call_limit']})",
                "budget_remaining": max(0, key["budget_limit"] - key["budget_used"]) if key["budget_limit"] > 0 else -1,
                "calls_remaining": 0,
            }
        
        # Check overall user budget
        cursor2 = await _db.execute(
            "SELECT overall_budget_limit, overall_budget_used FROM users WHERE id = ?",
            (user_id,)
        )
        user = await cursor2.fetchone()
        if user:
            user = dict(user)
            if user["overall_budget_limit"] > 0 and (user["overall_budget_used"] + cost) > user["overall_budget_limit"]:
                return {
                    "allowed": False,
                    "reason": f"Overall budget exceeded (${user['overall_budget_used']:.2f} / ${user['overall_budget_limit']:.2f})",
                    "budget_remaining": max(0, user["overall_budget_limit"] - user["overall_budget_used"]),
                    "calls_remaining": max(0, key["call_limit"] - key["call_count"]) if key["call_limit"] > 0 else -1,
                }
        
        # All checks passed — record usage
        now = datetime.now(timezone.utc).isoformat()
        await _db.execute(
            "UPDATE api_keys SET budget_used = budget_used + ?, call_count = call_count + 1, last_used_at = ? WHERE id = ?",
            (cost, now, key_id)
        )
        await _db.execute(
            "UPDATE users SET overall_budget_used = overall_budget_used + ? WHERE id = ?",
            (cost, user_id)
        )
        
        # Log the budget event
        await _db.execute(
            "INSERT INTO budget_logs (user_id, api_key_id, amount, description, endpoint) VALUES (?, ?, ?, ?, ?)",
            (user_id, key_id, cost, f"API call to {endpoint or 'unknown'}", endpoint)
        )
        
        await _db.commit()
        
        new_budget_used = key["budget_used"] + cost
        new_call_count = key["call_count"] + 1
        return {
            "allowed": True,
            "reason": "OK",
            "budget_remaining": max(0, key["budget_limit"] - new_budget_used) if key["budget_limit"] > 0 else -1,
            "calls_remaining": max(0, key["call_limit"] - new_call_count) if key["call_limit"] > 0 else -1,
        }


# =============================================================================
# OVERALL BUDGET OPERATIONS
# =============================================================================

async def set_overall_budget(user_id: int, budget_limit: float, alert_threshold: float = 80, period: str = "monthly") -> bool:
    """Set the user's overall budget limit across all API keys."""
    async with _db_lock:
        cursor = await _db.execute(
            """UPDATE users 
               SET overall_budget_limit = ?, budget_alert_threshold = ?, budget_period = ?, updated_at = datetime('now')
               WHERE id = ?""",
            (budget_limit, alert_threshold, period, user_id)
        )
        await _db.commit()
        return cursor.rowcount > 0


async def reset_budget(user_id: int, key_id: Optional[int] = None) -> bool:
    """Reset budget usage. If key_id provided, reset just that key; otherwise reset all."""
    async with _db_lock:
        if key_id:
            await _db.execute(
                "UPDATE api_keys SET budget_used = 0, call_count = 0 WHERE id = ? AND user_id = ?",
                (key_id, user_id)
            )
        else:
            await _db.execute(
                "UPDATE api_keys SET budget_used = 0, call_count = 0 WHERE user_id = ?",
                (user_id,)
            )
            await _db.execute(
                "UPDATE users SET overall_budget_used = 0 WHERE id = ?",
                (user_id,)
            )
        await _db.commit()
        return True


async def get_budget_summary(user_id: int) -> Dict[str, Any]:
    """Get complete budget summary for a user."""
    async with _db_lock:
        # User overall budget
        cursor = await _db.execute(
            """SELECT overall_budget_limit, overall_budget_used, budget_alert_threshold, 
                      budget_period, budget_reset_date
               FROM users WHERE id = ?""",
            (user_id,)
        )
        user_row = await cursor.fetchone()
        if not user_row:
            return {"status": "error", "message": "User not found"}
        user_budget = dict(user_row)
        
        # Per-key budgets
        cursor2 = await _db.execute(
            """SELECT id, key_name, api_provider, is_active,
                      budget_limit, budget_used, budget_period,
                      call_count, call_limit, last_used_at
               FROM api_keys WHERE user_id = ? ORDER BY created_at DESC""",
            (user_id,)
        )
        keys = [dict(row) for row in await cursor2.fetchall()]
        
        # Recent budget logs
        cursor3 = await _db.execute(
            """SELECT bl.amount, bl.description, bl.endpoint, bl.created_at,
                      ak.key_name, ak.api_provider
               FROM budget_logs bl
               LEFT JOIN api_keys ak ON bl.api_key_id = ak.id
               WHERE bl.user_id = ?
               ORDER BY bl.created_at DESC LIMIT 50""",
            (user_id,)
        )
        logs = [dict(row) for row in await cursor3.fetchall()]
        
        # Calculate totals
        total_limit = user_budget["overall_budget_limit"] or 0
        total_used = user_budget["overall_budget_used"] or 0
        alert_pct = user_budget["budget_alert_threshold"] or 80
        
        # Per-key totals
        keys_total_limit = sum(k["budget_limit"] or 0 for k in keys)
        keys_total_used = sum(k["budget_used"] or 0 for k in keys)
        total_calls = sum(k["call_count"] or 0 for k in keys)
        
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
                "period": user_budget["budget_period"],
            },
            "keys": [{
                **k,
                "budget_remaining": max(0, (k["budget_limit"] or 0) - (k["budget_used"] or 0)) if (k["budget_limit"] or 0) > 0 else -1,
                "usage_percentage": round(((k["budget_used"] or 0) / (k["budget_limit"] or 1)) * 100, 1) if (k["budget_limit"] or 0) > 0 else 0,
                "calls_remaining": max(0, (k["call_limit"] or 0) - (k["call_count"] or 0)) if (k["call_limit"] or 0) > 0 else -1,
            } for k in keys],
            "totals": {
                "keys_count": len(keys),
                "active_keys": sum(1 for k in keys if k["is_active"]),
                "keys_total_limit": keys_total_limit,
                "keys_total_used": keys_total_used,
                "total_calls": total_calls,
            },
            "recent_logs": logs,
        }


# =============================================================================
# API RESPONSE / CHANGE DETECTION
# =============================================================================

async def save_api_response(api_name: str, response_hash: str, schema_json: str,
                            response_keys: str, field_count: int, status_code: int) -> int:
    """Save an API response snapshot for change detection."""
    async with _db_lock:
        cursor = await _db.execute(
            """INSERT INTO api_responses (api_name, response_hash, schema_json, response_keys, field_count, status_code)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (api_name, response_hash, schema_json, response_keys, field_count, status_code)
        )
        await _db.commit()
        return cursor.lastrowid


async def get_last_api_response(api_name: str) -> Optional[Dict[str, Any]]:
    """Get the most recent response snapshot for an API."""
    async with _db_lock:
        cursor = await _db.execute(
            "SELECT * FROM api_responses WHERE api_name = ? ORDER BY created_at DESC LIMIT 1",
            (api_name,)
        )
        row = await cursor.fetchone()
        return dict(row) if row else None


async def get_api_response_history(api_name: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Get response history for an API."""
    async with _db_lock:
        cursor = await _db.execute(
            "SELECT * FROM api_responses WHERE api_name = ? ORDER BY created_at DESC LIMIT ?",
            (api_name, limit)
        )
        return [dict(r) for r in await cursor.fetchall()]


async def save_change_alert(api_name: str, severity: str, summary: str,
                            diff_json: str, old_hash: str, new_hash: str) -> int:
    """Save a change detection alert."""
    async with _db_lock:
        cursor = await _db.execute(
            """INSERT INTO change_alerts (api_name, severity, summary, diff_json, old_hash, new_hash)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (api_name, severity, summary, diff_json, old_hash, new_hash)
        )
        await _db.commit()
        return cursor.lastrowid


async def get_change_alerts_db(limit: int = 50, api_name: Optional[str] = None,
                               unacked_only: bool = False) -> List[Dict[str, Any]]:
    """Get change alerts from DB."""
    async with _db_lock:
        query = "SELECT * FROM change_alerts WHERE 1=1"
        params: list = []
        if api_name:
            query += " AND api_name = ?"
            params.append(api_name)
        if unacked_only:
            query += " AND acknowledged = 0"
        query += " ORDER BY detected_at DESC LIMIT ?"
        params.append(limit)
        cursor = await _db.execute(query, params)
        return [dict(r) for r in await cursor.fetchall()]


async def ack_change_alert_db(alert_id: int) -> bool:
    """Acknowledge a change alert."""
    async with _db_lock:
        cursor = await _db.execute(
            "UPDATE change_alerts SET acknowledged = 1 WHERE id = ?", (alert_id,)
        )
        await _db.commit()
        return cursor.rowcount > 0


# =============================================================================
# SECURITY SCANS
# =============================================================================

async def save_security_scan(user_id: Optional[int], scan_type: str, target: str,
                             language: str, score: int, grade: str,
                             total_issues: int, results_json: str) -> int:
    """Save a security scan result."""
    async with _db_lock:
        cursor = await _db.execute(
            """INSERT INTO security_scans (user_id, scan_type, target, language, score, grade, total_issues, results_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, scan_type, target, language, score, grade, total_issues, results_json)
        )
        await _db.commit()
        return cursor.lastrowid


async def get_security_scans(user_id: Optional[int] = None, limit: int = 20) -> List[Dict[str, Any]]:
    """Get past security scans."""
    async with _db_lock:
        if user_id:
            cursor = await _db.execute(
                "SELECT * FROM security_scans WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
                (user_id, limit)
            )
        else:
            cursor = await _db.execute(
                "SELECT * FROM security_scans ORDER BY created_at DESC LIMIT ?", (limit,)
            )
        return [dict(r) for r in await cursor.fetchall()]


# =============================================================================
# INCIDENTS (DB-BACKED)
# =============================================================================

async def save_incident(incident_id: str, title: str, description: str,
                        severity: str, affected_apis: List[str],
                        detected_by: str) -> str:
    """Create an incident in DB."""
    now = datetime.now(timezone.utc).isoformat()
    async with _db_lock:
        await _db.execute(
            """INSERT INTO incidents (id, title, description, severity, affected_apis, detected_by, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (incident_id, title, description, severity, json.dumps(affected_apis), detected_by, now, now)
        )
        await _db.commit()
    return incident_id


async def save_incident_event(event_id: str, incident_id: str, event_type: str,
                              message: str, author: str) -> str:
    """Add an event to incident timeline."""
    async with _db_lock:
        await _db.execute(
            "INSERT INTO incident_events (id, incident_id, event_type, message, author) VALUES (?, ?, ?, ?, ?)",
            (event_id, incident_id, event_type, message, author)
        )
        await _db.commit()
    return event_id


async def update_incident_status(incident_id: str, status: str,
                                 resolution: Optional[str] = None,
                                 root_cause: Optional[str] = None) -> bool:
    """Update incident status."""
    now = datetime.now(timezone.utc).isoformat()
    async with _db_lock:
        sets = ["status = ?", "updated_at = ?"]
        params: list = [status, now]
        if status == "resolved":
            sets.append("resolved_at = ?")
            params.append(now)
        if resolution:
            sets.append("resolution = ?")
            params.append(resolution)
        if root_cause:
            sets.append("root_cause = ?")
            params.append(root_cause)
        params.append(incident_id)
        cursor = await _db.execute(
            f"UPDATE incidents SET {', '.join(sets)} WHERE id = ?", params
        )
        await _db.commit()
        return cursor.rowcount > 0


async def get_incidents_db(limit: int = 50, status: Optional[str] = None,
                           severity: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get incidents from DB with optional filters."""
    async with _db_lock:
        query = "SELECT * FROM incidents WHERE 1=1"
        params: list = []
        if status:
            query += " AND status = ?"
            params.append(status)
        if severity:
            query += " AND severity = ?"
            params.append(severity)
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        cursor = await _db.execute(query, params)
        rows = [dict(r) for r in await cursor.fetchall()]
        for row in rows:
            if row.get("affected_apis"):
                try:
                    row["affected_apis"] = json.loads(row["affected_apis"])
                except Exception:
                    row["affected_apis"] = []
        return rows


async def get_incident_db(incident_id: str) -> Optional[Dict[str, Any]]:
    """Get single incident with timeline."""
    async with _db_lock:
        cursor = await _db.execute("SELECT * FROM incidents WHERE id = ?", (incident_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        incident = dict(row)
        if incident.get("affected_apis"):
            try:
                incident["affected_apis"] = json.loads(incident["affected_apis"])
            except Exception:
                incident["affected_apis"] = []
        # Get timeline events
        cursor2 = await _db.execute(
            "SELECT * FROM incident_events WHERE incident_id = ? ORDER BY created_at ASC",
            (incident_id,)
        )
        incident["timeline"] = [dict(e) for e in await cursor2.fetchall()]
        return incident


async def get_incident_stats_db() -> Dict[str, Any]:
    """Get incident statistics from DB."""
    async with _db_lock:
        cursor = await _db.execute("SELECT COUNT(*) as cnt FROM incidents")
        total = (await cursor.fetchone())["cnt"]
        cursor = await _db.execute("SELECT COUNT(*) as cnt FROM incidents WHERE status != 'resolved'")
        active = (await cursor.fetchone())["cnt"]
        cursor = await _db.execute("SELECT COUNT(*) as cnt FROM incidents WHERE status = 'resolved'")
        resolved = (await cursor.fetchone())["cnt"]
        cursor = await _db.execute(
            "SELECT COUNT(*) as cnt FROM incidents WHERE created_at > datetime('now', '-1 day')"
        )
        last_24h = (await cursor.fetchone())["cnt"]
        return {
            "total": total, "active": active, "resolved": resolved,
            "last_24h": last_24h, "mttr_minutes": 0,
            "by_severity": {},
        }


# =============================================================================
# ALERT CONFIGS & KILL-SWITCH (DB)
# =============================================================================

async def save_alert_config(config_id: str, user_id: Optional[int], name: str,
                            channel: str, target: str, conditions: Dict,
                            priority: str) -> str:
    """Save an alert configuration."""
    async with _db_lock:
        await _db.execute(
            """INSERT INTO alert_configs (id, user_id, name, channel, target, conditions_json, priority)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (config_id, user_id, name, channel, target, json.dumps(conditions), priority)
        )
        await _db.commit()
    return config_id


async def get_alert_configs_db(user_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """Get alert configs."""
    async with _db_lock:
        if user_id:
            cursor = await _db.execute(
                "SELECT * FROM alert_configs WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
            )
        else:
            cursor = await _db.execute("SELECT * FROM alert_configs ORDER BY created_at DESC")
        rows = [dict(r) for r in await cursor.fetchall()]
        for r in rows:
            if r.get("conditions_json"):
                try:
                    r["conditions"] = json.loads(r["conditions_json"])
                except Exception:
                    r["conditions"] = {}
        return rows


async def delete_alert_config_db(config_id: str) -> bool:
    """Delete an alert config."""
    async with _db_lock:
        cursor = await _db.execute("DELETE FROM alert_configs WHERE id = ?", (config_id,))
        await _db.commit()
        return cursor.rowcount > 0


async def save_alert_event(config_id: Optional[str], channel: str,
                           event_type: str, message: str, delivered: bool) -> int:
    """Log an alert event."""
    async with _db_lock:
        cursor = await _db.execute(
            "INSERT INTO alert_history (config_id, channel, event_type, message, delivered) VALUES (?, ?, ?, ?, ?)",
            (config_id, channel, event_type, message, 1 if delivered else 0)
        )
        await _db.commit()
        return cursor.lastrowid


async def get_alert_history_db(limit: int = 50) -> List[Dict[str, Any]]:
    """Get alert history."""
    async with _db_lock:
        cursor = await _db.execute(
            "SELECT * FROM alert_history ORDER BY created_at DESC LIMIT ?", (limit,)
        )
        return [dict(r) for r in await cursor.fetchall()]


async def save_kill_switch(api_name: str, reason: str, activated_by: str) -> bool:
    """Activate a kill-switch for an API."""
    async with _db_lock:
        try:
            await _db.execute(
                """INSERT INTO kill_switches (api_name, reason, activated_by)
                   VALUES (?, ?, ?)
                   ON CONFLICT(api_name) DO UPDATE SET reason=excluded.reason,
                   activated_by=excluded.activated_by, activated_at=datetime('now'), deactivated_at=NULL""",
                (api_name, reason, activated_by)
            )
            await _db.commit()
            return True
        except Exception as e:
            logger.error(f"Kill switch save error: {e}")
            return False


async def deactivate_kill_switch_db(api_name: str) -> bool:
    """Deactivate a kill-switch."""
    async with _db_lock:
        cursor = await _db.execute(
            "UPDATE kill_switches SET deactivated_at = datetime('now') WHERE api_name = ? AND deactivated_at IS NULL",
            (api_name,)
        )
        await _db.commit()
        return cursor.rowcount > 0


async def get_kill_switches_db() -> List[Dict[str, Any]]:
    """Get all active kill-switches."""
    async with _db_lock:
        cursor = await _db.execute(
            "SELECT * FROM kill_switches WHERE deactivated_at IS NULL ORDER BY activated_at DESC"
        )
        return [dict(r) for r in await cursor.fetchall()]


async def is_api_killed(api_name: str) -> bool:
    """Check if an API has an active kill-switch."""
    async with _db_lock:
        cursor = await _db.execute(
            "SELECT COUNT(*) as cnt FROM kill_switches WHERE api_name = ? AND deactivated_at IS NULL",
            (api_name,)
        )
        row = await cursor.fetchone()
        return row["cnt"] > 0 if row else False


# =============================================================================
# TEAMS (DB)
# =============================================================================

async def save_team(team_id: str, name: str, owner_id: int) -> str:
    """Create a team."""
    async with _db_lock:
        await _db.execute(
            "INSERT INTO teams (id, name, owner_id) VALUES (?, ?, ?)",
            (team_id, name, owner_id)
        )
        # Add owner as member
        await _db.execute(
            "INSERT INTO team_members (team_id, user_id, role, accepted) VALUES (?, ?, 'owner', 1)",
            (team_id, owner_id)
        )
        await _db.commit()
    return team_id


async def get_team_db(team_id: str) -> Optional[Dict[str, Any]]:
    """Get team with members."""
    async with _db_lock:
        cursor = await _db.execute("SELECT * FROM teams WHERE id = ?", (team_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        team = dict(row)
        cursor2 = await _db.execute(
            """SELECT tm.*, u.email, u.username FROM team_members tm
               JOIN users u ON tm.user_id = u.id WHERE tm.team_id = ?""",
            (team_id,)
        )
        team["members"] = [dict(m) for m in await cursor2.fetchall()]
        return team


async def get_user_teams(user_id: int) -> List[Dict[str, Any]]:
    """Get all teams a user belongs to."""
    async with _db_lock:
        cursor = await _db.execute(
            """SELECT t.*, tm.role FROM teams t
               JOIN team_members tm ON t.id = tm.team_id
               WHERE tm.user_id = ? AND tm.accepted = 1""",
            (user_id,)
        )
        return [dict(r) for r in await cursor.fetchall()]


async def add_team_member(team_id: str, user_id: int, role: str, invited_by: int) -> bool:
    """Add a member to a team."""
    async with _db_lock:
        try:
            await _db.execute(
                "INSERT INTO team_members (team_id, user_id, role, invited_by) VALUES (?, ?, ?, ?)",
                (team_id, user_id, role, invited_by)
            )
            await _db.commit()
            return True
        except aiosqlite.IntegrityError:
            return False


async def update_team_member_role(team_id: str, user_id: int, role: str) -> bool:
    """Update a team member's role."""
    async with _db_lock:
        cursor = await _db.execute(
            "UPDATE team_members SET role = ? WHERE team_id = ? AND user_id = ?",
            (role, team_id, user_id)
        )
        await _db.commit()
        return cursor.rowcount > 0


async def remove_team_member(team_id: str, user_id: int) -> bool:
    """Remove a member from a team."""
    async with _db_lock:
        cursor = await _db.execute(
            "DELETE FROM team_members WHERE team_id = ? AND user_id = ? AND role != 'owner'",
            (team_id, user_id)
        )
        await _db.commit()
        return cursor.rowcount > 0


# =============================================================================
# MARKETPLACE (DB)
# =============================================================================

async def save_marketplace_template(template_id: str, name: str, description: str,
                                    author: str, author_id: Optional[int],
                                    category: str, tags: List[str], language: str,
                                    apis_used: List[str], code: str, version: str) -> str:
    """Publish a template to the marketplace."""
    async with _db_lock:
        await _db.execute(
            """INSERT INTO marketplace_templates
               (id, name, description, author, author_id, category, tags, language, apis_used, code, version)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (template_id, name, description, author, author_id, category,
             json.dumps(tags), language, json.dumps(apis_used), code, version)
        )
        await _db.commit()
    return template_id


async def get_marketplace_templates_db(category: Optional[str] = None,
                                       language: Optional[str] = None,
                                       search: Optional[str] = None,
                                       limit: int = 50) -> List[Dict[str, Any]]:
    """Get marketplace templates with optional filters."""
    async with _db_lock:
        query = "SELECT * FROM marketplace_templates WHERE 1=1"
        params: list = []
        if category:
            query += " AND category = ?"
            params.append(category)
        if language:
            query += " AND language = ?"
            params.append(language)
        if search:
            query += " AND (name LIKE ? OR description LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%"])
        query += " ORDER BY downloads DESC LIMIT ?"
        params.append(limit)
        cursor = await _db.execute(query, params)
        rows = [dict(r) for r in await cursor.fetchall()]
        for r in rows:
            for field in ("tags", "apis_used"):
                if r.get(field):
                    try:
                        r[field] = json.loads(r[field])
                    except Exception:
                        r[field] = []
            r["rating"] = round(r["rating_sum"] / r["rating_count"], 1) if r.get("rating_count", 0) > 0 else 0
            r["review_count"] = r.get("rating_count", 0)
        return rows


async def get_marketplace_template_db(template_id: str) -> Optional[Dict[str, Any]]:
    """Get a single marketplace template."""
    async with _db_lock:
        cursor = await _db.execute(
            "SELECT * FROM marketplace_templates WHERE id = ?", (template_id,)
        )
        row = await cursor.fetchone()
        if not row:
            return None
        t = dict(row)
        for field in ("tags", "apis_used"):
            if t.get(field):
                try:
                    t[field] = json.loads(t[field])
                except Exception:
                    t[field] = []
        t["rating"] = round(t["rating_sum"] / t["rating_count"], 1) if t.get("rating_count", 0) > 0 else 0
        t["review_count"] = t.get("rating_count", 0)
        return t


async def increment_template_downloads(template_id: str) -> bool:
    """Increment download counter."""
    async with _db_lock:
        cursor = await _db.execute(
            "UPDATE marketplace_templates SET downloads = downloads + 1 WHERE id = ?",
            (template_id,)
        )
        await _db.commit()
        return cursor.rowcount > 0


async def add_template_review(template_id: str, user_id: Optional[int],
                              rating: int, comment: str) -> int:
    """Add a review to a template."""
    async with _db_lock:
        cursor = await _db.execute(
            "INSERT INTO marketplace_reviews (template_id, user_id, rating, comment) VALUES (?, ?, ?, ?)",
            (template_id, user_id, rating, comment)
        )
        await _db.execute(
            "UPDATE marketplace_templates SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE id = ?",
            (rating, template_id)
        )
        await _db.commit()
        return cursor.lastrowid


# =============================================================================
# CI/CD RUNS
# =============================================================================

async def save_cicd_run(run_id: str, pipeline_id: str, repo: str, branch: str,
                        gate_result: str, security_score: int,
                        compatibility_score: int, budget_ok: bool,
                        details: Dict, triggered_by: str) -> str:
    """Save a CI/CD run result."""
    async with _db_lock:
        await _db.execute(
            """INSERT INTO cicd_runs (id, pipeline_id, repo, branch, gate_result,
               security_score, compatibility_score, budget_ok, details_json, triggered_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (run_id, pipeline_id, repo, branch, gate_result, security_score,
             compatibility_score, 1 if budget_ok else 0, json.dumps(details), triggered_by)
        )
        await _db.commit()
    return run_id


async def get_cicd_runs_db(limit: int = 20, pipeline_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Get CI/CD run history."""
    async with _db_lock:
        if pipeline_id:
            cursor = await _db.execute(
                "SELECT * FROM cicd_runs WHERE pipeline_id = ? ORDER BY created_at DESC LIMIT ?",
                (pipeline_id, limit)
            )
        else:
            cursor = await _db.execute(
                "SELECT * FROM cicd_runs ORDER BY created_at DESC LIMIT ?", (limit,)
            )
        rows = [dict(r) for r in await cursor.fetchall()]
        for r in rows:
            if r.get("details_json"):
                try:
                    r["details"] = json.loads(r["details_json"])
                except Exception:
                    r["details"] = {}
        return rows


# =============================================================================
# BILLING
# =============================================================================

async def save_billing_event(user_id: int, event_type: str, amount_cents: int,
                             currency: str, stripe_event_id: str, description: str) -> int:
    """Log a billing event."""
    async with _db_lock:
        cursor = await _db.execute(
            """INSERT INTO billing_events (user_id, event_type, amount_cents, currency, stripe_event_id, description)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (user_id, event_type, amount_cents, currency, stripe_event_id, description)
        )
        await _db.commit()
        return cursor.lastrowid


async def get_billing_history(user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
    """Get billing history for a user."""
    async with _db_lock:
        cursor = await _db.execute(
            "SELECT * FROM billing_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit)
        )
        return [dict(r) for r in await cursor.fetchall()]


async def update_user_plan(user_id: int, plan: str,
                           stripe_customer_id: Optional[str] = None,
                           stripe_subscription_id: Optional[str] = None) -> bool:
    """Update user's plan (after Stripe subscription)."""
    async with _db_lock:
        sets = ["plan = ?", "updated_at = datetime('now')"]
        params: list = [plan]
        if stripe_customer_id:
            sets.append("stripe_customer_id = ?")
            params.append(stripe_customer_id)
        if stripe_subscription_id:
            sets.append("stripe_subscription_id = ?")
            params.append(stripe_subscription_id)
        params.append(user_id)
        cursor = await _db.execute(
            f"UPDATE users SET {', '.join(sets)} WHERE id = ?", params
        )
        await _db.commit()
        return cursor.rowcount > 0


# =============================================================================
# CUSTOM APIS (OpenAPI Import)
# =============================================================================

async def save_custom_api(user_id: int, name: str, protocol: str, base_url: str,
                          spec_json: str, metadata_json: str) -> int:
    """Save a custom API imported via OpenAPI/Swagger."""
    async with _db_lock:
        cursor = await _db.execute(
            """INSERT INTO custom_apis (user_id, name, protocol, base_url, spec_json, metadata_json)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (user_id, name, protocol, base_url, spec_json, metadata_json)
        )
        await _db.commit()
        return cursor.lastrowid


async def get_custom_apis(user_id: int) -> List[Dict[str, Any]]:
    """Get user's custom APIs."""
    async with _db_lock:
        cursor = await _db.execute(
            "SELECT * FROM custom_apis WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC",
            (user_id,)
        )
        rows = [dict(r) for r in await cursor.fetchall()]
        for r in rows:
            for field in ("spec_json", "metadata_json"):
                if r.get(field):
                    try:
                        r[field] = json.loads(r[field])
                    except Exception:
                        pass
        return rows


async def delete_custom_api(api_id: int, user_id: int) -> bool:
    """Delete a custom API."""
    async with _db_lock:
        cursor = await _db.execute(
            "UPDATE custom_apis SET is_active = 0 WHERE id = ? AND user_id = ?",
            (api_id, user_id)
        )
        await _db.commit()
        return cursor.rowcount > 0