# Cloudflare-first runtime migration — CF-02

This is an **incremental runtime migration**, not the full replacement API.

## Implemented in staging code

- `core-worker.mjs` imports the **existing** deterministic OpenAPI diff engine from
  `packages/scanner-core/src/contractDiff.ts` (no duplicated algorithm).
- Readiness checks require the new `contract_diff_jobs` table in **staging D1 only**.
- `POST /api/v1/contract-diff`: authenticated bounded, deterministic synchronous diff.
- `POST /api/v1/contract-diff/jobs`: authenticated enqueue, D1 job row and queue processing.
- `GET /api/v1/contract-diff/jobs/:id`: authenticated polling, no tenant PII stored.
- `GET /api/v1/capabilities`: explicit partial capability disclaimer.
- All other business endpoints return `501 NOT_MIGRATED`; no false success.
- `cloudflare/staging/migrations/0001_contract_diff_jobs.sql` is additive only.
- `STAGING_API_KEY` is **required**, at least 32 characters, Worker secret only. No default.
- Queue messages are at-least-once, D1 status updates are idempotent and jobs have a DLQ.
  **No production scanning or billing side effects are performed**.

## Staging setup after CI passes

```bash
# From repository root. Run only against the RaksHex Cloudflare account.
pnpm dlx wrangler d1 migrations apply rakshex-migration-staging --remote --config cloudflare/staging/wrangler.core.toml
pnpm dlx wrangler secret put STAGING_API_KEY --name rakshex-core-staging
pnpm dlx wrangler deploy --config cloudflare/staging/wrangler.core.toml
```

Note: This config builds a local import of TypeScript from the monorepo via Wrangler's bundler.
Run `pnpm dlx wrangler deploy --dry-run --config cloudflare/staging/wrangler.core.toml`
in CI before a real deployment. The `--dry-run` command is the compatibility gate,
not evidence of an actual live Worker.

## Data preservation

- **Existing Firewall D1 remains read-only for this migration**. Its signed action
  ledger must be exported and verified before any later schema changes.
- **Existing RaksHex PostgreSQL is not accessible via the connected Railway workspace**;
  this migration does not claim customer data was moved.
- Only a new table on isolated staging D1 is created; no production business tables
  are overwritten, and source PostgreSQL migration scripts are unchanged.
- The old `rakshex-web`, `rakshex-firewall` and `rakshex-api-staging` Workers stay in place.

## Remaining critical migration

- Full PostgreSQL tenant/account/payment/scan/findings schema → D1, using a
  versioned canonical SQLite schema and a _verified original PG export_.
- Existing Agent Firewall authorization, signed Action Ledger, credential mediation
  and OAuth sessions → Workers with exact security parity.
- Socket.IO and Redis/BullMQ → Cloudflare-native event/queue contracts with
  tested retry, reconciliation and realtime semantics.
- Full Next.js 16 app → vinext/OpenNext after compatibility, OAuth and CSP checks;
  no traffic switch until full buyer journey passes.
- DNS zone `rakshex.in` is not visible in connected Cloudflare account.
- Cloudflare Containers requires Workers Paid in the connected account.

Only explicit, reviewed, successful staging gates may authorize production cutover.
