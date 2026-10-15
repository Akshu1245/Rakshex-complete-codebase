"""Regression tests for change-alert authn, authz, workspace isolation, roles,
error codes and audit. In-process app + SQLite only (see conftest). No network."""
import time
import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select

from services.database import save_change_alert, get_change_alert_audit_db
from services.db_config import AsyncSessionLocal
from models.tables import Team, TeamMember, ChangeAlert


async def _user(client, tag):
    """Create a user directly (avoids register rate limits) and mint a real JWT."""
    from services.database import create_user
    from routes.auth import create_token
    u = f"{tag}_{uuid.uuid4().hex[:8]}"
    uid = await create_user(f"{u}@devpulse.test", u, "not-a-real-hash")
    return uid, {"Authorization": f"Bearer {create_token(uid, f'{u}@devpulse.test')}"}


async def _workspace(owner_id, members=()):
    ws = f"ws_{uuid.uuid4().hex[:10]}"
    async with AsyncSessionLocal() as s:
        s.add(Team(id=ws, name=ws, owner_id=owner_id))
        s.add(TeamMember(team_id=ws, user_id=owner_id, role="owner", accepted=True))
        for uid, role, accepted in members:
            s.add(TeamMember(team_id=ws, user_id=uid, role=role, accepted=accepted))
        await s.commit()
    return ws


async def _alert(ws, severity="critical", api="stripe"):
    return await save_change_alert(api, severity, "synthetic change", "{}", "h1", "h2", workspace_id=ws)


@pytest_asyncio.fixture
async def world(client):
    owner, h_owner = await _user(client, "owner")
    admin, h_admin = await _user(client, "admin")
    member, h_member = await _user(client, "member")
    viewer, h_viewer = await _user(client, "viewer")
    pending, h_pending = await _user(client, "pending")
    outsider, h_out = await _user(client, "outsider")
    ws_a = await _workspace(owner, [(admin, "admin", True), (member, "member", True),
                                    (viewer, "viewer", True), (pending, "admin", False)])
    ws_b = await _workspace(outsider)
    a1 = await _alert(ws_a, "critical")
    a2 = await _alert(ws_a, "warning", "openai")
    b1 = await _alert(ws_b)
    orphan = await save_change_alert("github", "critical", "pre-migration", "{}", "x", "y")  # workspace NULL
    return dict(ws_a=ws_a, ws_b=ws_b, a1=a1, a2=a2, b1=b1, orphan=orphan, owner=owner, admin=admin,
                h_owner=h_owner, h_admin=h_admin, h_member=h_member, h_viewer=h_viewer,
                h_pending=h_pending, h_out=h_out)


# ── Authentication ──────────────────────────────────────────────────────────
@pytest.mark.asyncio
@pytest.mark.parametrize("method,path", [
    ("get", "/api/changes/alerts"), ("get", "/api/changes/alerts/1"),
    ("post", "/api/changes/alerts/1/ack"), ("post", "/api/changes/alerts/1/resolve")])
