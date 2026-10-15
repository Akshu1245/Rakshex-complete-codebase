"""PostgreSQL-only: proves the membership transaction takes SELECT ... FOR UPDATE and re-checks the
actor's role after acquiring it. Runs when TEST_PG_URL is set (CI job uses a postgres service)."""
import asyncio
import os

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

import services.database as dbm
from models.tables import Base

PG = os.environ.get("TEST_PG_URL")
pytestmark = pytest.mark.skipif(not PG, reason="TEST_PG_URL not set (PostgreSQL row-lock test)")


@pytest.mark.asyncio
async def test_actor_role_rechecked_after_for_update_lock(monkeypatch):
    engine = create_async_engine(PG)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as c:
        await c.run_sync(Base.metadata.drop_all)
        await c.run_sync(Base.metadata.create_all)
        for uid, name in ((1, "owner"), (2, "admin"), (3, "member")):
            await c.execute(text("INSERT INTO users (id, email, username, password_hash) VALUES (:i, :e, :n, 'x')"),
                            {"i": uid, "e": f"{name}@pg.test", "n": name})
        await c.execute(text("INSERT INTO teams (id, name, owner_id) VALUES ('pgws', 'T', 1)"))
        for uid, role in ((1, "owner"), (2, "admin"), (3, "member")):
            await c.execute(text("INSERT INTO team_members (team_id, user_id, role, accepted) VALUES ('pgws', :u, :r, true)"),
                            {"u": uid, "r": role})
    monkeypatch.setattr(dbm, "AsyncSessionLocal", Session)
    try:
        # Owner's transaction: lock the team row and demote the admin, but don't commit yet.
        owner_conn = await engine.connect()
        tx = await owner_conn.begin()
        await owner_conn.execute(text("SELECT id FROM teams WHERE id='pgws' FOR UPDATE"))
        await owner_conn.execute(text("UPDATE team_members SET role='viewer' WHERE team_id='pgws' AND user_id=2"))
        # Admin's request starts now (its API-level check would have seen 'admin').
        admin_task = asyncio.create_task(dbm.apply_team_member_change("pgws", 2, 3, "remove"))
        await asyncio.sleep(0.5)
        assert not admin_task.done(), "admin transaction must block on the FOR UPDATE lock"
        await tx.commit()
        await owner_conn.close()
        outcome, _ = await asyncio.wait_for(admin_task, 10)
        assert outcome == "forbidden"
        async with engine.connect() as c:
            assert (await c.execute(text("SELECT count(*) FROM team_members WHERE team_id='pgws' AND user_id=3"))).scalar() == 1
        # Sanity: with the lock free, the owner can do it.
        assert (await dbm.apply_team_member_change("pgws", 1, 3, "remove"))[0] == "ok"
    finally:
        async with engine.begin() as c:
            await c.run_sync(Base.metadata.drop_all)
        await engine.dispose()
