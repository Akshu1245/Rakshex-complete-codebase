# DevPulse Launch Runbook

This is a turnkey deploy runbook for the DevPulse monorepo.
Hand this file (and the repo URL) to any AI agent or human operator and
they will be able to take the codebase from "ready" to "live in
production" without guessing.

**Repo:** https://github.com/Akshu1245/devpulse-complete-codebase

**Recommended stack:**
| Component | Host | Why |
|---|---|---|
| Backend (Node/Express/tRPC) | Railway | First-party MySQL + Redis + Docker support |
| Database (MySQL 8) | Railway plugin | Auto-injects `DATABASE_URL` |
| Redis | Railway plugin | Auto-injects `REDIS_URL` |
| Frontend (`devpulse-frontend/`, Next.js 14) | Vercel | Native, free tier, preview URLs per PR |
| Email (transactional) | Resend | 3k emails/mo free, drop-in SMTP |
| Errors | Sentry | Already wired in code |
| DNS | Cloudflare | Free tier, fast propagation |
| Domain | `devpulse.in` (CORS allowlist already has app/api subdomains) |

---

## 0. Pre-flight (one-time only)

Confirm you can run locally first (sanity test, not required for deploy):

```bash
node --version    # must be >= v22.12 (the Dockerfile uses node:22-alpine)
pnpm --version    # any v9+ works with the lockfile
git --version
```

```bash
git clone https://github.com/Akshu1245/devpulse-complete-codebase.git
cd devpulse-complete-codebase
cp .env.example .env
pnpm install --frozen-lockfile
pnpm run check     # tsc --noEmit, must exit 0
pnpm run lint      # 0 errors (warnings are fine)
```

If `pnpm run check` fails, **stop and fix that first**. Do not deploy a
broken typecheck.

---

## 1. Provision Railway (backend + DB + Redis)

### 1a. Install CLI and authenticate

```bash
npm i -g @railway/cli
railway login --browserless      # or: export RAILWAY_TOKEN=...
```

### 1b. Create project + plugins

```bash
railway init devpulse-backend     # creates project, links current dir
railway add --plugin mysql        # provisions MySQL, injects DATABASE_URL
railway add --plugin redis        # provisions Redis,  injects REDIS_URL
```

### 1c. Set service env vars

```bash
# Auth secrets — generate fresh
railway variables set NODE_ENV=production
railway variables set JWT_SECRET="$(openssl rand -base64 64)"
railway variables set REFRESH_TOKEN_SECRET="$(openssl rand -base64 64)"
railway variables set CSRF_SECRET="$(openssl rand -base64 64)"

# Email — pick one of:
#
# Option A: Resend (https://resend.com/api-keys)
railway variables set SMTP_HOST=smtp.resend.com
railway variables set SMTP_PORT=587
railway variables set SMTP_USER=resend
railway variables set SMTP_PASS="<RESEND_API_KEY>"
railway variables set EMAIL_FROM="DevPulse <noreply@devpulse.in>"
#
# Option B: Brevo (https://app.brevo.com/settings/keys/smtp)
# 300 emails/day free forever — strongest free tier
# railway variables set SMTP_HOST=smtp-relay.brevo.com
# railway variables set SMTP_PORT=587
# railway variables set SMTP_USER="<your-brevo-login-email>"
# railway variables set SMTP_PASS="<BREVO_SMTP_KEY>"
# railway variables set EMAIL_FROM="DevPulse <noreply@devpulse.in>"
#
# Option C: Postmark, SendGrid, Mailgun, AWS SES all work the same way —
# anything that gives you SMTP host/port/user/pass.

# At least one LLM provider — Anthropic recommended
railway variables set ANTHROPIC_API_KEY="<sk-ant-...>"
railway variables set OPENAI_API_KEY="<sk-...>"   # optional fallback

# Stripe (test keys are fine to launch with)
railway variables set STRIPE_SECRET_KEY="<sk_test_... or sk_live_...>"
railway variables set STRIPE_WEBHOOK_SECRET="<whsec_...>"
railway variables set STRIPE_PRO_PRICE_ID="<price_...>"
railway variables set STRIPE_ENTERPRISE_PRICE_ID="<price_...>"

# GitHub App (create at https://github.com/settings/apps/new)
railway variables set GITHUB_APP_ID="<id>"
railway variables set GITHUB_APP_PRIVATE_KEY="$(cat path/to/key.pem)"
railway variables set GITHUB_WEBHOOK_SECRET="$(openssl rand -hex 32)"

# Sentry (optional but recommended — create at https://sentry.io)
railway variables set SENTRY_DSN="<dsn>"

# Frontend URL (used for CORS + email links)
railway variables set FRONTEND_URL="https://app.devpulse.in"
railway variables set APP_URL="https://api.devpulse.in"
```

