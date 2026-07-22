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

Health check: `curl http://localhost:3000/api/health` should report `db`, `redis`, `queue` all `ok` once infra + `apps/api/.env` are in place.

### Lint / test / build

Commands are defined in the root `package.json` (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`). Note the following **pre-existing** failures (present on `main`, unrelated to environment setup — do not treat them as setup regressions):

- `pnpm typecheck` and `pnpm build` fail in `@rakshex/api` due to a type error in `apps/api/api/onboarding.ts` (comparing a `"accepted"|"rejected"` union to `"active"`). All other packages + the web build succeed.
- `pnpm test`: package tests pass; `@rakshex/api` has ~14 failing tests because some `../db` vitest mocks omit `getPersonalWorkspaceForUser`.
- `pnpm lint` passes cleanly.

### Known runtime bugs to expect (pre-existing, not env issues)

- **New-user workspace creation is broken.** `db.createWorkspace` reads MySQL-style `result.insertId`, which is `0` on Postgres, so the follow-up `workspace_members` insert fails an FK constraint. Result: a freshly registered user has no workspace membership and cannot create collections (`editorProcedure`/workspace checks fail). To exercise authenticated flows, promote the user and add the membership row manually, e.g.:
  ```sql
  UPDATE users SET role='admin', plan='enterprise' WHERE email='<email>';
  INSERT INTO workspace_members ("workspaceId","userId",role,active,"joinedAt")
    SELECT id, "ownerUserId", 'owner', true, now() FROM workspaces WHERE "ownerUserId"=<userId>
    ON CONFLICT DO NOTHING;
  ```
- **Async scans fail.** The API process registers a `jobs.ts` scan worker expecting `data.options.scanType`, which conflicts with the intended flat-shape `scanWorker.ts` on the same Redis `scan` queue, so queued scans error with `Cannot read properties of undefined (reading 'scanType')`. However, **collection import runs the scanner synchronously** and returns credential + gateway findings in the create response (this is the reliable way to demo the scanner).
- The sidebar **"Import"** link (`/import`) posts to REST endpoints that aren't proxied in dev and returns HTML ("Unexpected token '<'"). Use the **"Import Collection"** button on the `/collections` page instead (it calls tRPC `collections.create`). That button currently renders with a near-invisible background.
- The credential scanner flags secrets embedded in request **URLs** (e.g. `?api_key=sk_live_...`); a secret placed only in an `Authorization: Bearer` header is treated as legitimate and not flagged.
- Access tokens expire after 15 minutes; long interactive sessions may need a re-login.
