---
description: Production deployment workflow for Rakshex (Railway backend + Vercel frontend + VSCode Marketplace)
---

# Rakshex Production Deployment

## Prerequisites Verified

- [x] `railway` CLI 4.59.0 installed
- [x] `vercel` CLI 54.1.0 installed
- [x] `vsce` 3.9.1 installed
- [x] Backend `npx tsc --project tsconfig.server.json` builds clean (0 errors)
- [x] Frontend `pnpm run build` succeeds
- [x] VSCode extension `npm run esbuild` succeeds
- [x] `dist/server/_core/index.js` entry point exists
- [x] `/api/health` route is mounted in `server/_core/index.ts`
- [x] 23 SQL migration files present in `drizzle/`

## CRITICAL: Database is MySQL (not PostgreSQL)

The Drizzle schema uses `mysqlTable`, `mysqlEnum`, `drizzle-orm/mysql2`, and `mysql2/promise`.
**You must provision a MySQL database on Railway.** PostgreSQL will fail.

---

## Phase 1 — Railway Backend

### 1.1 Link Railway Project

```powershell
railway login
railway link
# Select your "rakshex-backend" project
```

### 1.2 Add MySQL Database

- Railway Dashboard → Add Service → **Template** → Search "MySQL"
- Or use: `railway add --database mysql`
- Railway auto-injects `DATABASE_URL` (verify it starts with `mysql://`)

### 1.3 Add Redis

- Railway Dashboard → Add Service → Database → Redis
- Or: `railway add --database redis`
- Auto-injects `REDIS_URL`

### 1.4 Set Environment Variables

Railway Dashboard → rakshex-backend → Variables tab. Paste these:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=<auto-injected by Railway MySQL>
REDIS_URL=<auto-injected by Railway Redis>
JWT_SECRET=<generate: openssl rand -hex 32>
FRONTEND_URL=https://rakshex.in
APP_URL=https://rakshex.in
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
RAZORPAY_KEY_ID=<from Razorpay dashboard>
RAZORPAY_KEY_SECRET=<from Razorpay dashboard>
RAZORPAY_WEBHOOK_SECRET=<from Razorpay dashboard>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<your Gmail>
SMTP_PASS=<Gmail app password>
SMTP_FROM=noreply@rakshex.in
SENTRY_DSN=<from Sentry project>
GATEWAY_SERVICE_TOKEN=<generate: openssl rand -hex 32>
INTERNAL_SERVICE_SECRET=<generate: openssl rand -hex 32>
```

### 1.5 Run Migrations

```powershell
# From monorepo root
.\scripts\migrate.ps1
```

### 1.6 Deploy Backend

```powershell
railway up --service rakshex-backend
railway logs --service rakshex-backend
```

Watch for:

- `Server listening on port 3000`
- `Database connected`
- `Redis connected`
- Zero uncaught exceptions

### 1.7 Get Public URL

Railway Dashboard → rakshex-backend → Settings → Networking → Generate Domain
Copy the URL (e.g. `https://rakshex-backend.up.railway.app`)

### 1.8 Health Check

```powershell
curl https://<your-railway-domain>/api/health
# Expected: {"status":"ok"}
```

---

## Phase 2 — Vercel Frontend

### 2.1 Login & Deploy

```powershell
cd rakshex-frontend
vercel --prod
```

Follow prompts:

- Link to existing project: **No**
- Project name: `rakshex-frontend`

### 2.2 Set Environment Variables

Vercel Dashboard → rakshex-frontend → Settings → Environment Variables:

```env
NEXT_PUBLIC_TS_API_URL=https://<your-railway-domain>
VITE_API_URL=https://<your-railway-domain>
VITE_APP_ENV=production
```

### 2.3 Redeploy

```powershell
vercel --prod
```

### 2.4 Update CORS in Railway

Railway Dashboard → rakshex-backend → Variables:
Update `FRONTEND_URL` to your Vercel URL (e.g. `https://rakshex-frontend.vercel.app`)

```powershell
railway up --service rakshex-backend
```

---

## Phase 3 — VSCode Extension

### 3.1 Create Publisher

- Go to https://marketplace.visualstudio.com/manage
- Sign in with Microsoft account
- Create publisher: `rakshex`

### 3.2 Create PAT

- Go to https://dev.azure.com
- User Settings → Personal Access Tokens → New Token
- Organization: All accessible organizations
- Scopes: Marketplace → Manage
- Copy token immediately

### 3.3 Login

```powershell
cd rakshex-vscode
vsce login rakshex
# Paste PAT when prompted
```

### 3.4 Build & Publish

```powershell
npm run esbuild
vsce package
vsce publish
```

Live URL: `https://marketplace.visualstudio.com/items?itemName=rakshex.rakshex`

---

## Phase 4 — Custom Domain (rakshex.in)

### 4.1 Point to Vercel

Registrar DNS:

- Type A, Name `@`, Value `76.76.21.21`
- Type CNAME, Name `www`, Value `cname.vercel-dns.com`

Vercel Dashboard → rakshex-frontend → Settings → Domains → Add `rakshex.in`

### 4.2 Point API to Railway

Railway Dashboard → rakshex-backend → Settings → Networking → Custom Domain
Add: `api.rakshex.in`
Railway shows a CNAME target — add it in DNS:

- Type CNAME, Name `api`, Value `<railway-provided-cname>`

Update Railway Variables:

```env
APP_URL=https://api.rakshex.in
FRONTEND_URL=https://rakshex.in
```

Update Vercel Variables:

```env
NEXT_PUBLIC_TS_API_URL=https://api.rakshex.in
VITE_API_URL=https://api.rakshex.in
```

Redeploy both services.

---

## Phase 5 — Smoke Test

- [ ] `GET /api/health` → `{"status":"ok"}`
- [ ] Frontend loads without blank screen
- [ ] Signup → user created in DB
- [ ] Login → JWT issued → dashboard loads
- [ ] WebSocket connects (browser Network → WS tab)
- [ ] Waitlist form submits successfully
- [ ] No CORS errors in console
- [ ] Redis connected (no fallback warnings in logs)
- [ ] BullMQ workers running (check Railway logs)
