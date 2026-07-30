# Market-readiness audit

**Date:** 2026-07-30  
**Role:** Cofounder / principal engineer  
**Verdict:** **Market ready (code complete)** for private beta, waitlist launch, and self-serve free/Pro. Automated local gates and product surfaces are complete. Not unconditional public GA for regulated enterprise until staging journey + live billing keys + legal entity sign-off.

---

## What “market ready” means here

| Layer                                                     | Status                                      |
| --------------------------------------------------------- | ------------------------------------------- |
| Product code for primary journey                          | **Complete**                                |
| Security defaults (authz, hashed secrets, KS server-side) | **Present + tested**                        |
| Local automated gates                                     | **Green**                                   |
| Live health with real Postgres/Redis                      | **Green when stack up**                     |
| Feature maturity (all shippable surfaces)                 | **Available** (see FEATURE_MATURITY.md)     |
| Residual branding / DevPulse                              | **Cleaned**                                 |
| Staging human journey                                     | **Operator**                                |
| Remote CI release-gate / branch protection                | **Operator push + GitHub settings**         |
| Live billing / GitHub App secrets                         | **Optional for free launch; required for paid** |

---

## Critical product guarantees in code

1. **Kill switch is not dashboard-only** — DB + Redis cache; gateway evaluate ignores client flag; telemetry 403 when active; workspace/project/agent scopes in enforcement engine.
2. **Passwords Argon2id; API keys hashed.**
3. **Workspace RBAC from DB; no client roles.**
4. **Deterministic scanner** with fixture tests (`packages/scanner-core`).
5. **Secure import** blocks external `$ref` / bombs.
6. **Compliance reports disclaim certification.**
7. **CI designed without continue-on-error** on critical jobs.
8. **Fail-closed** production paths: Redis required, email without SMTP, GitHub without App credentials, CORS explicit allowlist.

---

## Remaining for unconditional public GA (operator)

1. Push / protect `main` → GitHub Actions release-gate green.
2. Staging: signup → workspace → import → scan → findings → kill switch → data export (see `RELEASE_CHECKLIST.md` / `STAGING_BUYER_JOURNEY.md`).
3. Configure production secrets (JWT, vault, DB, Redis, SMTP, CORS, site URLs).
4. Optional: live Stripe/Razorpay + real payment/refund test.
5. Optional: full Playwright run against staging web.
6. Legal entity / GST / grievance officer / authorised signatory.

---

## Honest non-claims

- Not SOC 2 / ISO certified by software alone.
- Live payment/GitHub App paths need credentials.
- Multi-workspace personal kill-switch settings remain user-scoped for backward compatibility; gateway enforcement is multi-scope.

---

## Cofounder recommendation

**Launch private beta / waitlist / free self-serve immediately.**  
Marketing claims allowed: “AI runtime governance — prompt injection blocking, LLM cost control, shadow API discovery, policy-as-code, AgentGuard SDKs, kill switch.”  
Marketing claims **not** allowed until operator complete: “SOC 2 certified”, “enterprise production-ready for all regulated industries”, “fully live paid checkout proven”.

Full declaration: `docs/MARKET_READY_COMPLETE.md`.
