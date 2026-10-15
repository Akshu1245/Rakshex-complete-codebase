"""Ownership model tests: subscriptions, shared upstream events, fan-out, dedupe,
quarantine, backfill-never-guesses, schema guard, websocket/detector paths."""
import json

import pytest
import pytest_asyncio
from sqlalchemy import select, func, and_

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
    await add_workspace_subscription_db(ws["a"], "github")
    await add_workspace_subscription_db(ws["b"], "slack")
    r = await record_upstream_event_and_fan_out("GitHub", "critical", "s", "{}", "h1", "h2")
    assert await _alerts_for(r["event_id"]) == [ws["a"]]
    # unknown/near-miss source names never fan out (no fuzzy matching)
    for name in ("github", "GitHub Enterprise", "Stripe"):
        r2 = await record_upstream_event_and_fan_out(name, "critical", "s", "{}", "x", name)
        assert r2["alert_ids"] == []


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
    r = await record_upstream_event_and_fan_out("GitHub", "critical", "s", "{}", "h1", "h2")
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
    await record_upstream_event_and_fan_out("GitHub", "critical", "s", "{}", "h1", "h2")
    ra = (await client.get("/api/changes/alerts", headers=ws["h_member"])).json()["alerts"]
    assert {x["workspace_id"] for x in ra} == {ws["a"]}
    rb = (await client.get("/api/changes/alerts", params={"workspace_id": ws["b"]}, headers=ws["h_other"])).json()["alerts"]
    assert {x["workspace_id"] for x in rb} == {ws["b"]}


@pytest.mark.asyncio
async def test_backfill_never_assigns_workspace(client, ws):
    await add_workspace_subscription_db(ws["a"], "github")     # a subscriber exists, still must not guess
    legacy = await save_change_alert("GitHub", "critical", "old", "{}", "o", "n")
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
    assert (await client.post(url, json={"provider_id": "github"})).status_code == 401
    assert (await client.post(url, json={"provider_id": "github"}, headers=ws["h_member"])).status_code == 403
    assert (await client.post(url, json={"provider_id": "github"}, headers=ws["h_other"])).status_code == 404
    r = await client.post(url, json={"provider_id": "github", "source": "repo_connect"}, headers=ws["h_owner"])
    assert r.status_code == 201 and r.json()["subscription"]["api_name"] == "github"
    r2 = await client.post(url, json={"provider_id": "github"}, headers=ws["h_owner"])
    assert r2.json()["subscription"]["id"] == r.json()["subscription"]["id"]  # idempotent
    lst = await client.get(url, headers=ws["h_member"])
    assert lst.status_code == 200 and lst.json()["count"] == 1
    assert (await client.get(url, headers=ws["h_other"])).status_code == 404
    assert (await client.delete(f"{url}/github", headers=ws["h_member"])).status_code == 403
    assert (await client.delete(f"{url}/github", headers=ws["h_owner"])).status_code == 200
    assert (await client.delete(f"{url}/github", headers=ws["h_owner"])).status_code == 404
    bad = await client.post(url, json={"provider_id": "github", "source": "evil"}, headers=ws["h_owner"])
    assert bad.status_code == 422


@pytest.mark.asyncio
async def test_subscribe_rejects_unsupported_and_unknown(client, ws):
    url = f"/api/changes/workspaces/{ws['a']}/subscriptions"
    r = await client.post(url, json={"provider_id": "stripe"}, headers=ws["h_owner"])
    assert r.status_code == 422 and "not supported" in r.json()["detail"].lower()
    r = await client.post(url, json={"provider_id": "GitHub"}, headers=ws["h_owner"])   # not canonical id
    assert r.status_code == 422
    r = await client.post(url, json={"provider_id": "acme-billing"}, headers=ws["h_owner"])
    assert r.status_code == 422
    with pytest.raises(ValueError):
        await add_workspace_subscription_db(ws["a"], "stripe")


@pytest.mark.asyncio
async def test_providers_catalog_is_honest(client):
    r = await client.get("/api/changes/providers")
    assert r.status_code == 200
    sup = {p["id"]: p for p in r.json()["supported"]}
    uns = {p["id"]: p for p in r.json()["unsupported"]}
    assert "stripe" not in sup and uns["stripe"]["coverage"] == "NOT_SUPPORTED"
    from services.change_detector import MONITORED_APIS
    assert {p["detector_name"] for p in sup.values()} == {a["name"] for a in MONITORED_APIS}
    assert all(p["coverage"] == "SUPPORTED" for p in sup.values())


@pytest.mark.asyncio
async def test_imported_openapi_title_is_not_a_provider_subscription(client, ws):
    spec = {"openapi": "3.0.0", "info": {"title": "GitHub", "version": "1"}, "paths": {}}
    r = await client.post("/api/custom/import", json={"spec_json": spec}, headers=ws["h_owner"])
    assert r.status_code == 200
    lst = await client.get(f"/api/changes/workspaces/{ws['a']}/subscriptions", headers=ws["h_owner"])
    assert lst.json()["count"] == 0


