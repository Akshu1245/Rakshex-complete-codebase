"""Seed THROWAWAY local SQLite DBs for the change-alerts browser tests. Synthetic data only.

usage: seed.py migrated   -> full schema (create_all); wsB has a real Reddit subscription + one fanned-out alert;
                             wsA has NO subscriptions (the browser test subscribes via the UI).
       seed.py unmigrated -> schema at alembic 002 only (pre-003/004/005) to exercise the real 503 guard.
"""
import asyncio, os, subprocess, sys
BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../devpulse-backend"))
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)
import bcrypt

PW = "E2ePass!2345"  # synthetic test password for a throwaway local DB
MODE = sys.argv[1] if len(sys.argv) > 1 else "migrated"


async def users_and_teams(create_user):
    from services.db_config import AsyncSessionLocal
    from sqlalchemy import text
    h = bcrypt.hashpw(PW.encode(), bcrypt.gensalt()).decode()
    ids = {u: await create_user(f"{u}@e2e.test", u, h) for u in ("owner", "member", "outsider", "lonely")}
    async with AsyncSessionLocal() as s:
        await s.execute(text("INSERT INTO teams(id,name,owner_id) VALUES ('wsA','Acme Payments',:o),('wsB','Beta Labs',:x)"),
                        {"o": ids["owner"], "x": ids["outsider"]})
        for n, (ws, uid, role) in enumerate( (("wsA", ids["owner"], "owner"), ("wsA", ids["member"], "member"),
                              ("wsB", ids["outsider"], "owner"), ("wsB", ids["owner"], "viewer")), start=1):
            await s.execute(text("INSERT INTO team_members(id,team_id,user_id,role,accepted) VALUES (:i,:t,:u,:r,1)"),
                            {"i": n, "t": ws, "u": uid, "r": role})
        # free tier is 100 req/hour/user (real limiter); the dashboard polls, so e2e users get the pro tier
        await s.execute(text("UPDATE users SET plan='pro'"))
        await s.commit()
    return ids


async def main():
    if MODE == "unmigrated":
        subprocess.run([sys.executable, "-m", "alembic", "upgrade", "002_onboarding_progress"], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        # alembic's BIGINT PK does not autoincrement on SQLite, so insert users with explicit ids.
        from services.db_config import AsyncSessionLocal
        from sqlalchemy import text
        counter = iter(range(1, 100))
        async def create_user(email, name, h):
            uid = next(counter)
            async with AsyncSessionLocal() as s:
                await s.execute(text("INSERT INTO users(id,email,username,password_hash) VALUES (:i,:e,:n,:h)"),
                                {"i": uid, "e": email, "n": name, "h": h})
                await s.commit()
            return uid
        print("seeded unmigrated", await users_and_teams(create_user))
        return
    from services.database import init_db, create_user, add_workspace_subscription_db, \
        record_upstream_event_and_fan_out, save_change_alert
    await init_db()
    ids = await users_and_teams(create_user)
    await add_workspace_subscription_db("wsB", "reddit", "manual", ids["outsider"])
    diff = '{"added":[{"path":"new_field","type":"str"}],"removed":[],"type_changed":[]}'
    await record_upstream_event_and_fan_out("Reddit", "warning", "REDDIT-BETA-ALERT field added", diff, "c", "d")
    await record_upstream_event_and_fan_out("CoinGecko", "critical", "COINGECKO-NOBODY", diff, "e", "f")  # no subscribers
    await save_change_alert("NASA", "critical", "LEGACY-ORPHAN-ALERT", diff, "g", "h")              # quarantined
    print("seeded migrated", ids)

asyncio.run(main())
