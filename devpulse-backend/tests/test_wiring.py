"""Real database flows across auth, scan, costs, onboarding and exports."""
import pytest
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from services.db_config import AsyncSessionLocal
from models.tables import User


async def signup(client, trial=False):
    name = "flow_" + uuid.uuid4().hex[:12]
    route = "/api/onboarding/signup" if trial else "/api/auth/register"
    result = await client.post(route, json={"email": name + "@example.com", "username": name, "password": "LongPassword123!"})
    assert result.json()["status"] == "success", result.text
    data = result.json()
    return data, {"Authorization": "Bearer " + data["token"]}


@pytest.mark.asyncio
async def test_trial_signup_session_progress_and_expiry(client):
    data, headers = await signup(client, trial=True)
    assert (await client.get("/api/auth/me", headers=headers)).json()["user"]["id"] == data["user"]["id"]
    await client.post("/api/onboarding/complete", json={"step_id": "run_scan"}, headers=headers)
    # Re-read via a fresh database session: state must not depend on route module memory.
    from services.onboarding_store import get_progress
    assert await get_progress(data["user"]["id"]) == ["run_scan"]
    assert (await client.get("/api/onboarding/status", headers=headers)).json()["completed"] == ["run_scan"]
    async with AsyncSessionLocal() as session:
        user = await session.get(User, data["user"]["id"])
        user.trial_ends_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        await session.commit()
    assert (await client.get("/api/auth/me", headers=headers)).json()["user"]["plan"] == "free"


@pytest.mark.asyncio
async def test_scan_cached_evaluation_persists_for_each_account(client):
    first, a = await signup(client)
    second, b = await signup(client)
    code = 'api_key = "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890AABBCCDD"'
    for headers in (a, b):
        scan = await client.post("/api/v1/security/scan/full", headers=headers, json={"code": code})
        assert scan.status_code == 200, scan.text
        history = (await client.get("/api/v1/security/score-history", headers=headers)).json()["history"]
        assert len(history) == 1
        assert history[0]["scan_id"] == scan.json()["scan_id"]
        assert history[0]["score"] == scan.json()["score"] < 100
    assert (await client.get("/api/reports/export?report_type=security&format=csv", headers=a)).headers["content-type"].startswith("text/csv")
    export = (await client.get("/api/reports/export?report_type=security", headers=a)).json()
    assert len(export["data"]["scans"]) == 1
    assert (await client.get("/api/reports/summary")).status_code == 401


@pytest.mark.asyncio
async def test_cost_write_invalidates_read_and_isolates_users(client):
    _, a = await signup(client)
    _, b = await signup(client)
    assert (await client.get("/api/v1/costs/breakdown", headers=a)).json()["total_calls"] == 0
    for route in ("calculate", "log"):
        response = await client.post("/api/v1/costs/" + route, headers=a, json={
            "provider": "openai", "model": "gpt-4o", "tokens_input": 1000, "tokens_output": 500})
        assert response.status_code == 200, response.text
    breakdown = (await client.get("/api/v1/costs/breakdown", headers=a)).json()
    assert breakdown["total_calls"] == 2 and breakdown["total_cost_usd"] > 0
    assert (await client.get("/api/v1/costs/breakdown", headers=b)).json()["total_calls"] == 0
    budget = await client.post("/api/v1/costs/budgets", headers=a, json={"name": "OpenAI", "provider": "openai", "monthly_limit_usd": 20, "alert_threshold_pct": 80})
    assert budget.status_code == 200
    assert len((await client.get("/api/v1/costs/budgets", headers=a)).json()["budgets"]) == 1
    assert (await client.get("/api/v1/costs/budgets", headers=b)).json()["budgets"] == []


@pytest.mark.asyncio
async def test_workspace_members_boundary(client):
    _, a = await signup(client)
    _, b = await signup(client)
    created = (await client.post("/api/teams/workspaces", headers=a, json={"name": "Integration"})).json()
    workspace_id = created["id"]
    assert (await client.get(f"/api/teams/workspaces/{workspace_id}/members", headers=a)).status_code == 200
    assert (await client.get(f"/api/teams/workspaces/{workspace_id}/members", headers=b)).status_code == 403
    assert (await client.get(f"/api/teams/workspaces/{workspace_id}")).status_code == 401


@pytest.mark.asyncio
async def test_threats_cannot_be_read_or_resolved_by_other_user(client):
    _, a = await signup(client)
    _, b = await signup(client)
    created = (await client.post("/api/v1/security/threats", headers=a, json={"threat_type": "Private issue", "severity": "low"})).json()
    assert (await client.get("/api/v1/security/threat-feed", headers=b)).json()["threats"] == []
    assert (await client.post(f'/api/v1/security/threats/{created["threat_id"]}/resolve', headers=b)).status_code == 404


@pytest.mark.asyncio
async def test_analytics_events_are_account_scoped(client):
    _, a = await signup(client)
    _, b = await signup(client)
    await client.post("/api/analytics/track", headers=a, json={"endpoint": "/api/own-data"})
    assert (await client.get("/api/analytics/trends", headers=a)).json()["totals"]["total_events"] == 1
    assert (await client.get("/api/analytics/trends", headers=b)).json()["totals"]["total_events"] == 0
