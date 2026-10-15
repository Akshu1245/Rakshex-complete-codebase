"""Seed a THROWAWAY local PostgreSQL DB for the staging-like polling measurement. Synthetic data only.
Users are on the FREE plan (1000 reads / 100 writes per hour)."""
import asyncio, os, sys
BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../devpulse-backend"))
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)
import bcrypt

PW = "E2ePass!2345"  # synthetic test password for a throwaway local DB


async def main():
    from sqlalchemy import text
    from services.database import init_db, create_user, add_workspace_subscription_db
    from services.db_config import AsyncSessionLocal
    from models.tables import Base, Team, TeamMember
    from services.db_config import engine
    async with engine.begin() as c:
        await c.run_sync(Base.metadata.drop_all)
    await init_db()
    h = bcrypt.hashpw(PW.encode(), bcrypt.gensalt()).decode()
    uid = await create_user("owner@e2e.test", "owner", h)
    async with AsyncSessionLocal() as s:
        s.add(Team(id="wsA", name="Acme Payments", owner_id=uid))
        await s.flush()
        s.add(TeamMember(team_id="wsA", user_id=uid, role="owner", accepted=True))
        await s.execute(text("UPDATE users SET plan='free'"))
        await s.commit()
    await add_workspace_subscription_db("wsA", "github", "manual", uid)
    print("seeded staging", uid)

asyncio.run(main())
