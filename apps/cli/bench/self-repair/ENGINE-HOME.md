# Where the impact engine lives (decision)

- `main` of Rakshex-complete-codebase is the restored DevPulse app (Python/Next.js). It has **no** OpenAPI diff or call-site impact engine.
- The real engine is the TypeScript CLI on `archive/rakshex-pre-devpulse-20261013` (9ca85cf): `apps/cli/src/{apiDiff,oasdiffAdapter,apiImpact}.ts`.
- **Single home for detection + impact: `apps/cli` on the archive line** (these branches). This includes stripe-node SDK mapping (`stripeSdkImpact.ts`), payload evidence (`payloadEvidence.ts`) and the consumer-impact normalizer (`consumerImpact.ts`).
- `Akshu1245/rakshex-self-repair-sandbox` keeps only the *repair* half (bounded codemod, check runner, human-review gate, local draft-PR package). Its own `pipeline/src/locate.ts` is a demo-only duplicate and should be replaced by consuming `rakshex api diff --format json` → `consumerImpact.impacts` (file:line, sdkMethod, evidence, semanticWarning). Until then the sandbox README says so.
- Not decided here: whether the archive TS monorepo returns to `main`. That is a product/repo decision for Akshay.
