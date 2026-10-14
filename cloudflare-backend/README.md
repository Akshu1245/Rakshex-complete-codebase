# DevPulse backend on Cloudflare

## Zero-spend requirement (14 October 2026)

The owner requires free services only. Do not upgrade the account or enable paid resources. The Container configuration below is retained for reference; it is **not** the free deployment target.

Source optimizations are implemented, but the new application is **not live** on the free plan. See [FREE_PLAN.md](FREE_PLAN.md) for the runtime incompatibility, implemented savings, and remaining migration work. `RESOURCE_PROFILE=free` reduces work in FastAPI; it does not make Containers available on a free account.

## Provisioned infrastructure

- PostgreSQL project: `billowing-hat-28677330` (`rakshex-devpulse`), database `devpulse`, AWS Singapore. Default branch is `production`; no archived RaksHex data was reused.
- Alembic revisions through `002_onboarding_progress` were applied on 14 October 2026 (India time). All ORM tables and columns were verified through the database connector.
- Cloudflare Secrets Store: `7f1fc7c778ff41cab15f8726f1f51625`. Four active secrets are bound in `wrangler.jsonc`: database connection, JWT signing key, encryption key, frontend origin. Values are not committed.
- Worker code resolves Secrets Store values before starting FastAPI. Missing/unreadable configuration returns 503. Production rejects a default signing key and temporary SQLite storage.
- A temporary Cloudflare Worker successfully read all four secret bindings and queried the migrated Neon database over the serverless HTTP driver: `ok=true`, `secrets=true`, `database=true`. The probe was removed after verification. This verifies read-only edge connectivity, not the still-blocked FastAPI container deployment.

## Current deployment status

**Not live.** Cloudflare returned: `Unauthorized: You do not have access to Cloudflare Containers. Deploying containers requires the Workers Paid plan`.

This command path requires Workers Paid and must not be used for the owner's zero-spend deployment. Existing Cloudflare Workers and archived data were preserved.

The expected backend address after deployment is `https://rakshex-devpulse-backend.rakshex.workers.dev`. It is not currently a verified live endpoint.

## Frontend routing

Set frontend server variable `BACKEND_URL` to the deployed backend origin. HTTP requests use the same-origin Next.js runtime proxy; browser code must not receive an internal Docker hostname. CSV bodies, authorization headers, webhook signatures, and HTTP errors are preserved. `/health`, `/openapi.json`, and `/backend-docs` use this same proxy. `/connection-info` supplies the backend WebSocket address; HTTP health refresh remains available if a socket disconnects.

For hosted traffic use HTTPS; `ALLOW_HTTP_BACKEND=true` is reserved for the trusted local Docker network. The configured frontend origin is `https://rakshex-frontend.rakshex.workers.dev`; update the Secrets Store value if using a different frontend hostname.

## Provider-backed features

Core signup/trials, deterministic security scans and history, cost recording, budgets, onboarding, and CSV exports do not need model or payment keys. AI generation requires `GROQ_API_KEY` and a supported `GROQ_MODEL` (or the existing xAI configuration). Paid checkout requires Stripe keys, webhook signing secret, and real price IDs. Configure those as Worker secrets using secure prompts. All supported variables are passed through by `runtime-config.mjs`. Billing never grants a paid plan from a button click; a verified webhook triggers current provider-state reconciliation and an idempotent database receipt. No real payment/provider integration was exercised without credentials.

## Verification

CI checks Python integration tests, browser request contracts against OpenAPI, Next.js type checking/build/unit tests, Cypress browser flows, Cloudflare Worker binding/bundle tests, and a full Docker frontend/backend/PostgreSQL smoke flow.

The container remains limited to one instance because legacy background services and socket coordination are process-local. Background monitors sleep with the container; always-on scheduling, broader legacy-feature security review, and deployed provider/live end-to-end validation are separate outstanding launch gates. Source and local/CI tests are not proof of a production deployment.
