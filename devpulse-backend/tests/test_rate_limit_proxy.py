"""Proxy-aware, shared-store rate limiting: users/IPs can't block each other,
forwarded headers are trusted only from configured proxies or a valid signature."""
import time

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from starlette.requests import Request

import middleware.rate_limit as rl
from main import app
from tests.test_change_alerts_security import _user, _workspace


def _req(peer, headers=None):
    scope = {"type": "http", "method": "GET", "path": "/x", "query_string": b"",
             "headers": [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()],
             "client": (peer, 1234)}
    return Request(scope)


# ── client IP resolution ────────────────────────────────────────────────────
def test_untrusted_peer_xff_ignored(monkeypatch):
    monkeypatch.setenv("TRUSTED_PROXY_CIDRS", "10.0.0.0/8")
    assert rl.resolve_client_ip(_req("203.0.113.9", {"X-Forwarded-For": "1.2.3.4"})) == "203.0.113.9"


def test_trusted_proxy_rightmost_untrusted_hop(monkeypatch):
    monkeypatch.setenv("TRUSTED_PROXY_CIDRS", "10.0.0.0/8")
    r = _req("10.0.0.5", {"X-Forwarded-For": "6.6.6.6, 198.51.100.7, 10.0.0.9"})
    assert rl.resolve_client_ip(r) == "198.51.100.7"   # spoofed leftmost 6.6.6.6 ignored


def test_no_trusted_proxies_configured_uses_peer(monkeypatch):
    monkeypatch.delenv("TRUSTED_PROXY_CIDRS", raising=False)
    assert rl.resolve_client_ip(_req("10.0.0.5", {"X-Forwarded-For": "1.2.3.4"})) == "10.0.0.5"


def test_signed_proxy_header(monkeypatch):
    monkeypatch.setenv("PROXY_SIGNING_SECRET", "s3cret-test-only")
    ts = int(time.time())
    good = rl.sign_client_ip("s3cret-test-only", "198.51.100.20", ts)
    h = {"X-RaksHex-Client-IP": "198.51.100.20", "X-RaksHex-Client-Ts": str(ts), "X-RaksHex-Client-Sig": good}
    assert rl.resolve_client_ip(_req("127.0.0.1", h)) == "198.51.100.20"
    assert rl.resolve_client_ip(_req("127.0.0.1", {**h, "X-RaksHex-Client-Sig": "0" * 64})) == "127.0.0.1"
    assert rl.resolve_client_ip(_req("127.0.0.1", {**h, "X-RaksHex-Client-IP": "198.51.100.21"})) == "127.0.0.1"
    old = ts - 120
    stale = {"X-RaksHex-Client-IP": "198.51.100.20", "X-RaksHex-Client-Ts": str(old),
             "X-RaksHex-Client-Sig": rl.sign_client_ip("s3cret-test-only", "198.51.100.20", old)}
    assert rl.resolve_client_ip(_req("127.0.0.1", stale)) == "127.0.0.1"


def test_signed_header_ignored_without_secret(monkeypatch):
    monkeypatch.delenv("PROXY_SIGNING_SECRET", raising=False)
    h = {"X-RaksHex-Client-IP": "1.2.3.4", "X-RaksHex-Client-Ts": str(int(time.time())), "X-RaksHex-Client-Sig": "x"}
    assert rl.resolve_client_ip(_req("127.0.0.1", h)) == "127.0.0.1"


# ── behaviour through the app (DB-backed shared store) ──────────────────────
def _client(peer="10.0.0.5"):
    return AsyncClient(transport=ASGITransport(app=app, client=(peer, 5555)), base_url="http://t")


@pytest_asyncio.fixture
async def proxied(db):
    async with _client() as c:
        yield c


@pytest.mark.asyncio
async def test_one_user_cannot_block_another_behind_same_proxy(proxied, monkeypatch):
    monkeypatch.setitem(rl.TIER_LIMITS, "free", 3)
    _, ha = await _user(proxied, "rla")
    _, hb = await _user(proxied, "rlb")
    codes = [(await proxied.get("/api/changes/providers", headers=ha)).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]
    r = await proxied.get("/api/changes/providers", headers=hb)
    assert r.status_code == 200
    assert (await proxied.get("/api/changes/providers", headers=ha)).json()["scope"] == "user"


