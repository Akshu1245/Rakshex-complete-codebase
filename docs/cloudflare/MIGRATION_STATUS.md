# RaksHex Cloudflare-first: staging implementation status

**Stage:** CF-00 / CF-01 in progress. **Do not describe this as a full RaksHex deployment.**
**Base GitHub main:** `1e2e61901a6c79aba79dcdc4633f596b7fc8ccd3` (12 Oct 2026).
**Change branch:** `feat/cloudflare-first-staging-20261012`.

## Verified existing production resources (DO NOT MODIFY)

- Cloudflare Workers: `rakshex-web` and `rakshex-firewall` (deployed September 27).
- Existing Firewall D1 database: `rakshex-firewall`; populated with security evidence.
- Read-only snapshot counts at start of work: 1 workspace, 1 API-key record and 23 action receipts. These counts are **not a backup** and may change.
- Existing production KV: `rakshex-config`; R2: `rakshex-receipt-bundles`; queue: `rakshex-eval-jobs`.
- Existing Cloudflare web-to-firewall binding: `RAKSHEX_API` to `rakshex-firewall`.
- Cloudflare DNS zones in connected account: none. **Do not claim `rakshex.in` is routed through this Cloudflare account.**
- Containers inaccessible on the connected plan. Main Node app/Socket.IO/BullMQ/Postgres remain **not migrated**.
- Original production RaksHex PostgreSQL data source has **not** been identified; the accessible Railway workspace is unrelated DecisionTrace and must not be touched.

## Newly provisioned isolated staging infrastructure

The following empty resources were created within the connected RaksHex Cloudflare account. They deliberately **do not** point at existing Firewall production resources:

- **D1 database:** `rakshex-migration-staging` — `3e13ba92-e005-4220-a272-cb972a57bf9d`.
- **Queue:** `rakshex-migration-staging-jobs` — `52094ebbbbf446a6a2d6dfb941763547`.
- **KV:** `rakshex-migration-staging-config` — `c70babd55491444e96046824fde32224`.
- **R2:** `rakshex-migration-staging-objects` (bucket name).

No real customer data has been copied into these staging resources. No RaksHex production route or setting is changed by this infrastructure provisioning.

## Actual isolated staging probe deployment

- Cloudflare Worker: `rakshex-api-staging`, deployed October 12, 2026 using the reviewed branch probe source.
- The deployment API reports 100% traffic assigned to this Worker version; the `workers.dev` subdomain is enabled.
- Verified settings bind **only** the new staging resources above.
- Intended probe URL: `https://rakshex-api-staging.rakshex.workers.dev/__health`.
- A successful external HTTP response has **not** been independently observed: the external fetch tool could not access this URL. Treat HTTP health as **unverified** until an operator runs `curl`.
- No customer API endpoints, database migration, frontend routing or production domain were deployed.

## Safety boundary introduced in this branch

- `apps/web/backend-origin.cjs` centralizes Next.js rewrite backend routing.
- `RAKSHEX_DEPLOY_TARGET=cloudflare` disables the _implicit_ legacy Railway fallback and requires an explicit clean HTTPS origin. With `RAKSHEX_CLOUDFLARE_ENV=staging`, it also rejects a hostname without `staging`.
- Cloudflare-target builds substitute that explicit backend origin into CSP `connect-src`, removing legacy Railway origins for those builds.
- Existing non-Cloudflare behavior is unchanged until an explicit, tested production cutover.
- `cloudflare/staging/api-worker.mjs` is **only a binding probe**. `GET /__health` returns whether staging resources are bound, and it explicitly reports `application_api_migrated: false`. All other API requests return `501 NOT_MIGRATED`. It is not an Agent Firewall, a database migration or a real API deployment.
- `cloudflare/staging/wrangler.api.toml` binds only the staging resources.
- `node --test scripts/cloudflare/*.test.mjs` exercises staging isolation, Railway fallback rejection and deliberate API unavailability.

## Reproduce the isolated probe deployment (not a production cutover)

The isolated probe was already uploaded through the Cloudflare API. To reproduce it from GitHub using the operator's authorized Wrangler session:

```bash
# From repository root, with an authenticated Wrangler session:
pnpm dlx wrangler deploy --config cloudflare/staging/wrangler.api.toml
```

Check `GET https://rakshex-api-staging.rakshex.workers.dev/__health` and assert `application_api_migrated === false`. Do not point user-facing pages or SDKs at this probe; it deliberately does not implement customer endpoints.

**Operational requirements:** capture deployment version, account scope and commit hash; verify all four bindings refer only to staging; smoke and rollback test. No production domain changes or secrets during this stage.

## Next required engineering stages

1. Export existing Workers to private secure backup and obtain **independently restorable** D1 export (preserve signed receipts and their verifying key IDs). A Time Travel bookmark alone is not an offsite backup.
2. Recover the true original RaksHex Postgres database via the owner's Railway account or an approved backup. Record encrypted snapshot, schema version, row counts and restore results. Never treat the unrelated DecisionTrace database as RaksHex.
3. Next.js runtime compatibility spike with auth/OAuth, rewrite/CSP and static assets; preserve the original build in parallel.
4. Extract bounded Worker-compatible API handlers and compare ALLOW/DENY, credential mediation and signatures against existing implementation.
5. Separately port PostgreSQL schema to D1 with tenant, financial precision, migration-order and ledger chain parity tests; do not point the PG migration runner at D1.
6. Replace BullMQ producers/consumers one payload contract at a time, with idempotency, retry/DLQ and at-least-once delivery protections.
7. Domain ownership/DNS and security headers/cookie/OAuth redirects; customer journey and disaster recovery drills.
8. Only then consider phased production traffic cutover; maintain an approved rollback and keep existing data stores until sign-off.

## Release gates and nonclaims

- Full GitHub CI + independent Security scan green on the change SHA.
- `Cloudflare boundary` workflow green, with the expected staging probe semantics.
- No implicit Railway routing in Cloudflare target; no production service bindings in staging.
- No claims of full API, database, GitHub App, billing, socket, YC #12 or YC #13 functionality before their respective end-to-end tests pass.
- No hardcoded credentials, token values, or customer data in source, logs or exported documents.
