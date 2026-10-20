# engine/ — RaksHex Self-Repair engine

Imported into the DevPulse repo as a self-contained pnpm workspace so the DevPulse app (repo root, npm) is untouched.

| Path | Origin |
|---|---|
| apps/cli, packages/scanner-core, packages/config | `archive/rakshex-pre-devpulse-20261013` @ 9ca85cf (snapshot) |
| apps/cli API impact / benchmark | PR #242 (bench/self-repair-accuracy-harness) |
| apps/cli stripe-node SDK-aware impact | PR #243 (feat/stripe-sdk-aware-impact) |
| packages/self-repair | risk / patch / checks / report / approval (from the self-repair sandbox pipeline) |

```
cd engine && pnpm install && pnpm typecheck && pnpm test
```
Nothing here deploys anything or calls a real provider. Benchmarks use pinned, SHA-256-verified public Stripe OpenAPI specs.
