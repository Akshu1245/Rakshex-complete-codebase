"""Regression tests: change-alert list (severity filter bug) and ack authorization.
Runs only against an in-process app with SQLite (conftest). No network."""
import pytest
from services.database import save_change_alert


async def _seed():
    a = await save_change_alert("stripe", "critical", "field removed", "{}", "h1", "h2")
    b = await save_change_alert("openai", "warning", "field added", "{}", "h3", "h4")
    return a, b


@pytest.mark.asyncio
async def test_list_alerts_returns_success(client):
    await _seed()
    r = await client.get("/api/changes/alerts")
    body = r.json()
    assert body["status"] == "success", body
    assert body["count"] == 2


@pytest.mark.asyncio
async def test_list_alerts_severity_filter(client):
    await _seed()
    body = (await client.get("/api/changes/alerts", params={"severity": "critical"})).json()
    assert body["status"] == "success", body
    assert [a["severity"] for a in body["alerts"]] == ["critical"]


@pytest.mark.asyncio
async def test_ack_requires_authentication(client):
    a, _ = await _seed()
    r = await client.post(f"/api/changes/alerts/{a}/ack")
    assert r.status_code == 401, r.text
    body = (await client.get("/api/changes/alerts")).json()
    assert all(not x["acknowledged"] for x in body["alerts"])


@pytest.mark.asyncio
async def test_ack_with_valid_auth(client, auth_headers):
    a, _ = await _seed()
    r = await client.post(f"/api/changes/alerts/{a}/ack", headers=auth_headers)
    assert r.status_code == 200 and r.json()["status"] == "success", r.text


@pytest.mark.asyncio
async def test_ack_with_garbage_token_rejected(client):
    a, _ = await _seed()
    r = await client.post(f"/api/changes/alerts/{a}/ack", headers={"Authorization": "Bearer nope"})
    assert r.status_code == 401
