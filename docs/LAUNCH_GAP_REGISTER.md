# Launch Gap Register — archived snapshot

> **Superseded on 2026-08-28.**
>
> The previous 2026-07-30 register mixed repository verification with environment-specific Railway/Vercel state and ended with a blanket "Private beta / free self-serve: GO from code" conclusion. That is no longer the canonical release decision.

Use root [`LAUNCH_CHECKLIST.md`](../LAUNCH_CHECKLIST.md) for the current launch gate and root [`CLAUDE.md`](../CLAUDE.md) for the current engineering handoff.

Current rules that replace the old register:

- A release decision is made for an **exact commit**, not for the repository in general.
- The GitHub **Release gate** and independent **Security scan** must both be green on that commit.
- Node/runtime, Docker, TypeScript/Node tests, Python SDK tests, database migrations, E2E, dependency audit, secret scan, SBOM, and container scan are release evidence.
- External deployment state (DNS/TLS, database/Redis ownership, production secrets, SMTP, GitHub App, monitoring, billing, legal/tax/security review) must be verified in the target environment and is not inferred from source code.
- Provider-native governance capabilities remain capability-specific; structured `NOT_IMPLEMENTED`, `NOT_CONFIGURED`, and `UNAVAILABLE` states are honest product behavior.
- Vercel production promotion is intentionally deferred in the 2026-08-28 repository consolidation.

The detailed 2026-07-30 checklist remains available in Git history for historical comparison. Do not quote its checked boxes as current evidence.
