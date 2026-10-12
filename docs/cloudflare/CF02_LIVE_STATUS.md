# RaksHex Cloudflare-first migration: verified CF-02 status

Recorded on 2026-10-12 against GitHub PR #201.

## Applied (isolated staging only)

- Uploaded `rakshex-core-staging` Cloudflare Worker from the Wrangler-generated
  bundle of `cloudflare/staging/core-worker.mjs`.
- The Worker imports the repository's original YC #13 deterministic engine:
  `packages/scanner-core/src/contractDiff.ts`. No duplicate detector.
- Deployed a private 32-byte generated `STAGING_API_KEY` Worker secret.
  Its value was not included in code, output or logs; rotate it in Cloudflare
  if a human or test client needs direct authenticated access.
- Enabled a staging-only workers.dev subdomain; no preview URLs.
- Executed the additive `0001_contract_diff_jobs.sql` statements against
  `rakshex-migration-staging` D1 **only**. The SQL was checked as applied.
  This direct SQL execution did not register Wrangler's migration metadata;
  do not assume the Wrangler migration journal is up to date.
- Attached the staging-only D1, KV, R2, Queue and secret bindings.
- Created `rakshex-migration-staging-dlq` for exhausted retries.
- Registered `rakshex-core-staging` as the consumer of the staging job queue
  (maximum batch 5, 3 retries). Existing `rakshex-firewall` consumer unchanged.
- A Cloudflare Browser Rendering HTTP check returned
  `{"service":"rakshex-cloudflare-core-staging","state":"partial","production":false}`
  from `https://rakshex-core-staging.rakshex.workers.dev/api/health`.
  Additional Browser Rendering checks were rate limited. Only that endpoint
  has been observed responding over real HTTPS.

## Frontend compatibility findings

- Ran the official `pnpm dlx vinext check` against `apps/web` (Next.js 16).
- Five inspected Next.js import families supported. Config: 7/9 compatible.
- **Blocker: `next-auth` is reported incompatible by vinext.** Login cannot
  be migrated or declared working until its adapter or replacement is
  implemented, and OAuth/session continuity tests pass.
- webpack customizations and `@sentry/nextjs` integration need parity checks.
- Do **not** swap the deployed `rakshex-web` production Worker or OAuth callbacks
  to this partial API. The existing production Worker has not been redeployed.

## Unresolved data source and platform gating

- The connected Railway workspace is DecisionTrace, not RaksHex. The original
  PostgreSQL customer records have **not** been accessed, exported, copied or
  migrated. Real legacy tenant and billing data must be recovered with consent.
- Existing Firewall D1 and its original action receipt chain remain unchanged.
- Cloudflare Containers reports a Workers Paid plan requirement on this account.
- `rakshex.in` DNS zone is not available from the connected Cloudflare account.

## Release safeguards

- Wrangler dry-run bundling passed; source package tests and staging runtime
  tests are executed in CI. Full release CI and Security scan remain mandatory.
- `STAGING_API_KEY` protects all business routes; health/capabilities reveal
  no credentials or customer data. Staging requires explicit authorization.
- The asynchronous job schema is new; it is **not** legacy PG data parity.
- Out-of-scope production endpoints deliberately return 501.
- No production traffic switch, production data write, or production deploy.

## Next gates

1. Merge PR #201 after full CI and Cloudflare-specific tests are green.
2. Add a vinext frontend build on a separate staging Worker and replace the
   unsupported NextAuth route with a compatible, tested session implementation.
3. Locate and independently restore the original RaksHex PG backup before
   importing customer data into a complete versioned D1 schema.
4. Port legacy API+queue contracts individually and test ledger signatures,
   multi-tenant RBAC, billing, credentials, retries and rollback.
5. Obtain control of domain DNS and perform a rehearsed staged cutover.
