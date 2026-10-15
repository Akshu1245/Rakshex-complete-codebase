"""Ownership model tests: subscriptions, shared upstream events, fan-out, dedupe,
quarantine, backfill-never-guesses, schema guard, websocket/detector paths."""
import json

import pytest
import pytest_asyncio
from sqlalchemy import select, func

from models.tables import ChangeAlert, UpstreamChangeEvent
from services.db_config import AsyncSessionLocal
from services.database import (
    add_workspace_subscription_db, record_upstream_event_and_fan_out, fan_out_event_db,
    save_change_alert, backfill_legacy_alerts_to_events_db,
)
from tests.test_change_alerts_security import _user, _workspace

@pytest.fixture(autouse=True)
def _reset_ip_throttle():
    """These suites send many requests from one test IP; don't starve later suites
    of the per-IP suspicious-activity budget in middleware/security.py."""
    yield
    from middleware.security import _request_counts
    _request_counts.clear()



@pytest_asyncio.fixture
async def ws(client):
    owner, h_owner = await _user(client, "own")
    member, h_member = await _user(client, "mem")
    other, h_other = await _user(client, "oth")
    a = await _workspace(owner, [(member, "member", True)])
    b = await _workspace(other)
    c = await _workspace(other)
    return dict(a=a, b=b, c=c, h_owner=h_owner, h_member=h_member, h_other=h_other)


async def _alerts_for(event_id):
    async with AsyncSessionLocal() as s:
        return sorted((await s.execute(select(ChangeAlert.workspace_id).where(ChangeAlert.event_id == event_id))).scalars().all())


@pytest.mark.asyncio
async def test_fan_out_only_to_exact_subscribers(client, ws):
    await add_workspace_subscription_db(ws["a"], "Stripe")
    await add_workspace_subscription_db(ws["b"], "stripe-connect")   # same provider family, different API
    r = await record_upstream_event_and_fan_out("stripe", "critical", "s", "{}", "h1", "h2")
    assert await _alerts_for(r["event_id"]) == [ws["a"]]


@pytest.mark.asyncio
async def test_no_subscribers_event_stored_no_alerts(client, ws):
    r = await record_upstream_event_and_fan_out("unwatched-api", "warning", "s", "{}", "h1", "h2")
    assert r["alert_ids"] == []
    async with AsyncSessionLocal() as s:
        assert await s.get(UpstreamChangeEvent, r["event_id"]) is not None


@pytest.mark.asyncio
async def test_fan_out_is_idempotent(client, ws):
    await add_workspace_subscription_db(ws["a"], "github")
    await add_workspace_subscription_db(ws["c"], "github")
    r = await record_upstream_event_and_fan_out("github", "critical", "s", "{}", "h1", "h2")
    assert len(r["alert_ids"]) == 2
    assert await fan_out_event_db(r["event_id"]) == []
    assert await fan_out_event_db(r["event_id"]) == []
    assert await _alerts_for(r["event_id"]) == sorted([ws["a"], ws["c"]])


@pytest.mark.asyncio
async def test_unique_event_workspace_enforced_by_db(client, ws):
    from sqlalchemy.exc import IntegrityError
    r = await record_upstream_event_and_fan_out("x-api", "warning", "s", "{}", "1", "2")
    async with AsyncSessionLocal() as s:
        s.add(ChangeAlert(api_name="x-api", workspace_id=ws["a"], event_id=r["event_id"]))
        s.add(ChangeAlert(api_name="x-api", workspace_id=ws["a"], event_id=r["event_id"]))
        with pytest.raises(IntegrityError):
            await s.commit()


@pytest.mark.asyncio
async def test_fanned_out_alerts_visible_only_in_own_workspace(client, ws):
    await add_workspace_subscription_db(ws["a"], "github")
    await add_workspace_subscription_db(ws["b"], "github")
    await record_upstream_event_and_fan_out("github", "critical", "s", "{}", "h1", "h2")
    ra = (await client.get("/api/changes/alerts", headers=ws["h_member"])).json()["alerts"]
    assert {x["workspace_id"] for x in ra} == {ws["a"]}
    rb = (await client.get("/api/changes/alerts", params={"workspace_id": ws["b"]}, headers=ws["h_other"])).json()["alerts"]
    assert {x["workspace_id"] for x in rb} == {ws["b"]}