### 1d. Deploy

```bash
railway up
```

The Dockerfile multi-stage build will:

1. `pnpm install --frozen-lockfile` (deps stage)
2. `pnpm run build` -> `tsc` -> `dist/`
3. Copy artifacts to slim runtime stage on `node:22-alpine`
4. Start: `sh scripts/migrate.sh && node dist/server/_core/index.js`
   - `migrate.sh` runs all 10 drizzle migrations idempotently
   - Then the server starts on `$PORT` (Railway-injected)

### 1e. Verify

```bash
railway logs --build      # watch build
railway logs              # watch runtime
railway domain            # show public URL, e.g. https://devpulse-backend-production.up.railway.app
curl https://<railway-url>/api/health | jq
# expected: { "status": "ok", "db": "connected", "redis": "connected", ... }
```

---

## 2. Deploy frontend to Vercel

### 2a. Install CLI

```bash
npm i -g vercel
vercel login                     # or: export VERCEL_TOKEN=...
```

### 2b. Deploy

```bash
cd devpulse-frontend
vercel link                      # links to a new or existing project
vercel env add NEXT_PUBLIC_TS_API_URL production
# paste: https://<railway-backend-url>   (or https://api.devpulse.in once DNS is live)
vercel env add NEXT_PUBLIC_APP_URL production
# paste: https://app.devpulse.in
vercel env add NEXT_PUBLIC_WS_URL production
# paste: wss://<railway-backend-url>/ws
vercel --prod
```

The `vercel.json` and `next.config.js` are already configured with:

- CSP / HSTS / Permissions-Policy headers
- Rewrites: `/api/oauth/*`, `/api/trpc/*`, `/api/health` -> backend
- React strict mode, productionBrowserSourceMaps off, console stripping

### 2c. Verify

```bash
curl https://<vercel-url>/api/health    # should proxy to Railway
```

---

## 3. DNS (Cloudflare)

Add these records to `devpulse.in` in Cloudflare:

| Type  | Name  | Value                                       | Proxy    |
| ----- | ----- | ------------------------------------------- | -------- |
| CNAME | `app` | `cname.vercel-dns.com`                      | DNS only |
| CNAME | `api` | `<railway-cname>`                           | DNS only |
| CNAME | `www` | `cname.vercel-dns.com`                      | DNS only |
| A     | `@`   | (Vercel apex IP, shown in Vercel dashboard) | DNS only |

In Vercel dashboard -> Settings -> Domains: add `app.devpulse.in` and
verify ownership.
In Railway dashboard -> Settings -> Networking: add custom domain
`api.devpulse.in` and copy the CNAME target into Cloudflare.

---

## 4. Publish VSCode extension

Already wired via `.github/workflows/publish-extension.yml`.

```bash
# One-time: create a marketplace publisher
# https://marketplace.visualstudio.com/manage/publishers/

# Add the PAT as a repo secret (GitHub repo -> Settings -> Secrets):
#   VSCE_PAT = <Azure DevOps PAT with Marketplace > Manage scope>

# Trigger the workflow manually:
gh workflow run publish-extension.yml --field versionBump=patch --field dryRun=false
```

