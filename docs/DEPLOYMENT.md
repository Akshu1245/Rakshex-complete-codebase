# Deployment

## Environments

| Env        | Purpose                                                                 |
| ---------- | ----------------------------------------------------------------------- |
| Local      | `docker compose up -d postgres redis` + `pnpm dev`                      |
| Staging    | GHCR images tagged `staging-<sha>`; deploy via CI workflow_dispatch     |
| Production | Only after release gate green **and** smoke + primary journeys verified |

## Versioning

- App version: root `package.json` `version`
- Images: `ghcr.io/akshu1245/rakshex-api:<tag>`
- Staging tags: `staging-<gitsha7>`
- Release tags: semantic `vX.Y.Z` (create git tag after gate)

Print version:

```bash
pnpm version:print
```

## Staging deploy

1. Ensure CI **release-gate** is green on the commit.
2. Actions → CI → Run workflow → set **deployStaging** = true.
3. Workflow pushes API + worker images to GHCR under `staging-<sha>`.
4. On the staging host:

```bash
export VERSION=staging-abcdef1
export POSTGRES_PASSWORD=...
export JWT_SECRET=...
export APP_URL=https://staging.example.com
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull   # if using registry
# or: docker compose build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
pnpm db:migrate   # or run migrate job against DATABASE_URL
API_URL=https://staging.example.com pnpm smoke:test
```

## Rollback

1. Identify previous known-good image tag (GHCR / deploy notes).
2. Redeploy previous tag:

```bash
export VERSION=<previous-tag>
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

3. If a migration is forward-only and unsafe to reverse, restore DB from backup first:

```bash
# On operator machine with network to DB
./scripts/backup.sh daily
# restore using pg_restore / psql from backup file — test with:
./scripts/test-restore.sh ./backups/daily/<file>.sql.gz
```

4. Re-run `pnpm smoke:test` against staging URL.

## Health checks

- Liveness: `GET /api/health` — includes `db`, `redis`, `queue`
- Readiness: `GET /api/health/ready` — 503 if dependencies down
- Compose: service-level healthchecks; API `stop_grace_period: 30s`
- Process: SIGTERM/SIGINT graceful close + shutdown timeout

## Backups

```bash
export DB_HOST=127.0.0.1 DB_USER=rakshex DB_NAME=rakshex DB_PASSWORD=...
./scripts/backup.sh daily
./scripts/test-restore.sh ./backups/daily/<file>.sql.gz
```

## Non-root containers

API and worker images run as UID `1001` (`nodejs`). Do not run production containers as root.

## CI policy

- No `continue-on-error` on critical jobs
- No `|| true` on install/test/build/scan steps
- Audit, secret scan, SBOM, container scan are part of the release gate