@pytest.mark.asyncio
async def test_backfill_never_assigns_workspace(client, ws):
    await add_workspace_subscription_db(ws["a"], "github")     # a subscriber exists, still must not guess
    legacy = await save_change_alert("github", "critical", "old", "{}", "o", "n")
    out = await backfill_legacy_alerts_to_events_db()
    assert out["copied_to_events"] == 1 and out["still_quarantined"] >= 1
    async with AsyncSessionLocal() as s:
        a = await s.get(ChangeAlert, legacy)
        assert a.workspace_id is None and a.event_id is not None
        ev = await s.get(UpstreamChangeEvent, a.event_id)
        assert ev.source == "legacy_backfill" and ev.legacy_alert_id == legacy
    again = await backfill_legacy_alerts_to_events_db()
    assert again["copied_to_events"] == 0
    assert (await client.get(f"/api/changes/alerts/{legacy}", headers=ws["h_owner"])).status_code == 404


# ── subscription API authz ──────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_subscription_endpoints_authz(client, ws):
    url = f"/api/changes/workspaces/{ws['a']}/subscriptions"
    assert (await client.get(url)).status_code == 401
    assert (await client.post(url, json={"api_name": "github"})).status_code == 401
    assert (await client.post(url, json={"api_name": "github"}, headers=ws["h_member"])).status_code == 403
    assert (await client.post(url, json={"api_name": "github"}, headers=ws["h_other"])).status_code == 404
    r = await client.post(url, json={"api_name": "GitHub", "source": "repo_connect"}, headers=ws["h_owner"])
    assert r.status_code == 201 and r.json()["subscription"]["api_name"] == "github"
    r2 = await client.post(url, json={"api_name": "github"}, headers=ws["h_owner"])
    assert r2.json()["subscription"]["id"] == r.json()["subscription"]["id"]  # idempotent
    lst = await client.get(url, headers=ws["h_member"])
    assert lst.status_code == 200 and lst.json()["count"] == 1
    assert (await client.get(url, headers=ws["h_other"])).status_code == 404
    assert (await client.delete(f"{url}/github", headers=ws["h_member"])).status_code == 403
    assert (await client.delete(f"{url}/github", headers=ws["h_owner"])).status_code == 200
    assert (await client.delete(f"{url}/github", headers=ws["h_owner"])).status_code == 404
    bad = await client.post(url, json={"api_name": "x", "source": "evil"}, headers=ws["h_owner"])
    assert bad.status_code == 422


@pytest.mark.asyncio
async def test_integration_register_hook_checks_role(client, ws):
    spec = {"openapi": "3.0.0", "info": {"title": "Acme Billing", "version": "1"}, "paths": {}}
    r = await client.post("/api/custom/import", json={"spec_json": spec, "workspace_id": ws["a"]}, headers=ws["h_member"])
    assert r.status_code == 403
    r = await client.post("/api/custom/import", json={"spec_json": spec, "workspace_id": ws["a"]}, headers=ws["h_other"])
    assert r.status_code == 404
    r = await client.post("/api/custom/import", json={"spec_json": spec, "workspace_id": ws["a"]}, headers=ws["h_owner"])
    assert r.status_code == 200 and r.json()["workspace_subscription"] == "acme billing"


# ── schema guard ────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_alert_endpoints_503_when_schema_not_migrated(client, ws, monkeypatch):
    import services.alert_schema_guard as g
    g._reset_for_tests()

    async def missing():
        return ["change_alerts.workspace_id"]
    monkeypatch.setattr(g, "missing_alert_schema", missing)
    for path in ("/api/changes/alerts", "/api/changes/alerts/1", f"/api/changes/workspaces/{ws['a']}/subscriptions"):
        r = await client.get(path, headers=ws["h_owner"])
        assert r.status_code == 503, path
        assert "workspace_id" not in r.text
    monkeypatch.undo()
    g._reset_for_tests()
    assert (await client.get("/api/changes/alerts", headers=ws["h_owner"])).status_code == 200


@pytest.mark.asyncio
async def test_real_schema_guard_passes_on_migrated_db(client):
    from services.alert_schema_guard import missing_alert_schema
    assert await missing_alert_schema() == []


@pytest.mark.asyncio
async def test_detector_skips_when_schema_missing(monkeypatch):
    import services.alert_schema_guard as g
    import services.change_detector as cd

    async def missing():
        return ["x"]
    monkeypatch.setattr(g, "missing_alert_schema", missing)
    called = []
    monkeypatch.setattr(cd, "_probe_api", lambda *a, **k: called.append(1))
    assert await cd._detect_changes() == []
    assert called == []


# ── websocket path carries no alert data ────────────────────────────────────
def test_websocket_health_payload_has_no_alert_data(sync_client):
    with sync_client.websocket_connect("/ws/health") as wsock:
        msg = json.loads(wsock.receive_text())
    assert msg["type"] == "health_update"
    blob = json.dumps(msg).lower()
    for k in ("alert", "workspace", "diff_json", "summary"):
        assert k not in blob
