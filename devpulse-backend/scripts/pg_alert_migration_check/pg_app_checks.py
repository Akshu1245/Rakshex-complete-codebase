"""In-process app checks against real PostgreSQL (DATABASE_URL from env)."""
import asyncio, os, sys
sys.path.insert(0, os.getcwd())
os.environ.setdefault("REDIS_URL", "")
os.environ.setdefault("ENV", "test")
from httpx import AsyncClient, ASGITransport

mode = sys.argv[1]
fails = []
def check(cond, msg):
    print(("  PASS " if cond else "  FAIL ") + msg)
    if not cond: fails.append(msg)

async def main():
    from main import app
    from services.database import init_db
    from routes.auth import create_token
    import services.alert_schema_guard as g
    await init_db()              # what production startup does (create_all)
    g._reset_for_tests()
    H = {u: {"Authorization": f"Bearer {create_token(u, f'{u}@x.test')}"} for u in (1, 2, 3)}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        if mode == "premigration":
            missing = await g.missing_alert_schema()
            check(bool(missing), f"guard detects missing schema: {missing}")
            r = await c.get("/api/changes/alerts", headers=H[1])
            check(r.status_code == 503, f"GET alerts -> {r.status_code} (want 503)")
            r = await c.post("/api/changes/alerts/101/ack", headers=H[1])
            check(r.status_code == 503, f"ack -> {r.status_code} (want 503)")
            return
        missing = await g.missing_alert_schema()
        check(missing == [], f"schema complete: missing={missing}")
        r = await c.get("/api/changes/alerts", headers=H[1])
        check(r.status_code == 200 and r.json()["alerts"] == [], f"owner sees no legacy alerts ({r.status_code}, {len(r.json().get('alerts', []))})")
        r = await c.get("/api/changes/alerts/101", headers=H[1])
        check(r.status_code == 404, f"legacy alert 101 quarantined -> {r.status_code}")
        if mode == "guardonly":
            return
        from services.database import (add_workspace_subscription_db, record_upstream_event_and_fan_out,
                                       fan_out_event_db, backfill_legacy_alerts_to_events_db)
        await add_workspace_subscription_db("wsA", "GitHub", "repo_connect", 1)
        await add_workspace_subscription_db("wsB", "github-enterprise", "manual", 3)
        fan = await record_upstream_event_and_fan_out("github", "critical", "pg change", "{}", "a", "b")
        check(len(fan["alert_ids"]) == 1, f"fan-out only to exact subscriber wsA: {fan}")
        check(await fan_out_event_db(fan["event_id"]) == [], "re-fan-out creates nothing (dedupe)")
        aid = fan["alert_ids"][0]
        r = await c.get("/api/changes/alerts", headers=H[2]); ids = [a["id"] for a in r.json()["alerts"]]
        check(ids == [aid], f"member of wsA lists only {aid}: {ids}")
        r = await c.get("/api/changes/alerts", headers=H[3])
        check(r.json()["alerts"] == [], "wsB owner sees nothing from wsA")
        x, y = await c.get(f"/api/changes/alerts/{aid}", headers=H[3]), await c.get("/api/changes/alerts/999999", headers=H[3])
        check(x.status_code == y.status_code == 404 and x.json() == y.json(), "cross-workspace 404 identical to missing")
        r = await c.post(f"/api/changes/alerts/{aid}/ack", headers=H[2]); check(r.status_code == 403, f"member ack -> {r.status_code}")
        r = await c.post(f"/api/changes/alerts/{aid}/ack"); check(r.status_code == 401, f"anon ack -> {r.status_code}")
        r = await c.post(f"/api/changes/alerts/{aid}/ack", headers=H[3]); check(r.status_code == 404, f"other-ws owner ack -> {r.status_code}")
        r = await c.post(f"/api/changes/alerts/{aid}/ack", headers=H[1]); check(r.status_code == 200, f"owner ack -> {r.status_code}")
        try:
            from sqlalchemy import text
            from services.db_config import AsyncSessionLocal
            async with AsyncSessionLocal() as s:
                await s.execute(text("INSERT INTO change_alerts(api_name, workspace_id, event_id) VALUES ('github','wsA',:e)"), {"e": fan["event_id"]})
                await s.commit()
            check(False, "DB unique (event_id, workspace_id) should reject duplicate")
        except Exception as e:
            check("uq_change_alerts_event_workspace" in str(e), "DB unique (event_id, workspace_id) rejects duplicate")
        out = await backfill_legacy_alerts_to_events_db()
        check(out["copied_to_events"] == 2 and out["still_quarantined"] == 2, f"backfill copies legacy to events, assigns none: {out}")
        out = await backfill_legacy_alerts_to_events_db()
        check(out["copied_to_events"] == 0, "backfill idempotent")

asyncio.run(main())
if fails:
    print(f"FAILURES: {fails}"); sys.exit(1)
