# Cloudflare free runtime

This deployment uses the existing DevPulse application from `devpulse-backend` and `devpulse-dashboard-ui`. It does not start a Container or upgrade the account.

## Architecture

- The existing Next.js UI is exported as static assets. A small JavaScript Worker owns `/api/*`, `/health`, `/openapi.json`, `/backend-docs`, `/connection-info`, and WebSocket forwarding. API errors never fall back to the HTML shell.
- A Python Worker routes requests into session-coordinating SQLite-backed Durable Objects. The original FastAPI handlers run there. Plain Python Workers exceeded the free HTTP CPU allowance in live testing; Durable Objects provide a different CPU budget available on the free plan.
- Session actor names are hashes of routing credentials, not authorization grants. FastAPI still validates signatures and persisted account/team membership. Anonymous actor routing uses the trusted connecting IP.
- SQLAlchemy's existing ORM statements run through an awaitable synchronous-session facade and pg8000/Hyperdrive, avoiding the unsupported greenlet-based async bridge. Connections are request-scoped and driver operations are serialized. Original asyncpg hosting remains supported.
- JWT/encryption secrets remain private Secrets Store bindings. Request-local ContextVars prevent credentials from being shared through global environment mutation. Hyperdrive holds database credentials; they are not in source.
- D1 stores public health snapshots and atomic per-user/IP fixed-window request counters. Re-login and actor eviction do not reset counters. Health probes use a shared five-minute Durable Object lease and can refresh on first viewing; schema checks have an hourly lease. No infinite background startup loops run per request.
- PostgreSQL `pgcrypto` hashes/verifies passwords with bcrypt cost 12, preserving the native server's cost. New API-key records use standard, versioned AES-256-GCM through Web Crypto on Workers and `cryptography` on native Python. Existing codec helpers remain solely for compatibility.

## Resources

| Resource | Production | Isolated preview |
|---|---|---|
| Frontend Worker | `rakshex-frontend` | `rakshex-free-frontend-preview` |
| Backend Worker | `rakshex-free-backend` | `rakshex-free-backend-preview` |
| Hyperdrive | `1379ebde7849424392f78185001d561f` | `8bf9a0067a3d45a79d7bd676b68670c3` |
| D1 | `rakshex-free-runtime` | `rakshex-free-health-preview` |
| PostgreSQL branch | `br-dark-bonus-b316fzxm` | `br-morning-tree-b39ngwvp` |

Both branches use database `devpulse` in project `billowing-hat-28677330`. Revision `003_worker_password_crypto` adds the extension without dropping shared extensions on rollback. Existing RaksHex Workers/databases are preserved.

## Build and deployment

Install root npm dependencies and backend Python requirements first. Stage the backend with `python cloudflare-free/build_backend.py`; run `uvx --from workers-py==1.17.7 pywrangler deploy --dry-run` from `cloudflare-free/backend/build`. The lock file pins the vendored Python packages. Actual deployment requires an authorized Cloudflare connection or CLI session.

Build the UI with `python cloudflare-free/build_frontend.py`. Deploy the gateway/assets with the configuration in `cloudflare-free/frontend/wrangler.jsonc`. `wrangler.preview.jsonc` records isolated resource bindings. The backend config uses Cloudflare's declarative SQLite class exports through metadata; preserve the live `AppSession` declaration on later uploads/settings updates.

Check both database implementations with the backend suite normally and with `TEST_SYNC_DATABASE=true`. Run `node --test cloudflare-free/frontend/worker.test.mjs`, frontend unit tests/typecheck/build and `python scripts/check_browser_contracts.py`. Then verify deployed signup/login, account isolation, scan/history, costs, onboarding, key storage, reports and health before changing routing.

## Operational boundaries

Free quotas remain finite and stop operations when exhausted; this is not unlimited capacity or a load-test certification. Public assets avoid application execution; hidden/offline tabs stop polling. The current ASGI WebSocket handler keeps its actor active while connected, so keep the existing visibility cleanup and conservative refresh cadence. A hibernation-specific WebSocket implementation would reduce duration further.

Model generation, email delivery and payment-provider operations require real provider configuration and were not enabled using paid credentials. Deterministic scans, persistence, cost accounting and CSV reports do not require an LLM. Provisioning this runtime does not prove every optional legacy integration works.

The previous frontend version `0b26d578-1292-41b9-8eac-77f9dae586c0` remains the pre-migration rollback point. Keep schema changes additive and preserve the signing/encryption keys.
