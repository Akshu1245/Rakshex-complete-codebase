# RaksHex — Phase 1 Follow-up (9 October 2026)

**Repository:** `Akshu1245/Rakshex-complete-codebase`
**Audited source reference:** `main` around `ab96df1` (do not assume later commits match).
**Scope:** safe, narrowly scoped code fixes and baseline documentation. Not a deploy, release, or production-ready declaration.

## Changes in this pack

1. **CSRF bypass guard:** a forged non-empty `x-api-key` header cannot skip double-submit CSRF validation. The request context now records that the SDK actually authenticated an API key, and only that verified condition bypasses CSRF. Existing API-key and cookie paths remain supported. Test file: `apps/api/_core/csrf.phase1.test.ts`.
2. **Approval result correctness:** Drizzle/Postgres may return an object containing `rows` or `rowCount`, rather than a raw array; use `affectedApprovalCount` to interpret `UPDATE ... RETURNING` correctly. Atomic `workspace_id` + `status='pending'` guards from the previous pack are preserved. Tests included.
3. **Production placeholders rejected:** deny the known `.env.example` placeholder and known development secret in the JWT and vault settings in production. This is a minimum bar, not proof of secret strength or rotation.
4. **Scan output privacy:** redact URL userinfo, query values and fragments before Postman URLs appear in findings/reports. Static query-key detectors still get parameter names. Does not imply comprehensive PII redaction of every payload or log.
5. **SDK default host consistency:** align TypeScript and Python telemetry SDK defaults to `https://api.rakshex.in`. Configurable gateway URLs still work. **Requires verifying DNS/back-end before claiming connectivity.**
6. **Demo honesty:** clearly indicate the judge scanner needs a reachable live API and does not prove market readiness; remove unsupported production-accuracy claims.
7. **Preserve upstream CI honesty:** installer rejects old/failing status override workflow. The current `main` disables it, so no workflow change is needed here.

## After installation: required checks

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm exec prettier --write apps/api/_core/context.ts apps/api/_core/trpc.ts apps/api/_core/env.ts apps/api/api/approvals.ts apps/api/api/approvalUpdateResult.ts packages/scanner-core/src/normalize.ts packages/sdk/src/client.ts apps/web/app/demo/judge/page.tsx
corepack pnpm --filter @rakshex/scanner-core test
corepack pnpm --filter @rakshex/cli test
corepack pnpm --filter @rakshex/api test
corepack pnpm run typecheck
corepack pnpm run lint
corepack pnpm run test:integration
corepack pnpm run test:security
corepack pnpm run format:check
git diff --check
```

The `python-sdk` tests must also run with its declared Python dependencies. Integration/security may require PostgreSQL and Redis. Record environmental BLOCKED statuses rather than marking them green.

## Confirmed remaining gaps / unverified items

- Real two-workspace approval evaluation (user A cannot read or approve user B's row), and investigation of legacy `ws_<userId>` versus numeric workspace approval identifiers.
- Run all package, integration, end-to-end, Docker and CI suites against a clean checkout; verify CI intentionally fails on a broken test.
- Backup-and-restore drill on an isolated database; rollback drill; remote deployment and health checks.
- Check production secret history / revoke actual exposed keys; requires owner's credentials and rotation controls.
- CLI publishability: package is still marked `private` and points the binary at TypeScript source. Do **not** advertise an npm release yet.
- GitHub Action currently requires live API access; offline Quick Scan + action flow remains Phase 2 work, not shipped by this patch.
- Real developers and benchmark datasets are not available in this environment; no scanner accuracy numbers or 5-user validation results are claimed.
- Firewall threat model is a design document until all listed mitigation tests are demonstrated. Provider credential bypass is NOT eliminated by simply reading keys from environment variables.

## Go/no-go

Do **not** merge or deploy just because this installer succeeds. Require test evidence and inspect the diff. Do not mark Phase 1 complete until all of its acceptance checks have passed.
