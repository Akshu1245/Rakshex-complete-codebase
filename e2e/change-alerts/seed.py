"""Seed a THROWAWAY local SQLite DB for the change-alerts browser tests. Synthetic data only."""
import asyncio, os, sys
BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../devpulse-backend"))
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)
import bcrypt

PW = "E2ePass!2345"  # synthetic test password for a throwaway local DB

async def main():
    from services.database import init_db, create_user, add_workspace_subscription_db, \
        record_upstream_event_and_fan_out, save_change_alert
    from services.db_config import AsyncSessionLocal
    from models.tables import Team, TeamMember
    await init_db()
    h = bcrypt.hashpw(PW.encode(), bcrypt.gensalt()).decode()
    ids = {u: await create_user(f"{u}@e2e.test", u, h) for u in ("owner", "member", "outsider", "lonely")}
    async with AsyncSessionLocal() as s:
        s.add_all([Team(id="wsA", name="Acme Payments", owner_id=ids["owner"]),
                   Team(id="wsB", name="Beta Labs", owner_id=ids["outsider"])])
        await s.flush()
        s.add_all([TeamMember(team_id="wsA", user_id=ids["owner"], role="owner", accepted=True),
                   TeamMember(team_id="wsA", user_id=ids["member"], role="member", accepted=True),
                   TeamMember(team_id="wsB", user_id=ids["outsider"], role="owner", accepted=True),
                   TeamMember(team_id="wsB", user_id=ids["owner"], role="viewer", accepted=True)])
        await s.commit()
    await add_workspace_subscription_db("wsA", "GitHub", "repo_connect", ids["owner"])
    await add_workspace_subscription_db("wsB", "Reddit", "integration", ids["outsider"])
    diff = '{"added":["new_field"],"removed":["old_field"],"type_changed":{}}'
    await record_upstream_event_and_fan_out("GitHub", "critical", "GITHUB-ACME-ALERT field removed", diff, "a", "b")
    await record_upstream_event_and_fan_out("Reddit", "warning", "REDDIT-BETA-ALERT field added", diff, "c", "d")
    # second wsA alert so the ack test has an unacked alert in each Playwright project (desktop, mobile)
    await record_upstream_event_and_fan_out("GitHub", "critical", "GITHUB-ACME-ALERT field removed (2)", diff, "b", "b2")
    await record_upstream_event_and_fan_out("CoinGecko", "critical", "COINGECKO-NOBODY", diff, "e", "f")
    await save_change_alert("NASA", "critical", "LEGACY-ORPHAN-ALERT", diff, "g", "h")
    print("seeded", ids)

asyncio.run(main())
