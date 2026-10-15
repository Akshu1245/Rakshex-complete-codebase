"""
Proxy-aware, shared-store rate limiting.

Buckets (fixed windows, counted in a store shared by every backend instance):
  - Authenticated (verified JWT):  user:<id>  per hour by plan tier (TIER_LIMITS)
                                   ws:<id>    per hour (RL_WORKSPACE_PER_HOUR) when the request
                                              targets a workspace the user is an ACCEPTED member of.
                                              Non-members never consume a workspace's budget.
    Authenticated users are NOT limited by IP, so users behind one proxy can't block each other.
  - Unauthenticated:               ip:<client> per minute (RL_ANON_PER_MIN) and per hour (free tier).

Client IP resolution (never trusts arbitrary client headers):
  1. Signed proxy header: if PROXY_SIGNING_SECRET is set and the request carries
     X-RaksHex-Client-IP / X-RaksHex-Client-Ts / X-RaksHex-Client-Sig with
     sig = hex(HMAC-SHA256(secret, f"{ip}.{ts}")) and |now-ts| <= 60s -> that IP.
  2. Else, if the TCP peer is inside TRUSTED_PROXY_CIDRS -> walk X-Forwarded-For right-to-left,
     skipping trusted hops; the first untrusted address is the client.
  3. Else the TCP peer address. X-Forwarded-For from untrusted peers is ignored.

Store: Redis if REDIS_URL works; otherwise the SQL database (rate_limit_counters, works on the
existing PostgreSQL; no new paid service). If the store errors, the limiter fails OPEN for that
request (logged) rather than taking the API down.
"""
from __future__ import annotations

import hashlib
import hmac
import ipaddress
import logging
import os
import random
import re
import time
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

WINDOW_SECONDS = 3600  # 1 hour (per-user / per-workspace / anon hourly)

TIER_LIMITS: Dict[str, int] = {"free": 100, "pro": 2_000, "team": 10_000, "enterprise": 10_000}
# Safe reads (GET/HEAD) have their own, larger hourly bucket so dashboard polling cannot exhaust the
# write/expensive-operation budget above. Measured: one open dashboard tab polls ~120-180 budgeted
# GETs/hour (60s intervals, several widgets); free=1000 covers ~5 tabs/hour while still bounding scraping.
READ_TIER_LIMITS: Dict[str, int] = {"free": 1_000, "pro": 20_000, "team": 50_000, "enterprise": 50_000}
DEFAULT_LIMIT = TIER_LIMITS["free"]

EXEMPT_PREFIXES: List[str] = ["/health", "/docs", "/openapi.json", "/redoc", "/"]

# Legacy name kept for backwards compatibility with existing tests (no longer the primary store).
_mem_store: Dict[str, List[float]] = defaultdict(list)


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _is_exempt(path: str) -> bool:
    return path in ("/", "/health", "/docs", "/openapi.json", "/redoc")


# ── Client IP resolution ─────────────────────────────────────────────────────

def _trusted_networks() -> List[ipaddress._BaseNetwork]:
    nets = []
    for part in os.getenv("TRUSTED_PROXY_CIDRS", "").split(","):
        part = part.strip()
        if part:
            try:
                nets.append(ipaddress.ip_network(part, strict=False))
            except ValueError:
                logger.warning(f"Ignoring invalid TRUSTED_PROXY_CIDRS entry: {part!r}")
    return nets


def _in(ip: str, nets) -> bool:
    try:
        a = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return any(a in n for n in nets)


def sign_client_ip(secret: str, ip: str, ts: int) -> str:
    return hmac.new(secret.encode(), f"{ip}.{ts}".encode(), hashlib.sha256).hexdigest()


def resolve_client_ip(request: Request) -> str:
    peer = request.client.host if request.client else "unknown"
    secret = os.getenv("PROXY_SIGNING_SECRET", "")
    h = request.headers
    if secret and h.get("x-rakshex-client-ip") and h.get("x-rakshex-client-sig") and h.get("x-rakshex-client-ts"):
        ip, sig = h["x-rakshex-client-ip"].strip(), h["x-rakshex-client-sig"].strip()
        try:
            ts = int(h["x-rakshex-client-ts"])
            ipaddress.ip_address(ip)
        except ValueError:
            return peer
        if abs(time.time() - ts) <= 60 and hmac.compare_digest(sig, sign_client_ip(secret, ip, ts)):
            return ip
        return peer
    nets = _trusted_networks()
    if nets and _in(peer, nets):
        hops = [x.strip() for x in h.get("x-forwarded-for", "").split(",") if x.strip()]
        for hop in reversed(hops):
            try:
                ipaddress.ip_address(hop)
            except ValueError:
                break
            if not _in(hop, nets):
                return hop
    return peer


