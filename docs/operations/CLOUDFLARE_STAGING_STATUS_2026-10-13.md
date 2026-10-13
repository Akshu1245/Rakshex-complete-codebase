# Cloudflare staging status — 13 October 2026

The full RaksHex backend is **not migrated**. Production remains separate from the isolated Cloudflare contract-diff slice.

## Completed in this change

- SQL read classification examines executable SQL for CTE writes and subsequent destructive statements, correcting both action name and effect. Quoted literals, identifiers, dollar strings and nested comments are excluded; ambiguous literals fail classification. This is a conservative classifier, not a general SQL parser or a guarantee about user-defined functions.
- PostgreSQL receipt writes serialize by workspace and return existing evidence on identical event retries. Changed payload or explicit timestamp is rejected. The additive `0031` migration checks existing duplicate event groups without deleting data, then enforces `(workspace_id, request_id, event_type)` uniqueness. Separate allow/settle events remain possible.
- Staging readiness now checks database schema, private authentication configuration and queue binding, and declares its limited scope explicitly.
- Queue workers compare the stored input hash before evaluation. Changed inputs become failed jobs rather than being evaluated.
- Cloudflare runtime CI runs both the existing runtime tests and the new integrity/fault tests.

## Deployment and verification

Only `rakshex-core-staging` was updated. Existing bindings and secret were inherited. Previous rollback version: `d4d69eb2-c56d-435d-8488-bcc6d2bb7c41`.

Live readiness returned HTTP 200 with `production:false`, `scope:contract-diff-only`, and database/authentication/queue configured. A synthetic valid message completed with the expected removed-operation result. A changed-input message failed with `INPUT_HASH_MISMATCH`. Synthetic records were removed after verification.

Local checks: 74 action-control tests; 12 signed-receipt/retry tests; 20 Cloudflare checks; migration order test. Selected gateway/tenant/security checks: 48 passed, 18 skipped because database-backed prerequisites were absent. The Worker bundles successfully with esbuild. Mock receipt tests do not prove actual PostgreSQL concurrency or migration behavior; CI's PostgreSQL release lane must validate those before promotion.

## Outstanding prerequisites and work

- The connected Cloudflare account rejects Containers access and explicitly requires Workers Paid. No upgrade or purchase was made.
- A production PostgreSQL source and independently restorable backup have not been identified in the accessible context. Do not invent customer records or claim a completed data migration.
- The connected account contains no DNS zones or custom Worker domains. Establish the real domain owner/account and preserve DNS/email records before changing routing.
- Login/session/OAuth, Express/tRPC contracts, payment/provider gateways, realtime events, existing BullMQ contracts, delegated authority, credential broker and production ledger still need migration/parity and live tests.
- Do not apply the PostgreSQL migration to D1. Its unique index and PL/pgSQL validation belong to PostgreSQL.
- Revocation ordering, transactional action-limit reservations, external-call reconciliation and real per-workspace load/outage measurements remain release gates.

Resource existence and a staging health response are not full application readiness.
