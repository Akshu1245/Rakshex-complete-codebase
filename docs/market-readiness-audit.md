# Market-readiness audit

**Date:** 2026-07-12  
**Auditor role:** Principal engineer (code + tests as truth)  
**Verdict:** **Not market-ready for unconditional GA.** Core platform exists with substantial real code and automated tests. Launch requires staging journey sign-off, CI green on GitHub, and resolution of open blockers below.

---

## What is solid

- Monorepo with real `apps/api` backend (not missing).
- PostgreSQL migrations and package foundation tests.
- Auth hardening (Argon2id, RBAC, hashed API keys, tenant isolation tests).
- Deterministic scanner with fixture tests and explicit limitations.
- Secure import parsing with bomb/size protections.
- AgentGuard Node SDK privacy/fail-open/security contracts.
- Policy-as-code engine with immutability and dry-run.
- Versioned pricing engine with historical stability tests.
- CI design without `continue-on-error` on critical jobs.
- Docker non-root + healthchecks; Postgres backup/restore scripts.
- Kill switch enforced server-side on gateway evaluate + telemetry (fixed this pass).

## Issues (severity · evidence · component · repro · fix · blocking)

### Fixed this session

| Sev          | Issue                                     | Component                       | Fix                                                   |
| ------------ | ----------------------------------------- | ------------------------------- | ----------------------------------------------------- |
| **Critical** | Gateway trusted client `killSwitchActive` | `controlPlane.gateway.evaluate` | Load from `getKillSwitchSettings`; ignore client flag |
| **High**     | Telemetry ignored kill switch             | `telemetry.ingest`              | 403 when `isActive`                                   |
| **High**     | Docs claimed missing backend              | docs                            | repository-audit updated                              |

### Open

| Sev  | Issue                                 | Evidence                         | Component                  | Repro                                 | Recommended fix            | Blocking                 |
| ---- | ------------------------------------- | -------------------------------- | -------------------------- | ------------------------------------- | -------------------------- | ------------------------ |
| High | Primary journey not signed on staging | No recorded staging run          | Ops                        | Deploy staging; run RELEASE_CHECKLIST | Complete manual journey    | **Yes**                  |
| High | CI e2e not proven green on GH         | Local only                       | `.github/workflows/ci.yml` | Push branch; watch Actions            | Fix any first-run failures | **Yes** for release      |
| Med  | Billing live webhooks untested here   | No Stripe test keys in env       | payments                   | Checkout in test mode                 | Test-mode webhook suite    | If billing in cut        |
| Med  | GitHub App live PR e2e                | Needs app credentials            | githubCiScan               | Install app on test repo              | Credentialed e2e job       | If GH is launch critical |
| Med  | Kill switch user-scoped legacy        | schema killSwitchSettings.userId | multi-tenant KS            | Multi-workspace user                  | Migrate to workspace scope | Enterprise multi-WS      |
| Low  | DevPulse residual branding            | extension demoMode, strings      | VS Code / marketing        | Search DevPulse                       | Rebrand pass               | No                       |
| Low  | Web tRPC untyped                      | `apps/web/lib/trpc.ts` any       | web                        | typecheck web                         | Tighten types              | No                       |

---

## Gate results (local, this audit)

| Command                          | Result                                         |
| -------------------------------- | ---------------------------------------------- |
| `pnpm install --frozen-lockfile` | Pass                                           |
| `pnpm format:check`              | Pass (after format pass)                       |
| `pnpm lint`                      | Pass                                           |
| `pnpm typecheck`                 | Pass                                           |
| `pnpm test`                      | Pass (packages)                                |
| `pnpm test:security`             | Pass                                           |
| `pnpm test:integration`          | Pass                                           |
| `pnpm build`                     | Pass                                           |
| `docker compose` postgres/redis  | Healthy                                        |
| `pnpm test:e2e`                  | Not re-run full in this pass — **In progress** |
| `docker compose build` full      | Not mandatory every local cycle — operator     |
| `pnpm smoke:test`                | Requires running API                           |

Re-run all gates before any release tag.

---

## Migration status

- Applied series through **0009_findings_lifecycle** in foundation tests.
- Operators: `pnpm db:migrate` against target `DATABASE_URL`.

## Deployment status

- Compose + Dockerfile production paths aligned to monorepo.
- Staging workflow_dispatch present; production promotion requires green release-gate.

## Known limitations

See `packages/scanner-core/LIMITATIONS.md`, `docs/FEATURE_MATURITY.md`, `docs/implementation-status.md`.

## Explicit non-claims

- Not SOC 2 / ISO / GDPR certified by this software alone.
- Not patent-asserted.
- Not “production-ready for all customers” until open High blockers close.

## Next recommended action

1. Push branch; confirm **CI release-gate** green.
2. Stand up staging with real Postgres/Redis; run **RELEASE_CHECKLIST** primary journey.
3. If paid plans ship, run Stripe/Razorpay test webhooks.
4. Only then cut a release tag and update this audit verdict.