@pytest.mark.asyncio
async def test_subscription_then_detector_run_shows_real_alert(client, ws, monkeypatch):
    """End-to-end through the real detector code: subscribe -> two probe runs with a schema
    change (upstream response simulated) -> alert visible only to the subscribed workspace."""
    import services.change_detector as cd
    import services.alert_schema_guard as g
    g._reset_for_tests()
    url = f"/api/changes/workspaces/{ws['a']}/subscriptions"
    assert (await client.post(url, json={"provider_id": "github"}, headers=ws["h_owner"])).status_code == 201
    payloads = iter([{"current_user_url": "x", "rate": 1}, {"current_user_url": "x"}])

    async def probe(client_, api):
        if api["name"] != "GitHub":
            return None
        data = next(payloads)
        schema = cd._extract_schema(data)
        return {"api_name": "GitHub", "schema": schema, "schema_hash": cd._compute_hash(schema),
                "status_code": 200, "response_keys": list(data), "field_count": len(schema),
                "timestamp": "2026-10-15T00:00:00+00:00"}
    monkeypatch.setattr(cd, "_probe_api", probe)
    assert await cd._detect_changes() == []          # baseline snapshot, no change yet
    new = await cd._detect_changes()                 # 'rate' removed -> change
    assert len(new) == 1 and new[0]["severity"] == "critical"
    a = (await client.get("/api/changes/alerts", headers=ws["h_member"])).json()["alerts"]
    assert len(a) == 1 and a[0]["api_name"] == "GitHub" and a[0]["workspace_id"] == ws["a"]
    assert (await client.get("/api/changes/alerts", headers=ws["h_other"])).json()["alerts"] == []


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


# ── role validation ─────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_db_rejects_invalid_role(client):
    from sqlalchemy.exc import IntegrityError
    from models.tables import Team, TeamMember
    owner, _ = await _user(client, "rolechk")
    async with AsyncSessionLocal() as s:
        s.add(Team(id="ws_rolechk", name="r", owner_id=owner))
        await s.flush()
        s.add(TeamMember(team_id="ws_rolechk", user_id=owner, role="superadmin", accepted=True))
        with pytest.raises(IntegrityError):
            await s.commit()


@pytest.mark.asyncio
async def test_api_rejects_invalid_role(client):
    owner, h = await _user(client, "rolapi")
    other, _ = await _user(client, "rolapi2")
    ws = await _workspace(owner)
    r = await client.post(f"/api/teams/workspaces/{ws}/invite", json={"user_id": other, "role": "superadmin"}, headers=h)
    assert r.status_code == 422
    r = await client.put(f"/api/teams/workspaces/{ws}/members/{other}/role", json={"role": "god"}, headers=h)
    assert r.status_code == 422


# ── security review: concurrency + subscription audit ─────────────────────────
@pytest.mark.asyncio
async def test_concurrent_subscribe_is_idempotent_and_audited(db):
    import asyncio
    from sqlalchemy import select, func
    from services.db_config import AsyncSessionLocal
    from models.tables import WorkspaceApiSubscription, ChangeAlertAudit
    from services.database import add_workspace_subscription_db, delete_workspace_subscription_db
    res = await asyncio.gather(*[add_workspace_subscription_db("wsC", "github", "manual", 7) for _ in range(6)],
                               return_exceptions=True)
    assert not [r for r in res if isinstance(r, Exception)], res
    async with AsyncSessionLocal() as s:
        n = (await s.execute(select(func.count()).select_from(WorkspaceApiSubscription).where(
            WorkspaceApiSubscription.workspace_id == "wsC"))).scalar_one()
    assert n == 1
    assert await delete_workspace_subscription_db("wsC", "github", 7)
    async with AsyncSessionLocal() as s:
        acts = (await s.execute(select(ChangeAlertAudit.action).where(and_(
            ChangeAlertAudit.workspace_id == "wsC", ChangeAlertAudit.alert_id == 0)).order_by(ChangeAlertAudit.id))).scalars().all()
    assert acts[0] == "sub:github" and acts[-1] == "unsub:github" and acts.count("sub:github") >= 1


@pytest.mark.asyncio
async def test_concurrent_fan_out_never_duplicates(db):
    import asyncio
    from services.database import add_workspace_subscription_db, record_upstream_event_and_fan_out, fan_out_event_db
    for ws in ("wsD1", "wsD2", "wsD3"):
        await add_workspace_subscription_db(ws, "slack", "manual", None)
    fan = await record_upstream_event_and_fan_out("Slack", "warning", "s", "{}", "a", "b")
    assert len(fan["alert_ids"]) == 3
    again = await asyncio.gather(*[fan_out_event_db(fan["event_id"]) for _ in range(5)])
    assert all(r == [] for r in again)
