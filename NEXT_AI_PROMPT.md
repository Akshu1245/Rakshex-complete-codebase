# Prompt for the Next AI Session

Copy-paste the block below into a fresh Devin / Claude / Cursor session
along with the repo URL. The agent will be able to take the codebase
from "ready" to "live in production" without any further guidance.

---

## SYSTEM / USER PROMPT — copy this verbatim

> You are deploying the DevPulse monorepo to production.
>
> **Repo:** https://github.com/Akshu1245/devpulse-complete-codebase
>
> **Required reading (in this order):**
>
> 1. `LAUNCH_RUNBOOK.md` — full deploy sequence
> 2. `.env.example` — every env var the app understands
> 3. `Dockerfile` and `railway.toml` — backend build/run config
> 4. `devpulse-frontend/vercel.json` and `devpulse-frontend/next.config.js` — frontend build/proxy config
>
> **Your job:**
>
> 1. Clone the repo and run `pnpm install --frozen-lockfile`, then `pnpm run check`. Both must succeed before you proceed.
> 2. Execute the steps in `LAUNCH_RUNBOOK.md` in order:
>    - §1: Provision Railway (backend + MySQL + Redis), set env vars from Appendix A, run `scripts/one-command-deploy.sh` (or `railway up` then verify `/api/health`)
>    - §2: Provision Vercel for `devpulse-frontend/`, set the three `NEXT_PUBLIC_*` vars, `vercel --prod`
>    - §3: Add Cloudflare DNS records (`app.devpulse.in` → Vercel, `api.devpulse.in` → Railway)
>    - §4: Trigger `.github/workflows/publish-extension.yml` to publish the VSCode extension (requires `VSCE_PAT` repo secret)
>    - §5: Run the post-deploy smoke test commands
> 3. After every step, verify before moving on. If a step fails, **stop and report the exact error** — do not silently work around it.
> 4. If a required secret is missing, ask the user for it using the standard "skip / session-only / permanent" three-option pattern. Do not invent or hardcode secrets.
>
> **Constraints:**
>
> - Do **not** modify business logic in `server/` or `devpulse-frontend/` source. Only touch deploy config (`railway.toml`, `vercel.json`, `Dockerfile`) if a real deploy error forces it.
> - Do **not** add features. The audit is explicit: focus on deployment, not features.
> - Do **not** push to `main` directly. Open PRs for any code change.
>
> **When you're done:**
>
> - The public health endpoint at `https://api.devpulse.in/api/health` returns 200.
> - `https://app.devpulse.in` loads the dashboard.
> - The VSCode extension shows up in the marketplace under your publisher.
> - Reply with all three URLs and a one-line confirmation each is green.

---

## Secrets the next agent will need

If you (the human) are handing off to a new session, have these ready:

| Secret                                  | Where to get it                                                      | Required?                       |
| --------------------------------------- | -------------------------------------------------------------------- | ------------------------------- |
| `RAILWAY_TOKEN`                         | https://railway.app/account/tokens                                   | YES                             |
| `VERCEL_TOKEN`                          | https://vercel.com/account/tokens                                    | YES (for frontend)              |
| Resend / SMTP key                       | https://resend.com/api-keys                                          | YES (signup email)              |
| `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` | https://console.anthropic.com / https://platform.openai.com          | YES (AI features)               |
| `STRIPE_SECRET_KEY`                     | https://dashboard.stripe.com/apikeys                                 | YES if billing live             |
| `STRIPE_WEBHOOK_SECRET`                 | After creating a webhook endpoint in Stripe dashboard                | YES if billing live             |
| GitHub App `id` + PEM + webhook secret  | https://github.com/settings/apps/new                                 | YES for PR scanning             |
| `SENTRY_DSN`                            | https://sentry.io/settings/projects                                  | optional                        |
| `VSCE_PAT`                              | https://dev.azure.com → User Settings → PATs (Marketplace > Manage)  | YES for extension publish       |
| Cloudflare API token                    | https://dash.cloudflare.com/profile/api-tokens (Zone:DNS Edit scope) | optional (can edit DNS by hand) |

---

## Why this prompt exists

The DevPulse codebase is engineering-complete (596 tests pass, lint
clean, Dockerfile builds on Node 22). The remaining work is purely
operational: provisioning accounts and clicking "deploy". This prompt
removes the guesswork so any competent agent can finish that work in one
session.

---

## Known issue (CI workflow edit needs a token with `workflow` scope)

The `Trivy Security Scan` job in `.github/workflows/ci.yml` currently
fails because `docker/metadata-action` is tagging images with a short
SHA (`sha-abc1234`) while Trivy looks for the full SHA
(`sha-<40 chars>`). This was preexisting before any deploy work.

**One-line fix** — change line ~208 in `.github/workflows/ci.yml`:

```diff
           tags: |
-            type=sha,prefix=sha-
+            type=sha,prefix=sha-,format=long
             type=ref,event=branch
             type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}
```

Apply this directly on GitHub (web UI -> edit -> commit) or with a PAT
that has the `workflow` OAuth scope. The Devin git proxy intentionally
blocks workflow file edits, so this has to be done by a human or a
token with that scope.

This does not block deployment — Trivy is marked `optional` in CI and
the actual build/push still produces a valid image.
