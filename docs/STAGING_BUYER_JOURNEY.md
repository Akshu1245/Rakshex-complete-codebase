# Staging buyer journey checklist

Ops checklist for a staging (or pilot) environment before inviting a real buyer.
Mark items only after you have run them against the deployed staging stack.

## Prerequisites (operator)

- [ ] Staging API + web reachable over HTTPS
- [ ] `.env` / secret manager matches root `.env.example` critical vars (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `SMTP_*`, `METRICS_TOKEN`, `CORS_ORIGINS`, `GITHUB_WEBHOOK_SECRET`, `GITHUB_APP_*`)
- [ ] Migrations applied (`pnpm db:migrate` / deploy migrate job)
- [ ] Redis is real (not MockRedis) — `/metrics` and scan queues healthy

## Product path

1. [ ] **Signup** — create a new account (email/password or OAuth)
2. [ ] **Workspace** — personal workspace exists; create/select an org workspace if needed
3. [ ] **Invite** — invite a second user; accept invite link; confirm RBAC (viewer cannot admin)
4. [ ] **Import** — import a Postman/OpenAPI/Bruno collection into the workspace
5. [ ] **Scan** — run a scan; job completes without silent mock findings
6. [ ] **Findings** — open findings UI; filter/export at least one format
7. [ ] **Gateway** — store control-plane OpenAI credential → create `gateway:invoke` API key → `POST /v1/chat/completions` succeeds; flip workspace kill switch → next call returns 403
8. [ ] **Governance** — set a hard gateway budget; confirm monitor_only budgets never claim a RakshEx block
9. [ ] **Connectors** — sync Copilot or Cursor (or CSV import); identities appear under Team Governance
10. [ ] **Pay** — start checkout with `workspaceId`; webhook upserts `workspace_entitlements` (not only `users.plan`); replay webhook → duplicate, no double side effects
11. [ ] **Export / delete** — `/exports` prepare/download; exercise account/workspace delete or data-deletion path if offered

## Integration sign-off

- [ ] **SMTP** — invite + password-reset emails deliver (fail-closed if SMTP missing in production)
- [ ] **Payments** — test-mode keys only on staging; webhook signatures verified; amounts match provider dashboard; seats match plan catalog (Pro 5 / Enterprise 25)
- [ ] **GitHub App** — install URL resolves (`GITHUB_APP_SLUG` or numeric id); webhook rejects bad/missing signatures; no mock repos in staging/production
- [ ] **Legal** — `/terms`, `/privacy`, `/legal/dpa`, `/legal/sla`, and Legal Center downloads live; counsel/ops review tracked in `docs/operations/LEGAL_LAUNCH_SIGNOFF.md`
- [ ] **Deploy** — Render `preDeployCommand` migrate ran; worker + Redis healthy; `/api/health/live` used for liveness

## Security spot-checks

- [ ] Cross-tenant: user A cannot open user B collection/finding IDs (expect 403/404)
- [ ] CORS: unlisted origin cannot credentialled-fetch the API
- [ ] `/metrics` requires `METRICS_TOKEN` bearer

## Sign-off

| Role        | Name | Date | Notes |
| ----------- | ---- | ---- | ----- |
| Engineering |      |      |       |
| Ops / SRE   |      |      |       |
| GTM / Sales |      |      |       |

Related: [DEPLOY_RAILWAY_VERCEL.md](./DEPLOY_RAILWAY_VERCEL.md), [BETA_OPS_CHECKLIST.md](./BETA_OPS_CHECKLIST.md), [FEATURE_MATURITY.md](./FEATURE_MATURITY.md) (stale, see its own header note). `MARKET_READINESS_LAUNCH_BAR.md` was deleted 2026-08-05; `CLAUDE.md` is the current status doc.
