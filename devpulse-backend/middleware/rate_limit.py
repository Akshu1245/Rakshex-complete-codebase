"""
Redis-backed Sliding Window Rate Limiter Middleware.

Limits are enforced per user tier:
    Free        100 requests / hour
    Pro       2 000 requests / hour
    Team     10 000 requests / hour

When Redis is unavailable the middleware falls back to an in-memory
``collections.defaultdict`` so the app never crashes due to a missing
cache layer.

Exempt routes (health, docs, openapi) are never rate-limited.

Response headers on every reply:
    X-RateLimit-Limit       – max requests in window
    X-RateLimit-Remaining   – remaining budget
    X-RateLimit-Reset       – UTC epoch when window resets

On 429 the ``Retry-After`` header tells clients how many seconds to wait.
"""
from __future__ import annotations

import logging
import os
import time
from collections import defaultdict
from typing import Dict, List, Tuple

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────

WINDOW_SECONDS = 3600  # 1 hour

TIER_LIMITS: Dict[str, int] = {
    "free": 100,
    "pro": 2_000,
    "team": 10_000,
    "enterprise": 10_000,
}

DEFAULT_LIMIT = TIER_LIMITS["free"]

# Paths that are never rate-limited (prefix match)
EXEMPT_PREFIXES: List[str] = [
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/",
]

# ── In-memory fallback store ─────────────────────────────────────────────────
# Stores {identifier: [(timestamp, ...),]} – only used when Redis is down.
_mem_store: Dict[str, List[float]] = defaultdict(list)


def _is_exempt(path: str) -> bool:
    """Return True if *path* should skip rate limiting."""
    if path in ("/", "/health", "/docs", "/openapi.json", "/redoc"):
        return True
    return False


async def _extract_identifier(request: Request) -> Tuple[str, str]:
    """Use verified identity and persisted tier, never an unsigned token's claims."""
    from routes.auth import verify_token, expire_trial
    from services.database import get_user_by_id
    authorization = request.headers.get("authorization", "")
    if authorization.startswith("Bearer "):
        payload = verify_token(authorization.split(" ", 1)[1])
        if payload:
            user = await expire_trial(await get_user_by_id(int(payload["sub"])))
            if user:
                return f"user:{user['id']}", user.get("plan", "free")
    # Reverse proxies can be shared by many users; unverified credentials receive only the public quota.
    ip = request.client.host if request.client else "anonymous"
    return f"ip:{ip}", "free"


# ── Redis helpers ────────────────────────────────────────────────────────────

_redis = None


async def _get_redis():
    """Lazy-init a Redis client (reuses the same URL as the cache layer)."""
    global _redis
    if _redis is not None:
        return _redis
    redis_url = os.getenv("REDIS_URL", "")
    if not redis_url:
        return None
    try:
        import redis.asyncio as aioredis

        _redis = aioredis.from_url(redis_url, decode_responses=True, socket_connect_timeout=3)
        await _redis.ping()
        return _redis
    except Exception as exc:
        logger.warning(f"Rate-limit Redis unavailable ({exc}), using in-memory fallback")
        _redis = None
        return None


async def _redis_increment(identifier: str, window: int) -> Tuple[int, int]:
    """
    Increment the counter for *identifier* using a Redis sorted set
    sliding window.  Returns ``(current_count, reset_epoch)``.
    """
    r = await _get_redis()
    now = time.time()
    window_start = now - window
    reset_epoch = int(now) + window
    key = f"rl:{identifier}"

    if r:
        try:
            pipe = r.pipeline()
            pipe.zremrangebyscore(key, 0, window_start)
            pipe.zadd(key, {str(now): now})
            pipe.zcard(key)
            pipe.expire(key, window)
            results = await pipe.execute()
            count = results[2]
            return count, reset_epoch
        except Exception:
            pass

    # In-memory fallback
    _mem_store[identifier] = [t for t in _mem_store[identifier] if t > window_start]
    _mem_store[identifier].append(now)
    return len(_mem_store[identifier]), reset_epoch


# ── Middleware ───────────────────────────────────────────────────────────────

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding-window rate limiter enforced per user/IP and billing tier."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path

        # Skip exempt routes
        if _is_exempt(path):
            return await call_next(request)

        identifier, tier = await _extract_identifier(request)
        limit = TIER_LIMITS.get(tier, DEFAULT_LIMIT)

        count, reset_epoch = await _redis_increment(identifier, WINDOW_SECONDS)
        remaining = max(0, limit - count)

        # Build rate-limit headers
        headers = {
            "X-RateLimit-Limit": str(limit),
            "X-RateLimit-Remaining": str(remaining),
            "X-RateLimit-Reset": str(reset_epoch),
        }

        if count > limit:
            retry_after = max(1, reset_epoch - int(time.time()))
            headers["Retry-After"] = str(retry_after)
            return JSONResponse(
                status_code=429,
                content={
                    "status": "error",
                    "error": "Rate limit exceeded. Please try again later.",
                    "retry_after_seconds": retry_after,
                },
                headers=headers,
            )

        response = await call_next(request)

        # Attach rate-limit headers to every response
        for k, v in headers.items():
            response.headers[k] = v

        return response
