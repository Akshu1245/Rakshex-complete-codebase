# DevPulse backend on Cloudflare

## Provisioned infrastructure

- PostgreSQL project: `billowing-hat-28677330` (`rakshex-devpulse`), database `devpulse`, AWS Singapore. Default branch is `production`; no archived RaksHex data was reused.
- Alembic revisions through `002_onboarding_progress` were applied on 14 October 2026 (India time). All ORM tables and columns were verified through the database connector.
- Cloudflare Secrets Store: `7f1fc7c778ff41cab15f8726f1f51625`. Four active secrets are bound in `wrangler.jsonc`: database connection, JWT signing key, encryption key, frontend origin. Values are not committed.
- Worker code resolves Secrets Store values before starting FastAPI. Missing/unreadable configuration returns 503. Production rejects a default signing key and temporary SQLite storage.

## Current deployment status

**Not live.** Cloudflare returned: `Unauthorized: You do not have access to Cloudflare Containers. Deploying containers requires the Workers Paid plan`.

Enable Workers Paid on account `b3225f198c6d2286afbb6f416c230f10`, then deploy from this directory with `npm ci --workspaces=false` and `npm run deploy` (Docker must be available). Wait for container provisioning. Existing Cloudflare Workers and archived data were preserved.

The expected backend address after deployment is `https://rakshex-devpulse-backend.rakshex.workers.dev`. It is not currently a verified live endpoint.

## Frontend routing

Set frontend server variable `BACKEND_URL` to the deployed backend origin. HTTP requests use the same-origin Next.js runtime proxy; browser code must not receive an internal Docker hostname. CSV bodies, authorization headers, webhook signatures, and HTTP errors are preserved. `/health`, `/openapi.json`, and `/backend-docs` use this same proxy. `/connection-info` supplies the backend WebSocket address; HTTP health refresh remains available if a socket disconnects.

For hosted traffic use HTTPS; `ALLOW_HTTP_BACKEND=true` is reserved for the trusted local Docker network. The configured frontend origin is `https://rakshex-frontend.rakshex.workers.dev`; update the Secrets Store value if using a different frontend hostname.

## Provider-backed features

Core signup/trials, deterministic security scans and history, cost recording, budgets, onboarding, and CSV exports do not need model or payment keys. AI generation requires `GROQ_API_KEY` and a supported `GROQ_MODEL` (or the existing xAI configuration). Paid checkout requires Stripe keys, webhook signing secret, and real price IDs. Configure those as Worker secrets using secure prompts. All supported variables are passed through by `runtime-config.mjs`. Billing never grants a paid plan from a button click; a verified webhook triggers current provider-state reconciliation and an idempotent database receipt. No real payment/provider integration was exercised without credentials.

## Verification

CI checks Python integration tests, browser request contracts against OpenAPI, Next.js type checking/build/unit tests, Cypress browser flows, Cloudflare Worker binding/bundle tests, and a full Docker frontend/backend/PostgreSQL smoke flow.

The container remains limited to one instance because legacy background services and socket coordination are process-local. Background monitors sleep with the container; always-on scheduling, broader legacy-feature security review, and deployed provider/live end-to-end validation are separate outstanding launch gates. Source and local/CI tests are not proof of a production deployment.
