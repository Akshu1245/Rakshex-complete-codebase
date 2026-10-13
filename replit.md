# DevPulse v4.0 — API Security & Cost Intelligence Platform

## Architecture

This is a full-stack application with two services:

### Frontend (`devpulse-dashboard-ui/`)
- **Framework**: Next.js 16 with React 19, TypeScript, Tailwind CSS v4
- **Port**: 5000 (Replit webview)
- **Start**: `cd devpulse-dashboard-ui && npm run dev`
- **API proxy**: Next.js rewrites `/api/*` → backend at `BACKEND_URL` (default: `http://localhost:8000`)

### Backend (`devpulse-backend/`)
- **Framework**: FastAPI with SQLAlchemy 2.0 async ORM
- **Port**: 8000 (console workflow)
- **Start**: `cd devpulse-backend && python main.py`
- **Database**: PostgreSQL via asyncpg (Replit-provided), falls back to SQLite for dev
- **Auth**: JWT-based authentication

## Workflows

| Name | Command | Port | Type |
|------|---------|------|------|
| Start application | `cd devpulse-dashboard-ui && npm run dev` | 5000 | webview |
| Backend API | `cd devpulse-backend && python main.py` | 8000 | console |

## Environment Variables

- `DATABASE_URL` — Provided by Replit PostgreSQL (auto-configured, asyncpg driver rewrite handled in `db_config.py`)
- `GROQ_API_KEY` — Required for AI endpoints (`/api/generate`, `/api/docs`)
- `JWT_SECRET` — JWT signing secret (defaults to dev value; set in production)
- `BACKEND_URL` — Frontend → backend URL (default: `http://localhost:8000`)
- `FRONTEND_URL` — CORS allowed origin (default: `http://localhost:5000`)
- Optional: `STRIPE_SECRET_KEY`, `SENDGRID_API_KEY`, `POSTHOG_API_KEY`, `SENTRY_DSN`, `REDIS_URL`

## Replit Migration Notes

- Removed Vercel/Mangum serverless handler — backend runs as a persistent FastAPI/uvicorn server
- `db_config.py` rewrites `postgresql://` → `postgresql+asyncpg://` and strips `sslmode` from URL (passes `ssl=False` via `connect_args`)
- CORS configured to allow `REPLIT_DOMAINS` environment variable domains
- Frontend dev server bound to `0.0.0.0:5000` for Replit proxy compatibility
