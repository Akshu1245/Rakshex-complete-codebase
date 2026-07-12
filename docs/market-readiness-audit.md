# Market-readiness audit

**Date:** 2026-07-12  
**Role:** Cofounder / principal engineer  
**Verdict:** **Launch-candidate (core platform).** Automated local gates including **live smoke against Postgres + Redis + API are green**. Not yet unconditional public GA until staging journey + remote CI release-gate are signed.

---

## What “market ready” means here

| Layer                                                     | Status                          |
| --------------------------------------------------------- | ------------------------------- |
| Product code for primary journey                          | **Present**                     |
| Security defaults (authz, hashed secrets, KS server-side) | **Present + tested**            |
| Local automated gates                                     | **Green** (this pass)           |
| Live health with real Postgres/Redis                      | **Green** (`smoke:test PASSED`) |
| Staging human journey                                     | **Operator**                    |
| Remote CI release-gate                                    | **Operator push**               |
| Live billing / GitHub App                                 | **Optional for free launch**    |

---

## Gate evidence (this session)

| Command                               | Result                       |
| ------------------------------------- | ---------------------------- |
| Docker postgres + redis healthy       | Pass                         |
| `pnpm db:migrate`                     | Pass                         |
| API listening `:3000` with Redis + DB | Pass                         |
| `pnpm smoke:test`                     | **Pass** — db/redis/queue ok |
| `pnpm format:check`                   | Pass                         |
| `pnpm lint`                           | Pass                         |
| `pnpm typecheck`                      | Pass                         |
| `pnpm test`                           | Pass                         |
| `pnpm test:security`                  | Pass                         |
| `pnpm test:integration`               | Pass                         |
| `pnpm build`                          | Pass                         |

Run anytime:

```bash
pnpm market:check   # requires API_URL if smoke included after stack up
```

---

## Critical product guarantees in code

1. **Kill switch is not dashboard-only** — DB + Redis cache; gateway evaluate ignores client flag; telemetry 403 when active.
2. **Passwords Argon2id; API keys hashed.**
3. **Workspace RBAC from DB; no client roles.**
4. **Deterministic scanner** with fixture tests.
5. **Secure import** blocks external `$ref` / bombs.
6. **Compliance reports disclaim certification.**
7. **CI designed without continue-on-error** on critical jobs.

---

## Remaining for unconditional GA

1. Push branch → GitHub Actions **release-gate** green.
2. Staging: signup → workspace → import → scan → findings → kill switch (see `RELEASE_CHECKLIST.md`).
3. Configure production secrets (JWT, DB, Redis, optional Stripe/GH).
4. Optional: full Playwright UI e2e with web on `:3001`.

---

## Honest non-claims

- Not SOC 2 / ISO certified by software alone.
- Live payment/GitHub App paths need credentials.
- Docker **full image build** may still be running/validating separately; compose **infra + API smoke** is proven.

---

## Cofounder recommendation

**Ship a private beta / waitlist launch now** if:

- You accept free-tier or manual billing first.
- You run staging checklist once.
- You keep kill switch and RBAC as documented.

**Do not** market “enterprise certified” or “fully production-ready for all regulated buyers” until staging + remote CI + optional compliance reviews complete.
