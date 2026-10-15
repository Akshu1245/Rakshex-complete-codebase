"""Run the REAL change-detector code path (_detect_changes -> upstream event -> fan-out) against
the e2e DB, with the GitHub HTTP response SIMULATED (two different shapes) so a change is detected.
Only the network probe is replaced; everything after it is production code."""
import asyncio, os, sys, uuid
BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../devpulse-backend"))
sys.path.insert(0, BACKEND)
os.chdir(BACKEND)


async def main():
    import services.change_detector as cd
    nonce = uuid.uuid4().hex[:6]
    shapes = iter([{"current_user_url": "x", f"f_{nonce}": 1}, {"current_user_url": "x"}])

    async def probe(client, api):
        if api["name"] != "GitHub":
            return None
        data = next(shapes)
        schema = cd._extract_schema(data)
        return {"api_name": "GitHub", "schema": schema, "schema_hash": cd._compute_hash(schema), "status_code": 200,
                "response_keys": list(data), "field_count": len(schema), "timestamp": "2026-10-15T00:00:00+00:00"}
    cd._probe_api = probe
    a = await cd._detect_changes()
    b = await cd._detect_changes()
    print("events:", len(a) + len(b), "workspace alerts:", sum(len(x.get("workspace_alert_ids", [])) for x in a + b))

asyncio.run(main())
