"""Authorization can't go stale between the API check and the DB write, and every
membership-mutation path (routes + service layer) enforces the same rules."""
import asyncio

import pytest

import services.database as dbm
from services import team_manager
from services.db_config import AsyncSessionLocal
from models.tables import TeamMember
from middleware import security as sec_mw
from tests.test_teams_owner_protection import team, roles, url, WS  # noqa: F401  (fixture re-export)


@pytest.fixture(autouse=True)
def _reset_ip_throttle():
    # main's per-IP suspicious-activity throttle (60s window) is shared across the whole test session.
    sec_mw._request_counts.clear()
    yield
    sec_mw._request_counts.clear()


@pytest.mark.asyncio
@pytest.mark.parametrize("admin_action", [
    ("delete", "member", None),
    ("put", "viewer", "member"),
    ("post-invite", "outsider", "viewer"),
])
async def test_admin_demoted_between_api_check_and_db_write_is_refused(client, team, monkeypatch, admin_action):
    """Deterministic interleaving: the admin passes the API-level check, then the owner demotes the
    admin BEFORE the admin's DB transaction runs. The DB transaction re-reads the actor role -> 403."""
    ids, h = team
    original = dbm.apply_team_member_change

    async def interleaved(team_id, actor_id, target_id, action, new_role=None, invited_by=None):
        if actor_id == ids["admin"]:
            assert (await original(team_id, ids["owner"], ids["admin"], "set_role", "viewer"))[0] == "ok"
        return await original(team_id, actor_id, target_id, action, new_role, invited_by=invited_by)

    monkeypatch.setattr(dbm, "apply_team_member_change", interleaved)
    kind, target, role = admin_action
    if kind == "delete":
        r = await client.delete(url(ids[target]), headers=h["admin"])
    elif kind == "put":
        r = await client.put(url(ids[target], True), json={"role": role}, headers=h["admin"])
    else:
        r = await client.post(f"/api/teams/workspaces/{WS}/invite", json={"user_id": ids[target], "role": role}, headers=h["admin"])
    assert r.status_code == 403, r.text
    monkeypatch.setattr(dbm, "apply_team_member_change", original)
    after = await roles(client, h["owner"])
    assert after["admin"] == "viewer"
    if kind == "delete":
        assert after["member"] == "member"
    elif kind == "put":
        assert after["viewer"] == "viewer"
    else:
        assert "outsider" not in after


@pytest.mark.asyncio
async def test_concurrent_owner_demotes_admin_while_admin_acts(client, team):
    """Real concurrent requests (repeated): results always match SOME serial order, never a stale one."""
    ids, h = team
    for i in range(15):
        sec_mw._request_counts.clear()
        async with AsyncSessionLocal() as s:  # reset
            for name, role in (("admin", "admin"), ("member", "member"), ("coowner", "owner")):
                row = (await s.execute(dbm.select(TeamMember).where(TeamMember.team_id == WS, TeamMember.user_id == ids[name]))).scalar_one_or_none()
                if row is None:
                    s.add(TeamMember(team_id=WS, user_id=ids[name], role=role, accepted=True))
                else:
                    row.role = role
            await s.commit()
        demote, remove_member, demote_coowner = await asyncio.gather(
            client.put(url(ids["admin"], True), json={"role": "viewer"}, headers=h["owner"]),
            client.delete(url(ids["member"]), headers=h["admin"]),
            client.put(url(ids["coowner"], True), json={"role": "member"}, headers=h["admin"]),
        )
        after = await roles(client, h["owner"])
        assert demote.status_code == 200 and after["admin"] == "viewer"
        assert demote_coowner.status_code == 403 and after["coowner"] == "owner"   # never allowed for admins
        assert remove_member.status_code in (200, 403)
        assert ("member" not in after) == (remove_member.status_code == 200)       # response == effect
        assert after["owner"] == "owner"


@pytest.mark.asyncio
async def test_service_layer_paths_enforce_same_rules(team):
    """services.team_manager is the only other mutation path; it requires an actor and is guarded."""
    ids, _ = team
    assert (await team_manager.remove_member(WS, ids["owner"], actor_id=ids["coowner"]))["outcome"] == "forbidden"
    assert (await team_manager.change_member_role(WS, ids["owner"], "viewer", actor_id=ids["coowner"]))["outcome"] == "forbidden"
    assert (await team_manager.change_member_role(WS, ids["coowner"], "viewer", actor_id=ids["admin"]))["outcome"] == "forbidden"
    assert (await team_manager.invite_member(WS, ids["outsider"], "admin", actor_id=ids["admin"]))["outcome"] == "forbidden"
    assert (await team_manager.invite_member(WS, ids["outsider"], "owner", actor_id=ids["owner"]))["outcome"] == "forbidden"
    assert (await team_manager.remove_member(WS, ids["member"], actor_id=ids["viewer"]))["outcome"] == "forbidden"
    assert (await team_manager.remove_member(WS, ids["member"], actor_id=ids["outsider"]))["outcome"] == "forbidden"
    assert (await team_manager.remove_member(WS, 999999, actor_id=ids["owner"]))["outcome"] == "not_found"
    assert (await team_manager.invite_member(WS, ids["member"], "viewer", actor_id=ids["owner"]))["outcome"] == "conflict"
    assert (await team_manager.invite_member(WS, ids["outsider"], "viewer", actor_id=ids["admin"]))["outcome"] == "ok"
    with pytest.raises(TypeError):
        await team_manager.remove_member(WS, ids["member"])  # actor is mandatory
    for gone in ("add_team_member", "update_team_member_role", "remove_team_member"):
        assert not hasattr(dbm, gone), f"unguarded {gone} must not exist"


@pytest.mark.asyncio
async def test_admin_invite_cannot_grant_admin_via_http(client, team):
    ids, h = team
    r = await client.post(f"/api/teams/workspaces/{WS}/invite", json={"user_id": ids["outsider"], "role": "admin"}, headers=h["admin"])
    assert r.status_code == 403
    r = await client.post(f"/api/teams/workspaces/{WS}/invite", json={"user_id": ids["outsider"], "role": "admin"}, headers=h["owner"])
    assert r.status_code == 200
