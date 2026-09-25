# Team A — Publish Checklist (commercial surface)

**Status: publish-ready, NOT published.** Nothing below has been pushed to any
registry. Every item names its boss-side blocker explicitly.

## 1. Python — `rakshex` on PyPI

- [x] `pyproject.toml`: distribution name `rakshex` (verified unclaimed 2026-09-23),
      version `0.2.0`, MIT, stdlib-only deps, README + LICENSE included
- [x] `python -m build` → sdist + wheel built; `twine check` PASSED (2026-09-25)
- [ ] `twine upload dist/*` — **BLOCKED: needs boss's PyPI account** (2FA-enabled,
      API token via secure capture page — never chat)
- [ ] Verify `pip install rakshex` in a clean venv; confirm `rakshex` import works

## 2. npm — `@rakshex/sdk` + CLI

- [x] `packages/sdk` publish-ready packaging (commit `f323852`)
- [x] `apps/cli`: un-privated, `bin.rakshex → dist/index.js`, `publishConfig.access=public`,
      `prepublishOnly: build + test`, keywords/description/repository set
- [x] `packages/{config,policy-engine,scanner-core}`: publish metadata added
- [ ] `npm publish --access public` for `@rakshex/sdk` — **BLOCKED: needs boss's npm account**
- [ ] `npx rakshex init` smoke test from a clean machine after publish
- [ ] Decide: publish CLI as `rakshex` (if name free) or keep `@rakshex/cli` + `npx`

## 3. CLI one-click flows (verified 2026-09-25)

- [x] `rakshex init` — 3 plain-language questions → workspace, agent key (`rk_…`),
      permission slip, policy, receipt keypair, auto idempotency key. Real flow driven.
- [x] `rakshex local` — generates `.env` secrets itself, `docker compose up`, waits
      for health check. (Not driven here — needs Docker daemon; drive on a Docker host.)
- [x] `rakshex demo` — ₹10,000 refund DENY'd with signed receipt; ₹100 → approval
      card → human approves/denies → signed receipt; bundle written. Real flow driven.
- [x] `rakshex verify <bundle>` — offline Ed25519 + hash-chain check. Real flow driven:
      `VALID — 3 entries, hash chain intact, all Ed25519 signatures check out.`
- [x] Tests: `apps/cli` 10/10 green (`pnpm test`)
- [x] Display bug fixed: demo printed `₹8,30,000` for a ₹10,000 attempt (INR×83
      double conversion); now prints `₹10,000`

## 4. Hosted gateway — `api.rakshex.in`

- [x] Caddyfile: `api.rakshex.in → api:3000` reverse proxy + auto HTTPS + HSTS
- [x] `deploy-production.sh`: builds + launches prod compose, health-checks
- [ ] DNS: A/CNAME `api.rakshex.in` → host — **BLOCKED: needs boss's DNS access**
- [ ] Hosting decision: VPS vs Railway/Render/Fly + managed Postgres/Redis —
      **BLOCKED: boss decision**
- [ ] Abuse-proof the free-tier demo BEFORE first signup: rate limits, per-workspace
      ceilings, demo mode can never move real money (CLI already enforces locally)

## 5. Billing — Razorpay (INR) + Paddle (global)

- [x] Razorpay: plans, subscriptions, webhook processor with claim-first idempotency
      (`apps/api/payments.ts`, `services/billing/razorpayWebhook.ts`)
- [x] Paddle: env wiring (`PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`), webhook processor
      with signature verification (ts/h1 HMAC-SHA256, 5-min skew reject), shared
      idempotency table, entitlement via `applyPlanEntitlement`
      (`services/billing/paddleWebhook.ts`) — 9/9 tests green
- [ ] Razorpay account (KYC + settlement bank) — **BLOCKED: boss**
- [ ] Paddle account (global merchant-of-record) — **BLOCKED: boss**
- [ ] Register Paddle webhook URL in Paddle dashboard; pass
      `custom_data: { workspace_id, user_id, plan }` at checkout
- [ ] Pricing page tiers: page exists (`/pricing`) but carries pre-pivot
      Free/Pro/Enterprise scanner-era copy. Repricing to the §b draft
      (Free $0 / Solo $29 / Team $99 / Enterprise custom, per gated action, never
      per seat, INR anchors ₹499/₹999/₹2,499 + GST) touches server PLAN_CONFIG,
      entitlements, and webhook plan mapping — **needs boss's explicit pricing
      approval first (report §e-2)**. Do not change prices unilaterally.

## 6. M0 unblocks (boss-side, still open)

- [ ] GitHub push to `akshu1245/rakshex-complete-codebase` — **BLOCKED: token belongs
      to HarshithaSatthish (no write access). Needs collaborator grant or akshu1245's
      own token via secure capture page; rotate all pasted tokens.**
- [ ] Terms + Privacy Policy before public signup (even template-grade)
- [ ] Billing entity decision (RaksHex vs Rashi Technologies; sole-prop now vs Pvt Ltd later)
- [ ] Test provider keys (OpenAI + Anthropic admin) in vault for metering tests

## Test evidence (2026-09-25)

| Check | Result |
|---|---|
| `apps/cli` build (`tsc -p tsconfig.build.json`) | clean |
| `apps/cli` tests | 10/10 pass |
| `rakshex init` (piped answers, isolated HOME) | workspace created, key/policy/receipt keys written |
| `rakshex demo` (approve path) | ₹10,000 DENY receipt + ₹100 APPROVED receipt |
| `rakshex demo` (deny path) | human deny → blocked, receipt signed |
| `rakshex verify <bundle>` | VALID, 3 entries, chain + signatures check out |
| Paddle webhook tests | 9/9 pass |
| `python -m build` + `twine check` (`rakshex` 0.2.0) | PASSED |
| Anti-Slop | no Python files changed — not run (rule: changed files only) |
| New third-party deps | none — SkillSpector scan not required |
