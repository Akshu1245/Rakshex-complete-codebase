# Implementation status — archived snapshot

> **Historical document. Superseded on 2026-08-28.**
>
> This file previously contained a 2026-07-30 "Market ready (code complete)" matrix and hard-coded pass claims. Those statements are not a safe current release signal because the product, Agent Firewall surfaces, Python SDK, runtime baseline, and release gates have changed since that snapshot.

For current status, use this precedence:

1. current source code,
2. the GitHub **CI Release gate** and independent **Security scan** for the exact commit,
3. root [`CLAUDE.md`](../CLAUDE.md),
4. root [`README.md`](../README.md),
5. root [`LAUNCH_CHECKLIST.md`](../LAUNCH_CHECKLIST.md).

Important changes since the old snapshot include:

- the Agent Firewall / AI Action Control Plane is the strategic core,
- Python source now includes `AgentFirewallClient`,
- Python SDK tests are part of the release gate,
- the declared/tested Node runtime is 24.x,
- provider-native governance capabilities remain capability-specific and may honestly be `NOT_IMPLEMENTED` or `NOT_CONFIGURED`,
- public/investor copy has been tightened to private-beta truth rather than blanket "production-ready" language,
- Vercel production promotion is tracked as deployment work rather than evidence that repository code is complete.

The old matrix remains available in Git history for archaeology; do not quote it as current evidence.
