# Cloudflare full dashboard — staging deployment status

## What is actually verified

- The full Next.js dashboard runs in a local Cloudflare workerd runtime with vinext and the Cloudflare Vite plugin.
- The public existing backend Worker responds: `GET /health` 200, unauthenticated `GET /api/auth/me` 401 and `GET /api/dashboard` 200. These status checks are not authenticated end-to-end acceptance.
- The local Cloudflare frontend runtime, configured with a fixed HTTPS backend origin, returns 200 for the homepage, 200 for proxied `/health`, and 401 for unauthenticated `/api/auth/me`.
- Production WebSocket rewriting to `127.0.0.1` was removed. WebSockets are **not yet supported** by this new Worker preview.
- Server-side production proxy origin validation now rejects HTTP, localhost/private IPs, same-origin loops, credentials and origin paths; the browser defaults to same-origin API calls.
- Next.js 16.4.2 and React 19.3.1 were committed after the frontend regression tests, TypeScript checks, standard Next.js build and production dependency audit passed.
- GitHub Actions Cloudflare staging pipeline built and passed all local checks, but **remote deployment was skipped because GitHub Actions has no `CLOUDFLARE_API_TOKEN` or `CF_API_TOKEN` secret**.
- Earlier isolated P1/P2 review Worker remains live at https://rakshex-impact-review-staging.rakshex.workers.dev/.

## Required action for remote staging deployment

The repository administrator must create a **scoped Cloudflare API token**, restricted to the relevant account and Worker deployment operations (not a global API key). Store it directly in:

GitHub repository → Settings → Secrets and variables → Actions → New repository secret.

Secret name: `CLOUDFLARE_API_TOKEN`.

Do not paste the token into a GitHub issue, a public chat, PR, commit, plaintext file or the UI. This action has **not** been performed.

Once the secret exists, retrigger **Deploy full dashboard to isolated Cloudflare staging** on `integration/self-repair-engine` by a controlled workflow run or a reviewed integration-branch change. The workflow deploys only `rakshex-nextjs-runtime-staging`; it does not overwrite `rakshex-frontend`, `rakshex-free-backend` or `rakshex-devpulse-backend`, and does not alter DNS.

After staging deployment, complete real browser tests: login, API requests, session isolation, mobile layout, report preview and source egress. Real customer beta launch must still wait for those checks and user consent.

## Still blocked beyond staging

- Full production authentication and data isolation are not proven by the unauthenticated smoke probes.
- Backend has existing Cloudflare Workers, but feature coverage parity with the prior FastAPI/SQLAlchemy system has not been independently verified.
- The staging UI still uses manual local P1/P2 report import; no authenticated live feed has been enabled.
- Any remaining development-only dependency advisories require separate remediation and exception review.
- `rakshex.in` nameserver activation and record cutover are postponed; preserve Lark MX/SPF/DKIM/DMARC.
- Vercel project settings could not be changed because the connected Vercel account lacks access to the team's scope. Do not delete Vercel until Cloudflare production functionality is verified.

## Evidence

- Worker runtime with backend: https://github.com/Akshu1245/Rakshex-complete-codebase/actions/runs/39392217521
- Patched dependency audit: https://github.com/Akshu1245/Rakshex-complete-codebase/actions/runs/39391898785
- Cloudflare backend public probe: https://github.com/Akshu1245/Rakshex-complete-codebase/actions/runs/39391445688
- P1 synthetic Orders acceptance: https://github.com/Akshu1245/Rakshex-complete-codebase/actions/runs/39391215218
