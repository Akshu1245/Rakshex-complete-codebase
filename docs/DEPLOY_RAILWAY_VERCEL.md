# Deploy: Railway (API + Worker) + Vercel (Web)

Click-by-click beta deploy for Rakshex. Goal: production API URL for the web app and VS Code extension — no localhost.

Related: [STAGING_BUYER_JOURNEY.md](./STAGING_BUYER_JOURNEY.md), [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Architecture

| Piece                        | Host                       | Image / build                                        |
| ---------------------------- | -------------------------- | ---------------------------------------------------- |
| API (HTTP + Socket.IO `/ws`) | Railway service **api**    | `Dockerfile` target `api` (`railway.toml`)           |
| BullMQ worker (scans/jobs)   | Railway service **worker** | `Dockerfile` target `worker` (`railway.worker.toml`) |
| Postgres                     | Railway Postgres plugin    | shared `DATABASE_URL`                                |
| Redis                        | Railway Redis plugin       | shared `REDIS_URL`                                   |
| Next.js dashboard            | Vercel                     | root `vercel.json` → `@rakshex/web`                  |

Migrations run on API pre-deploy: `pnpm --filter @rakshex/database db:migrate` (order through `0020_gateway_audit_workspace`).

---

## Phase 1 — Railway project

### 1. Create project + plugins

1. [railway.app](https://railway.app) → **New Project** → **Empty Project**.
2. **+ New** → **Database** → **PostgreSQL**.
3. **+ New** → **Database** → **Redis**.
4. Note connection variables (`DATABASE_URL`, `REDIS_URL`) — you will reference them on both services.

### 2. API service

1. **+ New** → **GitHub Repo** → select this monorepo.
2. Service settings:
   - **Config as Code**: `railway.toml` (repo root).
   - Confirm **Dockerfile path** = `Dockerfile`, **build target** = `api`.
3. **Variables** (API) — set or reference:

| Variable                                                              | Notes                                                                                                                         |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                        | Reference Postgres plugin                                                                                                     |
| `REDIS_URL`                                                           | Reference Redis plugin                                                                                                        |
| `NODE_ENV`                                                            | `production`                                                                                                                  |
| `PORT`                                                                | `3000` (or Railway-assigned; healthcheck uses `PORT`)                                                                         |
| `JWT_SECRET`                                                          | ≥32 random chars                                                                                                              |
| `APP_URL`                                                             | Public API HTTPS URL (set after first deploy, then redeploy)                                                                  |
| `FRONTEND_URL`                                                        | Vercel production URL (e.g. `https://app.rakshex.in`)                                                                         |
| `CORS_ORIGINS`                                                        | Exact origins, comma-separated — **no** `*.vercel.app` wildcards. Include production web + optional preview URLs you control. |
| `METRICS_TOKEN`                                                       | Random bearer for `/metrics`                                                                                                  |
| `RAKSHEX_VAULT_KEY`                                                   | 32-byte key for secret encryption (if required by env schema)                                                                 |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM`   | Required in production                                                                                                        |
| `SENTRY_DSN`                                                          | Optional but recommended                                                                                                      |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | **or** Stripe equivalents — at least one payment rail for beta                                                                |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`                         | If using Stripe                                                                                                               |

4. **Networking** → generate public domain (e.g. `https://api-xxxx.up.railway.app`) or attach custom domain.
5. Set `APP_URL` to that HTTPS origin; redeploy.
6. Smoke:

```bash
curl -sS "$APP_URL/api/health"
curl -sS -o /dev/null -w "%{http_code}\n" "$APP_URL/api/health/ready"
```

Expect `db`, `redis`, `queue` healthy / ready `200`.

### 3. Worker service (required for async scans)

1. **+ New** → **GitHub Repo** → **same** monorepo (second service).
2. Service settings:
   - **Config as Code**: `railway.worker.toml`.
   - Dockerfile target **`worker`**.
   - **Do not** set HTTP healthcheck path (worker has no `/api/health`).
3. Variables: share `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `NODE_ENV`, plus any worker-needed secrets from the API list. Set `WORKER_CONCURRENCY` (default `3`).
4. Deploy. Confirm Railway logs show BullMQ workers starting (no crash loop on healthcheck).

### 4. Migration check

After API pre-deploy migrate succeeds, optional verify from a one-off shell:

```bash
DATABASE_URL="..." pnpm --filter @rakshex/database db:migrate
# Expect no pending tags through 0020_gateway_audit_workspace
```

---

## Phase 2 — Vercel web

1. [vercel.com](https://vercel.com) → **Add New Project** → import the monorepo.
2. **Root Directory**: leave repo root (uses root `vercel.json`), **or** set Root Directory to `apps/web` and use `apps/web/vercel.json`.
3. Framework: Next.js. Install/build from `vercel.json`:
   - `pnpm install --frozen-lockfile`
   - `pnpm --filter @rakshex/web build`
4. **Environment variables** (Production + Preview as needed):

| Variable                 | Value                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_TS_API_URL` | Railway API origin, e.g. `https://api.rakshex.in` (**no** trailing slash)             |
| `NEXT_PUBLIC_SITE_URL`   | This Vercel web origin, e.g. `https://app.rakshex.in`                                 |
| `NEXT_PUBLIC_WS_URL`     | Optional override; if unset, dashboard derives `wss://` from `NEXT_PUBLIC_TS_API_URL` |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional web Sentry                                                                   |

Template: [`apps/web/vercel.env.example`](../apps/web/vercel.env.example).

5. Deploy → note production URL.
6. Back on Railway API: set `FRONTEND_URL` + `CORS_ORIGINS` to include that exact origin; redeploy API.

### CORS / cookies

- Production allowlist is **explicit** (`apps/api/_core/corsAllowlist.ts`) — list every real frontend origin in `CORS_ORIGINS` / `FRONTEND_URL`.
- Do not rely on `*.vercel.app` wildcards.

### Realtime (Socket.IO)

Dashboard connects to the **API** origin (`NEXT_PUBLIC_TS_API_URL` / `NEXT_PUBLIC_WS_URL`), path `/ws` — not `window.location.host` when web and API are split.

---

## Phase 3 — Smoke buyer journey

Against the live URLs (not localhost):

1. [ ] `GET $APP_URL/api/health` and `/api/health/ready` green
2. [ ] Signup on Vercel web
3. [ ] Workspace present / create
4. [ ] Import collection (Collections page → Import Collection)
5. [ ] Credential findings appear
6. [ ] Async scan completes (**worker must be up**)
7. [ ] Findings list loads
8. [ ] Optional: Socket.IO “live” indicator on `/dashboard` connects

Full sign-off table: [STAGING_BUYER_JOURNEY.md](./STAGING_BUYER_JOURNEY.md).

---

## Phase 4 — VS Code extension against prod

1. Install VSIX or F5 Extension Development Host.
2. Settings → `rakshex.apiUrl` = Railway `APP_URL`.
3. Sign in with a production API key (web → API keys).
4. Import → scan → findings tree + Security Dashboard.
5. Package: `cd apps/vscode-extension && npm run package` (runs validate + `vsce package`).

Marketplace publish: see `apps/vscode-extension/PUBLISHING.md` (publisher login is founder-owned).

---

## Env checklist (copy/paste)

### Railway API

```
NODE_ENV=production
DATABASE_URL=<postgres>
REDIS_URL=<redis>
JWT_SECRET=<min 32 chars>
APP_URL=https://<api-host>
FRONTEND_URL=https://<vercel-host>
CORS_ORIGINS=https://<vercel-host>,https://rakshex.in,https://www.rakshex.in
METRICS_TOKEN=<random>
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@rakshex.in
SENTRY_DSN=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
# and/or Stripe
```

### Railway worker

```
NODE_ENV=production
DATABASE_URL=<same>
REDIS_URL=<same>
JWT_SECRET=<same>
WORKER_CONCURRENCY=3
```

### Vercel

```
NEXT_PUBLIC_TS_API_URL=https://<api-host>
NEXT_PUBLIC_SITE_URL=https://<vercel-host>
NEXT_PUBLIC_WS_URL=wss://<api-host>
NEXT_PUBLIC_SENTRY_DSN=
```

### Payment webhooks (provider dashboard)

Point provider webhooks at:

- Razorpay: `POST $APP_URL/api/webhooks/razorpay`
- Stripe: `POST $APP_URL/api/webhooks/stripe`

---

## Uptime / Sentry

1. Set `SENTRY_DSN` (API) and `NEXT_PUBLIC_SENTRY_DSN` (web).
2. Uptime monitor: poll `$APP_URL/api/health/ready` every 1–5 minutes (Better Stack, UptimeRobot, etc.).
3. Alert on non-200 or body missing healthy `db`/`redis`/`queue`.

---

## Common failures

| Symptom                               | Fix                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| Async scans stuck / `scanType` errors | Worker service missing or wrong Docker target                                  |
| Browser CORS errors                   | Add exact Vercel origin to `CORS_ORIGINS`; redeploy API                        |
| Dashboard never “live”                | Set `NEXT_PUBLIC_TS_API_URL` / `NEXT_PUBLIC_WS_URL` to API; rebuild Vercel     |
| Migrate fails mid-deploy              | Check Railway API logs; ensure Postgres reachable; migrations through `0020_*` |
| Worker “unhealthy”                    | Remove HTTP healthcheck; use `railway.worker.toml`                             |

---

## What this runbook does **not** automate

- Clicking Railway/Vercel deploy buttons (needs founder accounts).
- DNS for custom domains.
- `vsce login` / Marketplace publisher ownership.
- Live SMTP provider signup and payment KYC.
