# RaksHex pilot gates: transaction, receipts and performance

**Decision (2026-10-13):** Keep the existing TypeScript/Express backend, PostgreSQL, Redis/BullMQ and Cloudflare edge. Rust (PR #217) and the Workers decision plane (PR #215) stay experimental. Do not claim the system is faster until p50/p95/p99 are measured.

## Exact present-state distinction

- `apps/api/api/agentFirewall.ts` issues an `action_ledger` decision and hash, NOT a signed `action_receipt_ledger` entry. Broker authorization currently relies on the _unsigned_ `action_ledger` decision.
- `apps/api/services/receipts/actionReceipts.ts` implements a separate transactionally appended, Ed25519-signed, workspace-chained receipt ledger, currently called from AI provider gateway paths. It is **not** wired into the Agent Firewall authorization/broker path. **Do not claim all agent actions have a signed receipt.**
- `credentialEgressLog` has a unique ledger id, preventing two brokered calls on the same decision. However, a provider success followed by DB settlement failure leaves an ambiguous outcome. Blind retry would risk a duplicate provider action.
- `packages/sdk/src/firewall.ts` also offers `authorizeAndRun`, which executes through a caller-owned function and therefore cannot enforce credential isolation; market claims must distinguish the mediated broker path.
- Revocation writes are database updates today. Evaluate reads fresh authority and agent statuses; **broker** currently does not revalidate the original delegated authority/agent status at provider egress. Fix this before asserting immediate revocation.
- Existing tenant protections are enforced by workspace membership and scoped ledger matching; dedicated cross-workspace concurrency and replay tests remain a separate gate.

## Phase 1 — this PR

- Transactionally serialize `agentFirewall.evaluate` by workspace `pg_advisory_xact_lock` for **atomic** cumulative-limit evaluation, ledger append, approval creation and use counters.
- Read exact aggregate count/amount for the past 24 hours and only 20 recent actions for high-risk sequences. Previous 1000-row truncation was unsafe for a high-volume workspace.
- Hold row-share locks on agent identity and delegated authority to synchronize with status revocation updates. It does **not** fix broker-time revocation checks.
- Reject reuse of an idempotency key with a different logical action. Use a DB timestamp after workspace lock acquisition for ordering; existing hash-chain histories and ordering still require migration audit.
- Leave signed action receipts and provider execution unchanged. Nothing in this PR changes public routing or production database schema.

## Phase 2 — release-blocking correctness

1. In one DB transaction, atomically claim the requested authorization, validate agent + delegation + brokered credential are still active, and commit a verifiable signed pre-egress receipt before making an external request. Ensure the signed chain is committed **before** egress; reject if signing keys or database are unavailable. Re-check revocation after approval.
2. Explicitly model `PENDING -> DISPATCHED -> SUCCEEDED/FAILED/UNKNOWN` for credential egress. A network timeout or DB write failure after a provider call must become `UNKNOWN`, not automatically retried. Reconcile with provider transaction/idempotency references before settling a signed outcome.
3. Extend unique IDs and idempotency to external provider requests whenever provider supports them. Prevent stale ALLOW replay after policy/credential revocation.
4. Test two workspaces simultaneously: no cross-tenant access, lock blocking only within each workspace; remove an agent/authority/credential under concurrent load and prove no unauthorized post-revocation egress.
5. Validate complete ledger-chain continuity across legacy/new rows. If timestamps aren't sufficient for exact total order, introduce a controlled monotonic DB sequence, backfill/migrate explicitly, then benchmark any workspace lock contention.

## Phase 3 — performance tests (isolated staging only)

Use `scripts/perf/action-evaluate.k6.js` with a **disposable staging tenant + database**, not `api.rakshex.in`. The script performs policy evaluations but _no_ provider execution.

Metrics to record at 1, 5, 10 and 25 virtual users (if the staging capacity supports it):

- p50/p95/p99 authorization latency, request rate, errors/timeouts, successful decision writes
- Per-workspace throughput and lock wait, DB pool saturation, CPU/memory
- Receipt append/settlement lag and unresolved `UNKNOWN` outcomes when phase 2 is implemented
- Multiple-workspace isolation vs one hot workspace; replay/collision behavior

**Postgres failure injection:** create disposable test database with migrated schema, and test-only API keys. Run a small baseline; stop/restrict only the _disposable Postgres container_, never a live or shared database. Record how long until the API returns a non-ALLOW error, restoration duration, duplicate requests and unprocessed queue backlog. Restore the container and verify DB integrity. Repeat for disposable Redis and worker, separately. An HTTP failure or unavailable auth is acceptable: an unauthorized ALLOW is not.

**Acceptance:** no lost/duplicate privileged egress; no ALLOW without persisted authorization + signed pre-egress receipt (after phase 2 is rolled out); no broken receipt chain; no unbounded lock waits; rollback demonstrated. No latency target or improvement claim without data.

## Source/license checks

- Official MCP TypeScript SDK v2 states support for the MCP spec of **2026-07-28**: https://github.com/modelcontextprotocol/typescript-sdk and https://ts.sdk.modelcontextprotocol.io/v2/
- Cloudflare Containers pricing shows Containers on Workers Paid: https://developers.cloudflare.com/containers/platform/pricing/
- Runlayer's published platform pages describe MCP governance, identity, inline policy and audit features: https://www.runlayer.com/platform and https://www.runlayer.com/mcp-gateway (vendor claims, not independently benchmarked)
- k6 is licensed **AGPL-3.0** per its upstream README: https://github.com/grafana/k6. Using its executable as an external staging test tool does not require bundling k6 into RaksHex; confirm final distribution and legal obligations if that deployment model changes.

Keep pre-pilot integrations minimal: official MCP SDK, k6, and Trivy only when the scanning product needs it. Invariant/Langfuse are deferred.
