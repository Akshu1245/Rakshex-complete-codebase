# RaksHex On-Call Runbook

This runbook covers repository-supported health checks and the Docker Compose stack. For hosted production incidents, use the provider dashboard together with `docs/operations/PRODUCTION_DEPLOYMENT_RUNBOOK.md`; do not assume a specific SSH host or container path.

## Health checks

| Endpoint | Expected | Purpose |
| --- | --- | --- |
| `GET /api/health` | `200` | Aggregate service health |
| `GET /api/health/ready` | `200` when dependencies are ready | Readiness |
| `GET /api/health/db` | healthy/connected response | PostgreSQL connectivity |
| `GET /api/health/redis` | healthy/connected response | Redis connectivity |

Local verification:

```bash
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://127.0.0.1:3000/api/health/ready
API_URL=http://127.0.0.1:3000 pnpm smoke:test
```

## First-response checks

```bash
docker compose ps
docker compose logs api --tail 200
docker compose logs worker --tail 200
docker compose exec -T postgres pg_isready -U rakshex -d rakshex
docker compose exec -T redis redis-cli ping
```

Never print production secrets while debugging. Check only whether required variables are present through the hosting provider's secret-management UI.

## Common alerts

### High 5xx rate or API outage

1. Check `/api/health` and `/api/health/ready`.
2. Review API logs by request/correlation ID.
3. Check PostgreSQL and Redis health.
4. Check recent deploys and migration status before restarting anything.
5. If the incident follows a release, prefer a known-good application rollback over ad-hoc database changes.

### Worker/queue backlog

```bash
docker compose logs worker --tail 200
docker compose exec -T redis redis-cli ping
```

Confirm Redis is healthy before restarting the worker. Do not substitute the development in-memory queue in production.

### Database pressure

```bash
docker compose exec -T postgres psql -U rakshex -d rakshex -c "SELECT count(*) FROM pg_stat_activity;"
docker compose exec -T postgres psql -U rakshex -d rakshex -c "SELECT pid, now() - query_start AS duration, state, left(query, 160) AS query FROM pg_stat_activity WHERE state <> 'idle' ORDER BY duration DESC LIMIT 20;"
```

Do not terminate sessions without identifying the owning operation and recording the incident action.

### Redis pressure

```bash
docker compose exec -T redis redis-cli INFO memory
docker compose exec -T redis redis-cli INFO stats
docker compose exec -T redis redis-cli CONFIG GET maxmemory-policy
```

### Payment webhook failures

Use the payment provider's delivery log to identify failed events, then correlate them with RaksHex logs. Verify webhook configuration in the provider dashboard; never echo webhook secrets into terminals, tickets, or chat.

## Restart procedures

For the local/self-hosted Compose stack:

```bash
# Restart one stateless service
docker compose up -d --no-deps --force-recreate api
# or
docker compose up -d --no-deps --force-recreate worker

# Verify afterwards
curl -fsS http://127.0.0.1:3000/api/health/ready
```

For hosted production, use the documented provider deployment/rollback mechanism. Do not use an unrecorded SSH path copied from historical documentation.

## Backup and restore

Create backups with the repository-supported backup command and periodically verify restores:

```bash
pnpm db:backup
pnpm db:restore-test
```

During an incident, restore only from a verified backup into a controlled target first whenever possible. Apply schema migrations with the canonical repository command:

```bash
pnpm db:migrate
```

Do not run raw `drizzle-kit migrate` against production as an improvised recovery step.

## Security incident handling

For suspected credential exposure, auth bypass, cross-tenant access, or tampering:

1. Treat it as P0/P1 according to `INCIDENT_RESPONSE.md`.
2. Disable affected credentials or scopes using the supported control path.
3. Preserve logs and Action Ledger/audit evidence.
4. Do not paste secrets, raw provider credentials, prompts, or customer data into incident chat.
5. Rotate affected credentials after containment.

## Monitoring

Repository sources of operational truth:

- GitHub Actions: `.github/workflows/ci.yml` and `.github/workflows/security-scan.yml`
- Production runbook: `docs/operations/PRODUCTION_DEPLOYMENT_RUNBOOK.md`
- Incident process: `INCIDENT_RESPONSE.md`
- Release gate: `LAUNCH_CHECKLIST.md`

External Sentry, uptime, status-page, and on-call ownership must be configured by the account owner before a public paid launch.

## Escalation ownership

Do not commit personal phone numbers or private escalation details to the public repository. Record named L1/L2/security/business owners in the private operations system before launch. If those owners are not configured, that is an explicit operator blocker, not a completed launch item.