# ── Shared counter store ─────────────────────────────────────────────────────

_redis = None
_redis_checked = False


async def _get_redis():
    global _redis, _redis_checked
    if _redis is not None or _redis_checked:
        return _redis
    _redis_checked = True
    url = os.getenv("REDIS_URL", "")
    if not url:
        return None
    try:
        import redis.asyncio as aioredis
        _redis = aioredis.from_url(url, decode_responses=True, socket_connect_timeout=3)
        await _redis.ping()
        return _redis
    except Exception as exc:
        logger.warning(f"Rate-limit Redis unavailable ({exc}); using SQL store")
        _redis = None
        return None


async def _db_increment(key: str, window_start: int, expires_at: int) -> int:
    from sqlalchemy import update, select
    from services.db_config import AsyncSessionLocal, engine
    from models.tables import RateLimitCounter
    dialect = engine.dialect.name
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    stmt = insert(RateLimitCounter).values(key=key, window_start=window_start, count=1, expires_at=expires_at)
    stmt = stmt.on_conflict_do_update(
        index_elements=["key", "window_start"],
        set_={"count": RateLimitCounter.count + 1},
    ).returning(RateLimitCounter.count)
    async with AsyncSessionLocal() as session:
        count = (await session.execute(stmt)).scalar_one()
        await session.commit()
        return int(count)


async def increment(key: str, window: int) -> Tuple[int, int]:
    """Atomically increment the fixed-window counter for key. Returns (count, reset_epoch)."""
    now = int(time.time())
    window_start = now - (now % window)
    reset = window_start + window
    r = await _get_redis()
    if r:
        try:
            k = f"rl:{key}:{window_start}"
            pipe = r.pipeline()
            pipe.incr(k)
            pipe.expire(k, window + 5)
            count = (await pipe.execute())[0]
            return int(count), reset
        except Exception as exc:
            logger.warning(f"Rate-limit Redis error ({exc}); falling back to SQL store")
    if random.random() < 0.01:  # opportunistic cleanup keeps the table small without a cron
        try:
            await cleanup_expired()
        except Exception:
            pass
    return await _db_increment(key, window_start, reset + window), reset


async def cleanup_expired() -> int:
    """Delete expired counter rows (call periodically)."""
    from sqlalchemy import delete
    from services.db_config import AsyncSessionLocal
    from models.tables import RateLimitCounter
    async with AsyncSessionLocal() as session:
        res = await session.execute(delete(RateLimitCounter).where(RateLimitCounter.expires_at < int(time.time())))
        await session.commit()
        return res.rowcount or 0


# ── Identity / workspace context ────────────────────────────────────────────

_WS_PATH = re.compile(r"/workspaces/([^/]+)")


async def _authenticated_user(request: Request) -> Optional[dict]:
    from routes.auth import verify_token, expire_trial
    from services.database import get_user_by_id
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        return None
    payload = verify_token(auth.split(" ", 1)[1])
    if not payload:
        return None
    try:
        return await expire_trial(await get_user_by_id(int(payload["sub"])))
    except Exception:
        return None


def _target_workspace(request: Request) -> Optional[str]:
    ws = request.query_params.get("workspace_id")
    if ws:
        return ws
    m = _WS_PATH.search(request.url.path)
    return m.group(1) if m else None


async def _is_member(user_id: int, workspace_id: str) -> bool:
    from services.database import get_user_teams
    try:
        return any(t["id"] == workspace_id for t in await get_user_teams(user_id))
    except Exception:
        return False


# Backwards-compatible helper used by older code/tests.
async def _extract_identifier(request: Request) -> Tuple[str, str]:
    user = await _authenticated_user(request)
    if user:
        return f"user:{user['id']}", user.get("plan", "free")
    return f"ip:{resolve_client_ip(request)}", "free"


