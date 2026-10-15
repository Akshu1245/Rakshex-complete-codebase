"""Workspace role-management authorization: owners cannot be removed/demoted by admins; last owner protected."""
import pytest
import pytest_asyncio

from routes.auth import create_token
from services.database import create_user, save_team
from services.db_config import AsyncSessionLocal
from models.tables import TeamMember

WS = "ws-own"


@pytest_asyncio.fixture
async def team(db):
    ids = {}
    for name in ("owner", "coowner", "admin", "admin2", "member", "viewer", "outsider"):
        ids[name] = await create_user(f"{name}@t.test", name, "x")
    await save_team(WS, "Team", ids["owner"])
    async with AsyncSessionLocal() as s:
        for name, role in (("coowner", "owner"), ("admin", "admin"), ("admin2", "admin"), ("member", "member"), ("viewer", "viewer")):
            s.add(TeamMember(team_id=WS, user_id=ids[name], role=role, accepted=True))
        await s.commit()
    hdr = {n: {"Authorization": f"Bearer {create_token(i, f'{n}@t.test')}"} for n, i in ids.items()}
    return ids, hdr


async def roles(client, hdr):
    r = await client.get(f"/api/teams/workspaces/{WS}/members", headers=hdr)
    return {m["username"]: m["role"] for m in r.json()["members"]}


def url(uid, role=False):
    return f"/api/teams/workspaces/{WS}/members/{uid}" + ("/role" if role else "")


@pytest.mark.asyncio
@pytest.mark.parametrize("target", ["owner", "coowner"])
async def test_admin_cannot_remove_an_owner(client, team, target):
    ids, h = team
    r = await client.delete(url(ids[target]), headers=h["admin"])
    assert r.status_code == 403
    assert (await roles(client, h["owner"]))[target] == "owner"


@pytest.mark.asyncio
@pytest.mark.parametrize("target", ["owner", "coowner"])
@pytest.mark.parametrize("new_role", ["admin", "member", "viewer"])
async def test_admin_cannot_demote_an_owner(client, team, target, new_role):
    ids, h = team
    r = await client.put(url(ids[target], True), json={"role": new_role}, headers=h["admin"])
    assert r.status_code == 403
    assert (await roles(client, h["owner"]))[target] == "owner"


@pytest.mark.asyncio
async def test_admin_cannot_demote_or_remove_another_admin(client, team):
    ids, h = team
    assert (await client.put(url(ids["admin2"], True), json={"role": "viewer"}, headers=h["admin"])).status_code == 403
    assert (await client.delete(url(ids["admin2"]), headers=h["admin"])).status_code == 403
    assert (await roles(client, h["owner"]))["admin2"] == "admin"


@pytest.mark.asyncio
async def test_admin_can_manage_members_and_viewers(client, team):
    ids, h = team
    assert (await client.put(url(ids["member"], True), json={"role": "viewer"}, headers=h["admin"])).status_code == 200
    assert (await client.delete(url(ids["viewer"]), headers=h["admin"])).status_code == 200
    rs = await roles(client, h["owner"])
    assert rs["member"] == "viewer" and "viewer" not in rs


@pytest.mark.asyncio
async def test_members_and_viewers_cannot_manage(client, team):
    ids, h = team
    for actor in ("member", "viewer"):
        assert (await client.delete(url(ids["viewer" if actor == "member" else "member"]), headers=h[actor])).status_code == 403
        assert (await client.put(url(ids["member"], True), json={"role": "admin"}, headers=h[actor])).status_code == 403


@pytest.mark.asyncio
async def test_outsider_gets_403(client, team):
    ids, h = team
    assert (await client.delete(url(ids["member"]), headers=h["outsider"])).status_code == 403


@pytest.mark.asyncio
async def test_primary_owner_cannot_be_removed_or_demoted_even_by_coowner(client, team):
    ids, h = team
    assert (await client.delete(url(ids["owner"]), headers=h["coowner"])).status_code == 403
    assert (await client.put(url(ids["owner"], True), json={"role": "member"}, headers=h["coowner"])).status_code == 403


@pytest.mark.asyncio
async def test_owner_can_demote_and_remove_coowner_while_another_owner_remains(client, team):
    ids, h = team
    assert (await client.put(url(ids["coowner"], True), json={"role": "admin"}, headers=h["owner"])).status_code == 200
    assert (await client.delete(url(ids["coowner"]), headers=h["owner"])).status_code == 200


@pytest.mark.asyncio
async def test_last_owner_cannot_demote_self(client, team):
    ids, h = team
    # remove the co-owner first so the primary owner is the last owner
    assert (await client.delete(url(ids["coowner"]), headers=h["owner"])).status_code == 200
    r = await client.put(url(ids["owner"], True), json={"role": "admin"}, headers=h["owner"])
    assert r.status_code in (403, 409)
    assert (await roles(client, h["owner"]))["owner"] == "owner"


@pytest.mark.asyncio
async def test_last_owner_guard_at_db_level(team):
    """Legacy/inconsistent data: primary owner row no longer 'owner'; the remaining co-owner can't leave."""
    from sqlalchemy import update
    from services.database import apply_team_member_change
    ids, _ = team
    async with AsyncSessionLocal() as s:
        await s.execute(update(TeamMember).where(TeamMember.user_id == ids["owner"]).values(role="member"))
        await s.commit()
    assert (await apply_team_member_change(WS, ids["coowner"], ids["coowner"], "set_role", "admin"))[0] == "last_owner"
    assert (await apply_team_member_change(WS, ids["coowner"], ids["coowner"], "remove"))[0] == "last_owner"


@pytest.mark.asyncio
async def test_nobody_can_grant_owner_and_only_owner_grants_admin(client, team):
    ids, h = team
    assert (await client.put(url(ids["member"], True), json={"role": "owner"}, headers=h["owner"])).status_code == 403
    assert (await client.put(url(ids["member"], True), json={"role": "admin"}, headers=h["admin"])).status_code == 403
    assert (await client.put(url(ids["member"], True), json={"role": "admin"}, headers=h["owner"])).status_code == 200


@pytest.mark.asyncio
async def test_unknown_target_is_404_and_errors_are_not_http_200(client, team):
    ids, h = team
    assert (await client.delete(url(999999), headers=h["owner"])).status_code == 404
    assert (await client.put(url(999999, True), json={"role": "viewer"}, headers=h["owner"])).status_code == 404
    assert (await client.put(url(ids["member"], True), json={"role": "superuser"}, headers=h["owner"])).status_code == 422
