# AGENTS.md

## Cursor Cloud specific instructions

Rakshex is a pnpm + turbo monorepo (an AI-agent/API security platform). Node ≥20 and pnpm are preinstalled; `pnpm install` is run automatically on startup. The two runnable services for local dev are:

- **API** (`@rakshex/api`, Express + tRPC) on port **3000**
- **Web** (`@rakshex/web`, Next.js dashboard) on port **3001**

Postgres and Redis are provided by system packages (installed via apt, not Docker — the base image has no Docker). Standard scripts live in the root `package.json` and `README.md`/`GETTING_STARTED.md`; only the non-obvious setup/run caveats are captured below.

### Starting infra (Postgres + Redis)

These are not started automatically. Each session:

```bash
sudo pg_ctlcluster 16 main start        # start Postgres 16
redis-server --daemonize yes            # start Redis (creates ./dump.rdb; it is gitignored)
```

The `rakshex` role/db and the `DATABASE_URL` below assume password `password`. If the DB is missing (fresh cluster), recreate it:

```bash
sudo -u postgres psql -c "CREATE ROLE rakshex LOGIN PASSWORD 'password' CREATEDB;"
sudo -u postgres createdb -O rakshex rakshex
```

### Env files (important gotcha)

The API entrypoint does `import "dotenv/config"`, which loads `.env` **relative to the process CWD**. Because each app runs from its own package dir, the root `.env` is **not** read by the API. Provide per-app env files (all gitignored):

- `apps/api/.env` — must include at least:
  ```
  NODE_ENV=development
  PORT=3000
  JWT_SECRET=local-dev-jwt-secret-min-32-characters-long-000
  DATABASE_URL=postgresql://rakshex:password@localhost:5432/rakshex
  REDIS_URL=redis://localhost:6379
  FRONTEND_URL=http://localhost:3001
  CORS_ORIGINS=http://localhost:3001,http://localhost:3000
  ```
- `apps/web/.env.local`:
  ```
  NEXT_PUBLIC_TS_API_URL=http://localhost:3000
  NEXT_PUBLIC_SITE_URL=http://localhost:3001
  ```

### Migrations & seed

`pnpm db:migrate` / `pnpm db:seed` do **not** load `.env` — pass `DATABASE_URL` explicitly:

```bash
DATABASE_URL="postgresql://rakshex:password@localhost:5432/rakshex" pnpm db:migrate
DATABASE_URL="postgresql://rakshex:password@localhost:5432/rakshex" pnpm db:seed
```

### Running the dev servers

Run the two apps separately (do **not** rely on `pnpm dev`/turbo alone: both apps default to port 3000 and collide; Next also mis-parses `-- -p`). Use the `PORT` env var for the web app:

```bash
pnpm --filter @rakshex/api dev              # API on :3000
PORT=3001 pnpm --filter @rakshex/web dev    # Web on :3001
```

Health check: `curl http://localhost:3000/api/health` should report `status: "ok"` with
`checks.database` and `checks.redis` both `ok` once infrastructure and environment variables are in place.

### Lint / test / build

Commands are defined in the root `package.json` (`pnpm lint`, `pnpm typecheck`,
`pnpm test`, `pnpm build`). The 2026-07-30 release passes all four gates.

### Runtime verification

- Workspace creation uses PostgreSQL `returning()` and creates the owner membership.
- Legacy queued scans and public BullMQ scans use distinct queue names and payloads.
- `/api/import/*` is registered by the API and proxied by the web application.
- Collection credential scanning inspects URLs, bodies, variables, scripts, and
  authorization headers while redacting matched values.
- Access tokens are short-lived by design; refresh/session behavior must be verified
  in the connected buyer journey.
- Production still requires the separately deployed worker, PostgreSQL, Redis, SMTP,
  exact web/API origins, provider credentials, and monitoring described in
  `docs/operations/PRODUCTION_DEPLOYMENT_RUNBOOK.md`.