# ── Store-failure policy ────────────────────────────────────────────────────
# If the shared store (Redis and the SQL fallback) is unreachable:
#  * state-changing requests (POST/PUT/PATCH/DELETE: login/register, ack/resolve, custom-API import, subscription
#    writes, ...) FAIL CLOSED with 503 so brute force / write floods cannot ride a store outage;
#  * read requests (GET/HEAD) continue with a process-local fixed-window counter using the same limits
#    (per instance, so the effective limit is limit x instances during the outage).
SAFE_METHODS = {"GET", "HEAD"}
_local_counts: Dict[Tuple[str, int], int] = {}


class StoreUnavailable(Exception):
    pass


def _local_increment(key: str, window: int) -> Tuple[int, int]:
    now = int(time.time())
    ws = now - (now % window)
    if len(_local_counts) > 50_000:  # bound memory during long outages
        for k in [k for k in _local_counts if k[1] + window < now]:
            _local_counts.pop(k, None)
        if len(_local_counts) > 50_000:
            _local_counts.clear()
    _local_counts[(key, ws)] = _local_counts.get((key, ws), 0) + 1
    return _local_counts[(key, ws)], ws + window


async def _count(key: str, window: int, method: str) -> Tuple[int, int]:
    try:
        return await increment(key, window)
    except Exception as exc:
        if method.upper() in SAFE_METHODS:
            logger.error(f"Rate-limit store down ({exc}); local fallback for read {key.split(':')[0]}")
            return _local_increment(key, window)
        logger.error(f"Rate-limit store down ({exc}); failing closed for {method}")
        raise StoreUnavailable() from exc


def _too_many(limit: int, reset: int, scope: str) -> JSONResponse:
    retry = max(1, reset - int(time.time()))
    return JSONResponse(
        status_code=429,
        content={"status": "error", "error": "Rate limit exceeded. Please try again later.",
                 "scope": scope, "retry_after_seconds": retry},
        headers={"Retry-After": str(retry), "X-RateLimit-Limit": str(limit),
                 "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": str(reset)},
    )


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if _is_exempt(request.url.path) or request.method == "OPTIONS":
            return await call_next(request)
        m = request.method
        try:
            user = await _authenticated_user(request)
            if user:
                plan = user.get("plan", "free")
                if m.upper() in SAFE_METHODS:
                    limit = _env_int(f"RL_READ_PER_HOUR_{plan.upper()}", READ_TIER_LIMITS.get(plan, READ_TIER_LIMITS["free"]))
                    count, reset = await _count(f"user-read:{user['id']}", WINDOW_SECONDS, m)
                    if count > limit:
                        return _too_many(limit, reset, "user-read")
                else:
                    limit = TIER_LIMITS.get(plan, DEFAULT_LIMIT)
                    count, reset = await _count(f"user:{user['id']}", WINDOW_SECONDS, m)
                    if count > limit:
                        return _too_many(limit, reset, "user")
                ws = _target_workspace(request)
                if ws and await _is_member(user["id"], ws):
                    ws_limit = _env_int("RL_WORKSPACE_PER_HOUR", 5000)
                    wcount, wreset = await _count(f"ws:{ws}", WINDOW_SECONDS, m)
                    if wcount > ws_limit:
                        return _too_many(ws_limit, wreset, "workspace")
            else:
                ip = resolve_client_ip(request)
                per_min = _env_int("RL_ANON_PER_MIN", 60)
                mcount, mreset = await _count(f"ipm:{ip}", 60, m)
                if mcount > per_min:
                    return _too_many(per_min, mreset, "ip")
                limit = _env_int("RL_ANON_PER_HOUR", TIER_LIMITS["free"])
                count, reset = await _count(f"ip:{ip}", WINDOW_SECONDS, m)
                if count > limit:
                    return _too_many(limit, reset, "ip")
        except StoreUnavailable:
            return JSONResponse(status_code=503, headers={"Retry-After": "30"},
                                content={"status": "error", "error": "Temporarily unavailable, please retry."})

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, limit - count))
        response.headers["X-RateLimit-Reset"] = str(reset)
        return response
