# RaksHex Phase 1 fix pack — 2026-10-08

**Target:** `Akshu1245/Rakshex-complete-codebase` starting at commit `7aa02a2` on the user-created `rakshex-2` branch. This is an **unverified candidate patch**, not a release. Main was not edited. The patcher checks known source anchors and will refuse to apply against unknown/drifted files.

## Candidate fixes included

1. `.github/workflows/ci.yml`: explicitly run CI on pushes to `rakshex-2`.
2. `.github/workflows/vercel-api-skip-status.yml`: poll until the mislinked Vercel API project fails, then mark the GitHub status skipped (API runs on Railway). Long-term: disconnect legacy Vercel API project in settings.
3. `apps/cli/src/index.ts`: use ESM-safe YAML parser, fail exit code 2 on malformed inputs even when other files scan, fail invalid `--format`, protect config file permissions on POSIX systems, redact API keys from CLI configure output, accept environment variable keys for optional upload.
4. `deploy-production.sh`: never silently copy sample secrets, run migrations with a real exported `DATABASE_URL`, and fail on migration/health-check errors. Deployment is intentionally more strict; this is not tested against a live server.
5. `apps/api/middleware/policyEnforcement.ts`: explicit **deny** for policy `redact` until actual gateway redaction exists, avoiding silent allowance. This is a conservative behavior change and needs gateway regression tests.
6. `apps/api/api/approvals.ts`: atomic approve/reject is bound to user-owned `ws_<user id>` and pending status, with `RETURNING` check. **Important limitation:** this only hardens the _existing legacy user-owned workspace_ model. Organization/multi-member workspace approval support requires separate redesign/authorization tests; do not represent this as a complete tenant isolation fix.
7. `apps/web/app/demo/page.tsx`: explicitly state local decisions and hashes are simulated, not live credentials or real signed evidence.
8. Tests: add 18 static scanner golden scenarios + secret redaction tests; new child-process CLI tests (JSON, YAML, SARIF, exit codes and 10 MB input), plus policy redaction regression tests.

## Before merge: mandatory checks

```
pnpm install --frozen-lockfile
pnpm --filter @rakshex/scanner-core test
pnpm --filter @rakshex/cli test
pnpm run typecheck
pnpm run lint
pnpm run format:check
pnpm run test:integration
pnpm run test:security
```

Run tests from a clean checkout with PostgreSQL/Redis where needed. Test approval cross-workspace denial and real gateway redaction behavior before a deploy. Deliberately failing CI must actually remain failed. Keep `main` unchanged until tests pass.

**Still open:** production database recovery/restore drill, true user-workspace membership model for legacy approvals, preflight threat scanning, fully verified static scanner accuracy, npm publishing/release signing, frontend/browser scanner, and hosted backend restoration. No false claims of these items being done.
