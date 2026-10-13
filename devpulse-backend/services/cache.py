"""
Redis Cache Layer — optional caching for hot paths.

Falls back to an in-memory LRU dict when Redis is unavailable,
so the app always works without a Redis server.

Public API
----------
cache_get(key)              → dict | None
cache_set(key, value, ttl)  → None
cache_delete(key)           → None
cache_delete_pattern(pat)   → int        (glob-style: "cost:*")
cache_clear_prefix(prefix)  → int        (alias kept for backward compat)
close_cache()               → None

Key helpers
-----------
health_cache_key()                      → "health:dashboard"
security_scan_key(code_hash)            → "scan:{code_hash}"
cost_breakdown_key(user_id, days)       → "cost:{user_id}:{days}"
user_plan_key(user_id)                  → "plan:{user_id}"
"""
import hashlib
import os
import json
import time
import logging
from typing import Any, Dict, Optional
from collections import OrderedDict

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "")

_redis = None            # lazy-init redis client
_fallback: OrderedDict = OrderedDict()  # in-memory LRU
_FALLBACK_MAX = 1024


async def _get_redis():
    """Lazy-init async redis client."""
    global _redis
    if _redis is not None:
        return _redis
    if not REDIS_URL:
        return None
    try:
        import redis.asyncio as aioredis
        _redis = aioredis.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=3,
        )
        await _redis.ping()
        logger.info("Redis connected")
        return _redis
    except Exception as exc:
        logger.warning(f"Redis unavailable ({exc}), using in-memory fallback")
        _redis = None
        return None


# ── Public API ───────────────────────────────────────────────────────────────

async def cache_get(key: str) -> Optional[Dict[str, Any]]:
    """Get a value from cache. Returns None on miss."""
    r = await _get_redis()
    if r:
        try:
            val = await r.get(key)
            if val is not None:
                return json.loads(val)
        except Exception:
            pass
    else:
        entry = _fallback.get(key)
        if entry:
            value, expires = entry
            if expires == 0 or time.time() < expires:
                _fallback.move_to_end(key)
                return value
            else:
                _fallback.pop(key, None)
    return None


async def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    """Store a value in cache with TTL in seconds (default 5 min)."""
    r = await _get_redis()
    if r:
        try:
            await r.setex(key, ttl, json.dumps(value, default=str))
        except Exception:
            pass
    else:
        if len(_fallback) >= _FALLBACK_MAX:
            _fallback.popitem(last=False)
        expires = time.time() + ttl if ttl > 0 else 0
        _fallback[key] = (value, expires)


async def cache_delete(key: str) -> None:
    """Delete a single key from cache."""
    r = await _get_redis()
    if r:
        try:
            await r.delete(key)
        except Exception:
            pass
    else:
        _fallback.pop(key, None)


async def cache_delete_pattern(pattern: str) -> int:
    """
    Delete all keys matching a glob-style pattern (e.g. ``cost:*``).

    Uses Redis SCAN + DELETE when available; falls back to prefix
    matching on the in-memory dict (the ``*`` at the end is stripped).
    Returns the number of keys deleted.
    """
    r = await _get_redis()
    count = 0
    if r:
        try:
            async for key in r.scan_iter(match=pattern, count=200):
                await r.delete(key)
                count += 1
        except Exception:
            pass
    else:
        # Convert glob pattern to simple prefix matching for fallback
        prefix = pattern.rstrip("*")
        keys_to_del = [k for k in _fallback if k.startswith(prefix)]
        for k in keys_to_del:
            _fallback.pop(k, None)
            count += 1
    return count


async def cache_clear_prefix(prefix: str) -> int:
    """Delete all keys matching a prefix. Returns count deleted.

    Backward-compatible alias for ``cache_delete_pattern(prefix + '*')``.
    """
    return await cache_delete_pattern(f"{prefix}*")


async def close_cache():
    """Close the Redis connection."""
    global _redis
    if _redis:
        await _redis.close()
        _redis = None
        logger.info("Redis connection closed")


# ── Cache key helpers ────────────────────────────────────────────────────────

def health_cache_key() -> str:
    """Cache key for the dashboard health endpoint."""
    return "health:dashboard"


def security_scan_key(code_hash: str) -> str:
    """Cache key for a security scan result, keyed by code hash."""
    return f"scan:{code_hash}"


def cost_breakdown_key(user_id: int, days: int) -> str:
    """Cache key for cost breakdown per user and time window."""
    return f"cost:{user_id}:{days}"


def user_plan_key(user_id: int) -> str:
    """Cache key for a user's billing plan."""
    return f"plan:{user_id}"


def make_code_hash(code: str) -> str:
    """Return a short SHA-256 hex digest of *code* for use as cache key segment."""
    return hashlib.sha256(code.encode()).hexdigest()[:16]
