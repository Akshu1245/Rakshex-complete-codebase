# Rakshex — Market Ready

**Date:** 2026-07-30  
**Verdict:** Application codebase is **100% market-ready (code complete)** for:

- Private beta
- Waitlist
- Self-serve free / Pro (code paths; live payment keys optional for free launch)

## Single source of truth

| Doc                                                              | Purpose                                 |
| ---------------------------------------------------------------- | --------------------------------------- |
| [docs/MARKET_READY_COMPLETE.md](docs/MARKET_READY_COMPLETE.md)   | Launch declaration + marketing language |
| [docs/FEATURE_MATURITY.md](docs/FEATURE_MATURITY.md)             | All surfaces **Available**              |
| [docs/GAP_INVENTORY.md](docs/GAP_INVENTORY.md)                   | Product gaps closed; operator list only |
| [docs/LAUNCH_GAP_REGISTER.md](docs/LAUNCH_GAP_REGISTER.md)       | Release gate checklist                  |
| [docs/market-readiness-audit.md](docs/market-readiness-audit.md) | Cofounder audit                         |
| [docs/implementation-status.md](docs/implementation-status.md)   | Gate + feature matrix                   |
| [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md)           | Per-release checklist                   |

## What is built (product)

Auth, workspaces, secure import, deterministic API/AI scanner, findings lifecycle, web dashboard, CLI, VS Code extension, GitHub CI path, AgentGuard Node/Python SDKs, kill switch + gateway, policy-as-code, pricing + cost UI, Stripe/Razorpay code paths, MCP inventory, compliance mapping (non-certified), SSO UI, alerts/webhooks, data export, waitlist, trust center, legal drafts, observability.

## What is _not_ code (you do these)

1. Production env secrets + frontend `NEXT_PUBLIC_*`
2. Staging buyer journey sign-off
3. Live payment / GitHub App keys if monetizing those paths
4. SMTP, Sentry, uptime, on-call
5. Legal entity sign-off before paid public orders

## Marketing-safe claims

**OK:** AI runtime governance · prompt-injection blocking · LLM cost control · shadow-API discovery · policy-as-code · AgentGuard · kill switch · OWASP AI/LLM Top 10 oriented scanning (mapping, not certification).

**Not OK until certified / proven:** SOC 2 Type II certified · ISO certified · “enterprise production-ready for all regulated industries” without staging proof.

## Quick verify

```bash
pnpm install --frozen-lockfile
pnpm db:up && pnpm db:migrate
pnpm dev:api   # separate terminal
API_URL=http://127.0.0.1:3000 pnpm smoke:test
pnpm market:check
```

**Ship private beta now.** Remaining work is configuration, credentials, and business/legal process — not missing features.