@pytest.mark.asyncio
async def test_anon_clients_behind_trusted_proxy_limited_separately(proxied, monkeypatch):
    monkeypatch.setenv("TRUSTED_PROXY_CIDRS", "10.0.0.0/8")
    monkeypatch.setenv("RL_ANON_PER_MIN", "2")
    x = {"X-Forwarded-For": "198.51.100.1"}
    y = {"X-Forwarded-For": "198.51.100.2"}
    assert [(await proxied.get("/api/changes/providers", headers=x)).status_code for _ in range(3)] == [200, 200, 429]
    assert (await proxied.get("/api/changes/providers", headers=y)).status_code == 200


@pytest.mark.asyncio
async def test_spoofed_xff_from_untrusted_peer_cannot_evade(db, monkeypatch):
    monkeypatch.setenv("TRUSTED_PROXY_CIDRS", "10.0.0.0/8")
    monkeypatch.setenv("RL_ANON_PER_MIN", "2")
    async with _client("203.0.113.50") as c:
        codes = [(await c.get("/api/changes/providers", headers={"X-Forwarded-For": f"198.51.100.{i}"})).status_code
                 for i in range(3)]
    assert codes == [200, 200, 429]


@pytest.mark.asyncio
async def test_authenticated_user_not_blocked_by_exhausted_ip(proxied, monkeypatch):
    monkeypatch.setenv("RL_ANON_PER_MIN", "1")
    _, h = await _user(proxied, "rlc")
    await proxied.get("/api/changes/providers")
    assert (await proxied.get("/api/changes/providers")).status_code == 429
    assert (await proxied.get("/api/changes/providers", headers=h)).status_code == 200


@pytest.mark.asyncio
async def test_workspace_limit_only_charged_to_members(proxied, monkeypatch):
    monkeypatch.setenv("RL_WORKSPACE_PER_HOUR", "3")
    owner, h_owner = await _user(proxied, "wso")
    member, h_member = await _user(proxied, "wsm")
    _, h_out = await _user(proxied, "wsx")
    ws = await _workspace(owner, [(member, "member", True)])
    url = f"/api/changes/alerts?workspace_id={ws}"
    for _ in range(10):  # outsider hammering the workspace does not consume its budget
        assert (await proxied.get(url, headers=h_out)).status_code == 404
    assert (await proxied.get(url, headers=h_owner)).status_code == 200
    assert (await proxied.get(url, headers=h_member)).status_code == 200
    assert (await proxied.get(url, headers=h_owner)).status_code == 200
    r = await proxied.get(url, headers=h_member)
    assert r.status_code == 429 and r.json()["scope"] == "workspace"


@pytest.mark.asyncio
async def test_counter_store_shared_between_app_instances(db):
    """Two independent app instances (separate middleware objects) share one DB store."""
    from fastapi import FastAPI
    def make():
        a = FastAPI()
        a.add_middleware(rl.RateLimitMiddleware)

        @a.get("/ping")
        async def ping():
            return {"ok": True}
        return a
    import os
    os.environ["RL_ANON_PER_MIN"] = "2"
    try:
        i1, i2 = make(), make()
        async with AsyncClient(transport=ASGITransport(app=i1, client=("198.51.100.77", 1)), base_url="http://a") as c1, \
                   AsyncClient(transport=ASGITransport(app=i2, client=("198.51.100.77", 1)), base_url="http://b") as c2:
            assert (await c1.get("/ping")).status_code == 200
            assert (await c2.get("/ping")).status_code == 200
            assert (await c1.get("/ping")).status_code == 429
            assert (await c2.get("/ping")).status_code == 429
    finally:
        del os.environ["RL_ANON_PER_MIN"]


@pytest.mark.asyncio
async def test_cleanup_expired_counters(db):
    from services.db_config import AsyncSessionLocal
    from models.tables import RateLimitCounter
    async with AsyncSessionLocal() as s:
        s.add(RateLimitCounter(key="old", window_start=1, count=5, expires_at=2))
        await s.commit()
    assert await rl.cleanup_expired() >= 1
