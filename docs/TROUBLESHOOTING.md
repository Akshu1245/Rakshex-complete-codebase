# Troubleshooting

## `pnpm install --frozen-lockfile` fails

- Use the repo-pinned pnpm (`packageManager` in root `package.json`).
- Do not hand-edit `pnpm-lock.yaml`.
- Delete local `node_modules` and re-run install.

## Postgres / Redis connection errors

```bash
pnpm db:up
docker compose ps
# DATABASE_URL=postgresql://rakshex:rakshex@127.0.0.1:5432/rakshex
# REDIS_URL=redis://127.0.0.1:6379
```

## Migrations fail

- Ensure `DATABASE_URL` points at a reachable Postgres.
- Run `pnpm db:migrate` only after DB is healthy (`pg_isready`).

## Health check degraded / 503

- `/api/health` reports `db` and `redis` separately.
- Fix dependency first; do not ignore 503 in readiness probes.

## Format / lint / typecheck fail in CI

- Run the same commands locally.
- `format:check` scopes to packages, api/cli/worker, docs, workflows (not `vendor/`).

## Docker build fails

- Build with repo root context: `docker build -f Dockerfile --target api .`
- Ensure lockfile is present; `HUSKY=0` is set in Dockerfile.

## E2E smoke fails without servers

- Playwright smoke expects a web/API URL from `playwright.config.ts`.
- Prefer CI services or `pnpm smoke:test` against a running API.

## Backup restore fails

- Scripts require client tools `pg_dump`, `psql`, `gzip`/`gunzip`.
- Defaults assume user/db `rakshex` — override with `DB_*` env vars.
