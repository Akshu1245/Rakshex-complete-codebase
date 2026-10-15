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
        await add_workspace_subscription_db("wsA", "github", "manual", 1)
        again = await add_workspace_subscription_db("wsA", "github", "manual", 1)
        check(True, f"re-subscribe is idempotent (no error): {again}")
        for bad in ("GitHub", "github-enterprise", "stripe"):
            try:
                await add_workspace_subscription_db("wsB", bad, "manual", 3); check(False, f"non-canonical/unsupported id accepted: {bad}")
            except ValueError:
                check(True, f"non-canonical/unsupported id rejected: {bad}")
        fan = await record_upstream_event_and_fan_out("GitHub", "critical", "pg change", "{}", "a", "b")
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
        # 005: role CHECK constraint
        try:
            async with AsyncSessionLocal() as s:
                await s.execute(text("UPDATE team_members SET role='superuser' WHERE team_id='wsA' AND user_id=2"))
                await s.commit()
            check(False, "DB CHECK should reject role 'superuser'")
        except Exception as e:
            check("ck_team_members_role" in str(e), "DB CHECK ck_team_members_role rejects invalid role")
        async with AsyncSessionLocal() as s:
            roles = (await s.execute(text("SELECT role FROM team_members ORDER BY team_id, user_id"))).scalars().all()
        check(set(roles) <= {"owner", "admin", "member", "viewer"}, f"all roles canonical after migration: {roles}")
        # 005: shared rate-limit counters in PostgreSQL (two app instances share this table)
        from middleware import rate_limit as rl
        counts = [(await rl.increment("user:9001", 3600))[0] for _ in range(5)]
        other = (await rl.increment("user:9002", 3600))[0]
        check(counts == [1, 2, 3, 4, 5] and other == 1, f"PG counters atomic per key, user:9002 unaffected by user:9001: {counts} / {other}")
        async def burst(k):
            return (await rl.increment(k, 3600))[0]
        res = await asyncio.gather(*[burst("ipm:203.0.113.9") for _ in range(10)])
        # concurrency on real PG: subscribe races and fan-out races
        subs = await asyncio.gather(*[add_workspace_subscription_db("wsB", "slack", "manual", 3) for _ in range(8)], return_exceptions=True)
        check(not [x for x in subs if isinstance(x, Exception)], f"8 concurrent subscribes: no errors ({[type(x).__name__ for x in subs if isinstance(x, Exception)]})")
        fan2 = await record_upstream_event_and_fan_out("Slack", "warning", "pg race", "{}", "c", "d")
        races = await asyncio.gather(*[fan_out_event_db(fan2["event_id"]) for _ in range(8)])
        async with AsyncSessionLocal() as s:
            n = (await s.execute(text("SELECT count(*) FROM change_alerts WHERE event_id=:e"), {"e": fan2["event_id"]})).scalar_one()
            aud = (await s.execute(text("SELECT count(*) FROM change_alert_audit WHERE alert_id=0 AND action='sub:slack'"))).scalar_one()
        check(n == 1 and all(r == [] for r in races), f"8 concurrent fan-outs -> exactly 1 alert for wsB: {n}")
        check(aud == 1, f"subscription change audited exactly once: {aud}")
        check(sorted(res) == list(range(1, 11)), f"concurrent upserts give unique counts: {sorted(res)}")

asyncio.run(main())
if fails:
    print(f"FAILURES: {fails}"); sys.exit(1)
