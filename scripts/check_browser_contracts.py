"""Check every statically declared browser request against FastAPI's live schema."""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
os.environ.setdefault("ENV", "test")
sys.path.insert(0, str(root / "devpulse-backend"))
from main import app

schema = app.openapi()
calls = json.loads(subprocess.check_output(["node", str(root / "scripts/browser-contracts.cjs")], cwd=root))
failures = []
for call in calls:
    target, _, query = call["path"].partition("?")
    pattern = re.escape(target)
    pattern = re.sub(r'\\\$\\\{.*?\\\}', '[^/]+', pattern)
    matched = [(p, m[call["method"].lower()]) for p, m in schema["paths"].items()
               if re.fullmatch(pattern, re.sub(r'\{[^}]+\}', 'value', p)) and call["method"].lower() in m]
    if not matched:
        failures.append(f'{call["method"]} {call["path"]}: route missing')
        continue
    operation = matched[0][1]
    if call["bodyKeys"] is not None:
        body_schema = operation.get("requestBody", {}).get("content", {}).get("application/json", {}).get("schema", {})
        if "$ref" in body_schema:
            body_schema = schema["components"]["schemas"][body_schema["$ref"].split("/")[-1]]
        missing = set(body_schema.get("required", [])) - set(call["bodyKeys"])
        if missing:
            failures.append(f'{call["path"]}: missing body fields {sorted(missing)}')
    query_names = {parameter["name"] for parameter in operation.get("parameters", []) if parameter["in"] == "query"}
    for part in query.split("&"):
        if "=" in part and not part.startswith("${") and part.split("=", 1)[0] not in query_names:
            failures.append(f'{call["path"]}: unsupported query parameter {part.split("=", 1)[0]}')
if failures:
    raise SystemExit("\n".join(failures))
print(f"Verified {len(calls)} browser request contracts against FastAPI")
