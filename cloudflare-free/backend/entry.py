"""Free Python Worker: existing FastAPI contracts, private secrets and Hyperdrive."""
import json
import os
import hashlib
from datetime import datetime, timezone

from workers import WorkerEntrypoint, DurableObject, Response, asgi

# Only public deployment settings are global. Secrets are resolved per request.
os.environ.update(WORKERS_RUNTIME='true', ENV='production',
                  DATABASE_URL='postgresql+pg8000://hyperdrive/',
                  FRONTEND_URL='https://rakshex-frontend.rakshex.workers.dev',
                  RESOURCE_PROFILE='free')

from main import app
from services.runtime_context import runtime_secrets, runtime_bindings
from services import health_monitor


async def worker_app(scope, receive, send):
    if scope['type'] in ('http', 'websocket'):
        headers = dict(scope.get('headers', []))
        address = headers.get(b'cf-connecting-ip', b'unknown').decode()
        scope = {**scope, 'client': (address, 0)}
    await app(scope, receive, send)


class AppSession(DurableObject):
    """Coordinate session requests with the DO CPU budget, not an ordinary Worker."""
    async def _context(self):
        config = {}
        for name in ('JWT_SECRET', 'DEVPULSE_ENCRYPTION_KEY'):
            config[name] = await getattr(self.env, name).get()
        if len(config['JWT_SECRET']) < 32 or len(config['DEVPULSE_ENCRYPTION_KEY']) < 32:
            raise RuntimeError('Unsafe Worker runtime configuration')
        return runtime_secrets.set(config), runtime_bindings.set(self.env)

    async def _load_health(self):
        row = await self.env.HEALTH_DB.prepare('SELECT payload FROM health_snapshot WHERE id = 1').first()
        stale = not row
        if row:
            stored = json.loads(row.payload)
            checked = datetime.fromisoformat(stored['last_run'])
            stale = (datetime.now(timezone.utc) - checked).total_seconds() >= 300
        if stale:
            # Also refresh on demand: a new deployment need not wait for Cron
            # propagation. The monitor actor enforces one shared five-minute lease.
            await self.env.APP_SESSION.getByName('shared-public-monitor').run_monitor(False)
            row = await self.env.HEALTH_DB.prepare('SELECT payload FROM health_snapshot WHERE id = 1').first()
        if row:
            data = json.loads(row.payload)
            health_monitor.health_data = data['apis']
            health_monitor._last_run = data['last_run']

    async def fetch(self, request):
        try:
            token = await self._context()
        except Exception:
            return Response.json({'error': 'BACKEND_NOT_CONFIGURED'}, status=503)
        try:
            # Public health snapshots live in D1, so health traffic cannot keep
            # PostgreSQL awake. Database data is still scoped by existing routes.
            path = request.url.split('?', 1)[0].split('/', 3)[-1]
            if path in ('api/dashboard', 'api/health', 'api/api-details', 'ws/health'):
                await self._load_health()
            if (request.headers.get('upgrade') or '').lower() == 'websocket':
                return await asgi.websocket(worker_app, request, self.env)
            return await asgi.fetch(worker_app, request, self.env, self.ctx)
        finally:
            runtime_secrets.reset(token[0])
            runtime_bindings.reset(token[1])

    async def run_monitor(self, include_schema=False):
        env = self.env
        self.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS monitor_leases(name TEXT PRIMARY KEY, checked_at INTEGER NOT NULL)')
        now = int(datetime.now(timezone.utc).timestamp())
        health = self.ctx.storage.sql.exec("INSERT INTO monitor_leases VALUES('health',?) ON CONFLICT(name) DO UPDATE SET checked_at=excluded.checked_at WHERE checked_at <= ? RETURNING name", now, now - 300).toArray()
        if health:
            snapshot = await health_monitor._run_all_probes()
            payload = json.dumps({'apis': snapshot, 'last_run': health_monitor._last_run})
            await env.HEALTH_DB.prepare('INSERT INTO health_snapshot(id,payload) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(payload).run()
        await env.HEALTH_DB.prepare('DELETE FROM rate_counters WHERE expires < ?').bind(int(datetime.now(timezone.utc).timestamp())).run()
        # Schema persistence is hourly: avoid waking the free database every five minutes.
        if include_schema:
            schema = self.ctx.storage.sql.exec("INSERT INTO monitor_leases VALUES('schema',?) ON CONFLICT(name) DO UPDATE SET checked_at=excluded.checked_at WHERE checked_at <= ? RETURNING name", now, now - 3600).toArray()
            if schema:
                from services.change_detector import _detect_changes
                token = await self._context()
                try:
                    await _detect_changes()
                finally:
                    runtime_secrets.reset(token[0])
                    runtime_bindings.reset(token[1])
        return True


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        # This is only a routing key, never an authorization decision. The
        # original FastAPI auth verifies JWTs and database membership in the DO.
        credential = request.headers.get('authorization')
        identity = credential or ('anonymous:' + (request.headers.get('cf-connecting-ip') or 'unknown'))
        name = hashlib.sha256(identity.encode()).hexdigest()
        stub = self.env.APP_SESSION.getByName(name)
        return await stub.fetch(request)

    async def scheduled(self, controller, env, ctx):
        await env.APP_SESSION.getByName('shared-public-monitor').run_monitor(True)
