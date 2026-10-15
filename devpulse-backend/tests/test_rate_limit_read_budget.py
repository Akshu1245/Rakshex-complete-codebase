"""Dashboard polling (safe GETs) must not exhaust the free tier's write budget, and vice versa."""
import pytest
from httpx import AsyncClient, ASGITransport

import middleware.rate_limit as rl
from main import app
from tests.test_change_alerts_security import _user


def _client():
    return AsyncClient(transport=ASGITransport(app=app, client=("10.0.0.7", 5555)), base_url="http://t")


@pytest.mark.asyncio
async def test_reads_use_separate_bucket_and_do_not_consume_write_budget(db, monkeypatch):
    monkeypatch.setitem(rl.TIER_LIMITS, "free", 2)
    monkeypatch.setitem(rl.READ_TIER_LIMITS, "free", 50)
    async with _client() as c:
        _, h = await _user(c, "rdbudget")
        # One simulated polled hour on a tab: 40 GETs, far above the write budget of 2.
        for _ in range(40):
            assert (await c.get("/api/changes/providers", headers=h)).status_code == 200
        # Write budget is untouched by polling: the first non-GET is not rate limited.
        r = await c.post("/api/teams/workspaces", headers=h, json={"name": "after-polling"})
        assert r.status_code != 429


@pytest.mark.asyncio
async def test_read_bucket_is_still_bounded(db, monkeypatch):
    monkeypatch.setitem(rl.READ_TIER_LIMITS, "free", 3)
    async with _client() as c:
        _, h = await _user(c, "rdbound")
        codes = [(await c.get("/api/changes/providers", headers=h)).status_code for _ in range(4)]
        assert codes == [200, 200, 200, 429]
        r = await c.get("/api/changes/providers", headers=h)
        assert r.json()["scope"] == "user-read" and int(r.headers["Retry-After"]) >= 1


@pytest.mark.asyncio
async def test_writes_keep_tier_limit(db, monkeypatch):
    monkeypatch.setitem(rl.TIER_LIMITS, "free", 2)
    async with _client() as c:
        _, h = await _user(c, "wrbound")
        codes = [(await c.post("/api/teams/workspaces", headers=h, json={"name": f"w{i}"})).status_code for i in range(3)]
        assert codes[2] == 429 and all(x != 429 for x in codes[:2])


def test_read_limits_documented_and_larger_than_write():
    for plan, w in rl.TIER_LIMITS.items():
        assert rl.READ_TIER_LIMITS[plan] >= w * 5
