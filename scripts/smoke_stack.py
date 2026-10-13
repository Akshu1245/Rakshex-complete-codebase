"""Verify the production frontend proxy against FastAPI and real PostgreSQL."""
import json
import time
import uuid
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

base = "http://localhost:3000"


def call(path, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    request = Request(base + path, data=None if body is None else json.dumps(body).encode(), headers=headers)
    with urlopen(request, timeout=15) as response:
        return response.status, response.headers, response.read()


for attempt in range(60):
    try:
        if call('/health')[0] == 200:
            break
    except (HTTPError, URLError, OSError):
        pass
    time.sleep(1)
else:
    raise SystemExit('Frontend/backend did not become ready')

name = 'smoke_' + uuid.uuid4().hex[:12]
session = json.loads(call('/api/onboarding/signup', {'email': name + '@example.com', 'username': name, 'password': 'LongPassword123!'})[2])
assert session['status'] == 'success', session
token = session['token']
assert json.loads(call('/api/auth/me', token=token)[2])['user']['username'] == name
scan = json.loads(call('/api/v1/security/scan/full', {'code': 'api_key = "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890AABBCCDD"'}, token)[2])
assert scan['scan_id'] and scan['score'] < 100, scan
history = json.loads(call('/api/v1/security/score-history', token=token)[2])['history']
assert len(history) == 1 and history[0]['scan_id'] == scan['scan_id']
call('/api/v1/costs/calculate', {'provider': 'openai', 'model': 'gpt-4o', 'tokens_input': 1000, 'tokens_output': 500}, token)
costs = json.loads(call('/api/v1/costs/breakdown', token=token)[2])
assert costs['total_calls'] == 1 and costs['total_cost_usd'] > 0
call('/api/onboarding/complete', {'step_id': 'run_scan'}, token)
assert json.loads(call('/api/onboarding/status', token=token)[2])['completed'] == ['run_scan']
status, headers, body = call('/api/reports/export?report_type=security&format=csv', token=token)
assert status == 200 and headers['Content-Type'].startswith('text/csv') and b'ai' in body
assert '/api/auth/login' in json.loads(call('/openapi.json')[2])['paths']
assert b'swagger-ui' in call('/backend-docs')[2]
print('Full stack verified: signup → session → scan/history → costs → onboarding → CSV/docs')