async def test_unauthenticated_401(client, world, method, path):
    r = await getattr(client, method)(path)
    assert r.status_code == 401
    r = await getattr(client, method)(path, headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_unauthenticated_ack_does_not_change_state(client, world):
    await client.post(f"/api/changes/alerts/{world['a1']}/ack")
    async with AsyncSessionLocal() as s:
        assert (await s.get(ChangeAlert, world["a1"])).acknowledged in (False, None)


# ── Listing / isolation ─────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_member_lists_only_own_workspace(client, world):
    r = await client.get("/api/changes/alerts", headers=world["h_viewer"])
    assert r.status_code == 200
    ids = {a["id"] for a in r.json()["alerts"]}
    assert ids == {world["a1"], world["a2"]}  # not b1, not orphan


@pytest.mark.asyncio
async def test_severity_filter(client, world):
    r = await client.get("/api/changes/alerts", params={"severity": "critical"}, headers=world["h_member"])
    assert r.status_code == 200 and [a["id"] for a in r.json()["alerts"]] == [world["a1"]]


@pytest.mark.asyncio
async def test_outsider_sees_nothing_from_other_workspace(client, world):
    r = await client.get("/api/changes/alerts", headers=world["h_out"])
    assert {a["id"] for a in r.json()["alerts"]} == {world["b1"]}
    r = await client.get("/api/changes/alerts", params={"workspace_id": world["ws_a"]}, headers=world["h_out"])
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_pending_invite_has_no_access(client, world):
    r = await client.get("/api/changes/alerts", headers=world["h_pending"])
    assert r.json()["alerts"] == []
    r = await client.post(f"/api/changes/alerts/{world['a1']}/ack", headers=world["h_pending"])
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_cross_workspace_404_indistinguishable_from_missing(client, world):
    cross = await client.get(f"/api/changes/alerts/{world['a1']}", headers=world["h_out"])
    missing = await client.get("/api/changes/alerts/999999", headers=world["h_out"])
    assert cross.status_code == missing.status_code == 404
    assert cross.json() == missing.json()
    cross_ack = await client.post(f"/api/changes/alerts/{world['a1']}/ack", headers=world["h_out"])
    missing_ack = await client.post("/api/changes/alerts/999999/ack", headers=world["h_out"])
    assert cross_ack.status_code == missing_ack.status_code == 404
    assert cross_ack.json() == missing_ack.json()


@pytest.mark.asyncio
async def test_orphan_alert_inaccessible_even_to_owners(client, world):
    for h in (world["h_owner"], world["h_out"]):
        assert (await client.get(f"/api/changes/alerts/{world['orphan']}", headers=h)).status_code == 404
        assert (await client.post(f"/api/changes/alerts/{world['orphan']}/ack", headers=h)).status_code == 404


@pytest.mark.asyncio
async def test_member_can_view_single_alert(client, world):
    r = await client.get(f"/api/changes/alerts/{world['a1']}", headers=world["h_viewer"])
    assert r.status_code == 200 and r.json()["alert"]["id"] == world["a1"]


# ── Roles ───────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
@pytest.mark.parametrize("who", ["h_member", "h_viewer"])
@pytest.mark.parametrize("action", ["ack", "resolve"])
async def test_non_admin_roles_get_403(client, world, who, action):
    r = await client.post(f"/api/changes/alerts/{world['a1']}/{action}", headers=world[who])
    assert r.status_code == 403
    assert await get_change_alert_audit_db(world["a1"]) == []


@pytest.mark.asyncio
@pytest.mark.parametrize("who,uid", [("h_owner", "owner"), ("h_admin", "admin")])
async def test_owner_admin_can_ack_and_audit_written(client, world, who, uid):
    before = time.time()
    r = await client.post(f"/api/changes/alerts/{world['a1']}/ack", headers=world[who])
    assert r.status_code == 200 and r.json()["status"] == "success"
    audit = await get_change_alert_audit_db(world["a1"])
    assert len(audit) == 1
    row = audit[0]
    assert row["actor_user_id"] == world[uid]
    assert row["workspace_id"] == world["ws_a"]
    assert row["alert_id"] == world["a1"]
    assert row["action"] == "ack"
    assert row["created_at"] is not None
    async with AsyncSessionLocal() as s:
        a = await s.get(ChangeAlert, world["a1"])
        assert a.acknowledged is True and a.acknowledged_by == world[uid] and a.acknowledged_at is not None


@pytest.mark.asyncio
async def test_resolve_writes_audit(client, world):
    r = await client.post(f"/api/changes/alerts/{world['a2']}/resolve", headers=world["h_admin"])
    assert r.status_code == 200
    audit = await get_change_alert_audit_db(world["a2"])
    assert [x["action"] for x in audit] == ["resolve"]


# ── Error semantics ─────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_list_db_failure_returns_500_not_200(client, world, monkeypatch):
    import routes.changes as rc

    async def boom(**kw):
        raise RuntimeError("db down")
    monkeypatch.setattr(rc, "get_change_alerts", boom)
    r = await client.get("/api/changes/alerts", headers=world["h_member"])
    assert r.status_code == 500
    assert "db down" not in r.text


@pytest.mark.asyncio
async def test_invalid_alert_id_422(client, world):
    r = await client.post("/api/changes/alerts/not-a-number/ack", headers=world["h_owner"])
    assert r.status_code == 422


# ── Detector job compatibility ──────────────────────────────────────────────
@pytest.mark.asyncio
async def test_detector_save_signature_still_works_without_workspace(client):
    aid = await save_change_alert("stripe", "warning", "s", "{}", "a", "b")
    async with AsyncSessionLocal() as s:
        assert (await s.get(ChangeAlert, aid)).workspace_id is None
