# DevPulse — Vercel Deployment Guide

This guide explains how to deploy the DevPulse monorepo (Next.js frontend + FastAPI backend) to Vercel.

## Architecture

- **Frontend** (`devpulse-dashboard-ui/`) — Next.js App Router, built as a standalone deployment
- **Backend** (`devpulse-backend/`) — FastAPI wrapped via Mangum as a Vercel serverless function at `api/index.py`
- **Routing** — All `/api/*` requests are proxied to the Python serverless function; everything else is served by Next.js

## Prerequisites

- A [Vercel](https://vercel.com) account
- A managed PostgreSQL database (e.g., [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres))
- A managed Redis instance (e.g., [Upstash Redis](https://upstash.com)) — optional, an in-memory fallback is used when `REDIS_URL` is not set

## Deployment Steps

### 1. Import the repository into Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repository.
2. Vercel will detect the root `vercel.json` automatically — no additional framework configuration is needed.

### 2. Set Environment Variables in Vercel

In **Project Settings → Environment Variables**, add the following:

| Variable | Description | Required |
|---|---|---|
| `GROQ_API_KEY` | Groq LLM API key ([console.groq.com](https://console.groq.com)) | Yes (for AI features) |
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql+asyncpg://user:pass@host/db` | Recommended |
| `REDIS_URL` | Redis connection string, e.g. `redis://default:pass@host:port` | Optional |
| `JWT_SECRET` | A long random string for signing JWTs | Yes |
| `FRONTEND_URL` | Your Vercel production URL, e.g. `https://devpulse.vercel.app` | Recommended |
| `ENV` | Set to `production` | Yes |
| `STRIPE_SECRET_KEY` | Stripe secret key (billing features) | Optional |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | Optional |
| `SENDGRID_API_KEY` | SendGrid API key (email features) | Optional |
| `SENTRY_DSN` | Sentry DSN for error tracking | Optional |
| `POSTHOG_API_KEY` | PostHog API key for analytics | Optional |

> **Note:** `VERCEL_URL` and `VERCEL_PROJECT_PRODUCTION_URL` are set automatically by Vercel and are used to configure CORS.

### 3. Deploy

Click **Deploy**. Vercel will:

1. Run `cd devpulse-dashboard-ui && npm install && npm run build` to build the Next.js frontend.
2. Package `api/index.py` and `api/requirements.txt` as a Python serverless function.
3. Route `/api/*` requests to the Python function and all other requests to the Next.js app.

## How the Monorepo Deployment Works

```
/                  → Next.js frontend (devpulse-dashboard-ui/)
/api/*             → Python serverless function (api/index.py → devpulse-backend/main.py)
```

The `api/index.py` entry point:
- Adds `devpulse-backend/` to `sys.path`
- Imports the FastAPI `app` from `devpulse-backend/main.py`
- Wraps it with [Mangum](https://mangum.fastapiexpert.com/) for ASGI-to-Lambda compatibility

## Database Migrations

Alembic migrations do **not** run automatically on Vercel. Run them manually before deploying:

```bash
cd devpulse-backend
DATABASE_URL=postgresql+asyncpg://... alembic upgrade head
```

Or connect to your managed database console and apply migrations there.

## Known Limitations

| Feature | Status | Notes |
|---|---|---|
| WebSocket endpoints (`/ws/*`) | ⚠️ Not supported | Vercel serverless functions do not support persistent WebSocket connections. Use a separate WebSocket service or a platform that supports long-lived connections (e.g., Railway, Fly.io). |
| Background tasks (`start_monitor`, `start_detector`) | ⚠️ Disabled | Serverless functions are stateless and short-lived. Background tasks are skipped when running under Mangum (`lifespan="off"`). Use an external scheduler (e.g., Vercel Cron Jobs, GitHub Actions) for periodic tasks. |
| PostgreSQL connection pooling | ℹ️ Configure carefully | Serverless functions open/close database connections on every invocation. Use a connection pooler (PgBouncer, Neon's built-in pooling, or Supabase's connection pooler) to avoid exhausting connection limits. |
| Redis | ℹ️ Optional | An in-memory LRU cache fallback is used when `REDIS_URL` is not set. For production, use Upstash Redis (serverless-compatible). |

## Local Development

Run the frontend and backend independently:

```bash
# Backend (terminal 1)
cd devpulse-backend
cp .env.example .env        # fill in your values
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (terminal 2)
cd devpulse-dashboard-ui
npm install
npm run dev                  # proxies /api/* → http://localhost:8000/api/*
```

The `next.config.ts` rewrites automatically proxy `/api/*` to `http://localhost:8000` in development mode.

## Environment Variables Reference

Full list of backend environment variables: [`devpulse-backend/.env.example`](devpulse-backend/.env.example)