---

## 5. Post-deploy smoke test

```bash
# 1. Health
curl -s https://api.devpulse.in/api/health | jq

# 2. Create an admin user (uses scripts/create-admin.ts via Railway exec)
railway run npx tsx scripts/create-admin.ts admin@example.com 'TempPassword123!'

# 3. Hit the frontend
open https://app.devpulse.in

# 4. Run E2E smoke (requires the URLs above to resolve)
pnpm exec playwright test --grep="@smoke"
```

---

## 6. Backups

Already provided in `scripts/`:

- `scripts/backup.sh` — dumps MySQL + Redis snapshot to S3 (set `AWS_*` + `BACKUP_S3_BUCKET`)
- `scripts/test-restore.sh` — restores into a scratch DB and verifies row counts

Wire into a Railway cron service or GitHub Action on a daily schedule.

---

## 7. What this runbook does NOT do

These are real launch tasks but are business / human work, not deploy:

- Acquire users / run beta
- Configure Stripe products + price IDs in the dashboard
- Submit SOC2 evidence
- Write blog content
- Mobile-test the dashboard

The codebase is engineering-complete; everything above is operations.

---

## Appendix A — Secrets checklist

Minimum set required for the app to actually function end-to-end:

| Secret                                                               | Where                          | Required for                        |
| -------------------------------------------------------------------- | ------------------------------ | ----------------------------------- |
| `RAILWAY_TOKEN`                                                      | Local shell                    | `railway up`                        |
| `VERCEL_TOKEN`                                                       | Local shell                    | `vercel --prod`                     |
| `DATABASE_URL`                                                       | Railway env (auto from plugin) | Backend startup                     |
| `REDIS_URL`                                                          | Railway env (auto from plugin) | Queues, rate limiting               |
| `JWT_SECRET`                                                         | Railway env                    | Auth                                |
| `REFRESH_TOKEN_SECRET`                                               | Railway env                    | Auth refresh                        |
| `CSRF_SECRET`                                                        | Railway env                    | CSRF protection                     |
| `SMTP_*`                                                             | Railway env                    | Signup verification, password reset |
| `ANTHROPIC_API_KEY` _or_ `OPENAI_API_KEY`                            | Railway env                    | All AI features                     |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`                        | Railway env                    | Billing                             |
| `GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY` + `GITHUB_WEBHOOK_SECRET` | Railway env                    | PR scanning                         |
| `SENTRY_DSN`                                                         | Railway env                    | Error monitoring (optional)         |
| `VSCE_PAT`                                                           | GitHub repo secret             | VSCode marketplace publish          |
| Cloudflare API token                                                 | Local or DNS automation        | DNS (optional, can edit by hand)    |

---

## Appendix B — One-command deploy script

See `scripts/one-command-deploy.sh`. It runs the entire backend deploy
(Railway up + migrations + healthcheck) once the env vars above are set
in your shell.

---

## Appendix C — If a step fails

| Symptom                                  | Most likely cause                                     | Fix                                               |
| ---------------------------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| `ERR_UNKNOWN_BUILTIN_MODULE node:sqlite` | Node 20 vs pnpm 11 mismatch                           | Already fixed (Dockerfile uses `node:22-alpine`)  |
| `pnpm install` complains about lockfile  | Wrong pnpm version                                    | Use pnpm 9 (already pinned in Dockerfile.prod)    |
| `migrate.sh` exits 1                     | `DATABASE_URL` missing or DB unreachable              | Confirm MySQL plugin attached, var injected       |
| Healthcheck 503                          | Migration not complete, or env var missing at startup | `railway logs` -- check startup validation output |
| Vercel build fails                       | Frontend env vars unset                               | Set `NEXT_PUBLIC_TS_API_URL` first, then redeploy |
| WS connections drop                      | `FRONTEND_URL` mismatch                               | Match the exact origin (including scheme)         |

If anything else breaks, run `railway logs` first. The backend logs
structured pino events; every error has a request ID for correlation.
