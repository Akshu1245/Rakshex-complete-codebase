# RaksHex Cloudflare-only backend integration

13 October 2026. This is a fresh Cloudflare application environment, independent of any external backend or database. Historical import is optional future work and does not block new integrations. Existing Firewall data and signatures remain untouched.

## Current connected topology

- API entry: `rakshex-api-staging`.
- `APP_API` service binding: `rakshex-app-staging`, using its isolated D1 `rakshex-app-staging` database.
- `CORE_API` service binding: `rakshex-core-staging`, providing contract-diff operations and asynchronous jobs.
- Existing staging Queues, dead-letter queue, R2 and KV remain available for jobs and non-authoritative storage/configuration.
- Frontend same-origin rewrites include `/api/v1/control/:path*` and contract-diff/job routes. They are source changes, not a claim that the existing production Web Worker has been rebuilt.

## Backend inventory and integration order

| Module                               | Required APIs / behavior                                                                                        | State                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Health and capabilities              | Database/signing readiness, scoped capability inventory                                                         | Deployed                                                       |
| Workspace provisioning               | Private operator bootstrap, currency, default policy                                                            | Deployed; not public sign-up                                   |
| Workspace API keys                   | Hashed high-entropy keys, admin/runtime/read roles, revocation                                                  | Deployed                                                       |
| Browser authentication               | Better Auth/Auth.js on Cloudflare, sessions, OAuth/OTP, logout                                                  | Next integration; do not invent login sessions                 |
| Membership and RBAC                  | Users, invitations, owner/admin/member permissions                                                              | Pending browser auth                                           |
| Agent identities                     | Create/list agents, pause/reactivate/revoke                                                                     | Deployed                                                       |
| Root authority scopes                | Stored actions/resources/environments/count/amount/expiry constraints                                           | Deployed                                                       |
| Delegation hierarchy                 | Attenuation, depth, ancestor revocation                                                                         | Pending; no hierarchy accepted yet                             |
| Policies and freeze                  | Stored versioned policy, approval thresholds, daily limits, dangerous sequences, workspace freeze               | Deployed                                                       |
| Authorization                        | Existing canonical TypeScript engine, enforce mode only, unknown actions restrictive                            | Deployed; proposal authorization only                          |
| Transaction-safe count/amount limits | Recheck chain tip and security state with atomic conditional D1 insertion                                       | Deployed; SQLite concurrency tested                            |
| Signed evidence                      | Ed25519 authorization receipts, SHA-256 chain, identical retries, changed-input rejection, append-only triggers | Deployed                                                       |
| Receipt pagination/export            | Workspace-scoped recent receipts; offline signature verification                                                | Deployed; recent page is not necessarily a complete chain      |
| Human approvals                      | Approval queue, authorized decision, single consumption, re-evaluation                                          | Pending; approval-required is not ALLOW                        |
| Credential vault                     | Encrypted provider credentials, managed secret bindings, rotation, scopes                                       | Pending                                                        |
| Credential broker                    | Allowlisted endpoint/method binding, fresh revocation check, single-use claim, no raw key release               | Pending; execution explicitly disabled                         |
| External outcome settlement          | Persisted egress state, uncertain outcome reconciliation, provider idempotency                                  | Pending broker                                                 |
| Provider gateways                    | OpenAI/Anthropic/ElevenLabs streaming, budget reservations and settlement                                       | Pending broker; no simulated provider calls                    |
| API/secret scans                     | Secure import, deterministic scanner, queued findings persistence                                               | Pending; contract diff is already deployed                     |
| Contract diff                        | Authenticated deterministic comparison, D1 jobs, retries, hash-integrity check                                  | Already deployed                                               |
| Jobs                                 | Queue processing, retry/backoff, DLQ, operator redrive                                                          | Existing contract-diff lane connected; other contracts pending |
| Files and reports                    | Private R2 object references, authorized exports, signed bundles                                                | Resources exist; application endpoints pending                 |
| Notifications                        | Email provider, templates, verified webhooks, queue delivery                                                    | Pending                                                        |
| Billing                              | Payment provider webhooks, event idempotency, entitlement checks                                                | Pending; provider account configuration eventually needed      |
| Realtime                             | Authenticated SSE/polling initially, optional Durable Objects                                                   | Pending user sessions                                          |
| Error responses                      | 400/401/403/404/405/409/413/415/503, request IDs, no internal exception leakage                                 | Deployed for control API                                       |
| Browser error pages                  | Existing Next.js not-found/error/loading pages                                                                  | Existing source; Cloudflare frontend release pending           |
| Observability                        | Worker logs with sampling and query redaction, no tokens/raw SQL in receipts                                    | Enabled for new app Worker                                     |
| Abuse/rate limiting                  | Turnstile for public intake, per-key limits, request ceilings                                                   | Pending before public onboarding                               |
| Domain/TLS/CORS                      | Same-origin API routing, owner-controlled custom domain, strict callback origins                                | Workers.dev works; custom domain can follow later              |
| Backup/restore                       | D1 exports/Time Travel, R2 backups, restore rehearsal and chain verification                                    | Pending operator drill                                         |

## Deployed control API

Base path: `/api/v1/control`. Except health/capabilities and private bootstrap, requests use a workspace API key in the Authorization Bearer header. No token belongs in a browser public build variable or query string.

| Method     | Route                      | Permission                                                                     |
| ---------- | -------------------------- | ------------------------------------------------------------------------------ |
| GET        | `/health`                  | Public, reports staging readiness                                              |
| GET        | `/capabilities`            | Public, declares remaining gaps                                                |
| POST       | `/bootstrap`               | Private `ADMIN_BOOTSTRAP_KEY`; creates a fresh workspace and initial admin key |
| GET        | `/workspace`               | Workspace key                                                                  |
| GET / POST | `/keys`                    | Admin; create runtime/read keys, list metadata only                            |
| POST       | `/keys/{id}/revoke`        | Same-workspace admin                                                           |
| GET / POST | `/agents`                  | Admin                                                                          |
| POST       | `/agents/{id}/status`      | Same-workspace admin                                                           |
| GET / POST | `/authorities`             | Admin; root scopes only                                                        |
| POST       | `/authorities/{id}/revoke` | Same-workspace admin                                                           |
| PUT        | `/policy`                  | Admin                                                                          |
| POST       | `/freeze`                  | Admin                                                                          |
| POST       | `/authorize`               | Runtime/admin                                                                  |
| GET        | `/receipts?limit=50`       | Workspace key; maximum 100                                                     |
| GET        | `/catalog`                 | Workspace key                                                                  |

Bootstrap JSON: `{"name":"Team name","currency":"INR"}`. Initial credentials are returned once; token hashes only are persisted. Bootstrap is an operator endpoint, not a substitute for public customer registration.

Authorization JSON contains `requestId`, `agentId`, `authorityId`, and an `action` with `provider`, `operation`, optional parameters/resource/environment/amount/currency. The workspace is derived from the authenticated key; caller-supplied workspace IDs are rejected. Example:

```json
{
  "requestId": "demo-read-1",
  "agentId": "<stored agent id>",
  "authorityId": "<stored authority id>",
  "action": { "provider": "postgres", "operation": "query", "parameters": { "sql": "SELECT 1" } }
}
```

The endpoint returns a signed ALLOW/DENY/approval-required authorization record after persistence. It does **not** execute SQL or external APIs, expose credentials, or bypass approval requirements. Replayed receipts are historical authorization evidence: a future broker must recheck revocation and claim execution once before using them.

## Atomicity and safety

The existing `@rakshex/action-control` evaluator and corrected classifier are reused. The Worker loads stored authority, policy, workspace/agent state and ledger-derived cumulative usage. It signs the proposed evidence, then uses one conditional D1 INSERT to compare the ledger tip, workspace revision, authority state, agent state and active API key. If a concurrent authorization or revocation changed any of those values, it reevaluates. An ALLOW insertion also rechecks scope expiry against database time. Bounded contention returns 503 rather than authorizing without evidence.

There are no raw prompts, parameter bodies, provider tokens or SQL strings in receipts; a request fingerprint binds the submitted proposal. This SQL classification is conservative, not a SQL sandbox or a proof that arbitrary user-defined functions are side-effect-free. Execution remains disabled until mediated requests are independently bound to their authorized actions.

## Validation and deployment scope

Live Cloudflare checks passed for health, private workspace/agent/grant provisioning, signed ALLOW, identical replay, changed-input rejection, CTE denial and revocation. Six concurrent live requests issued exactly two ALLOW receipts under a limit of two. All eight fixture receipt signatures and the full fixture chain verified offline. Synthetic workspace access was frozen and its API key revoked afterward; append-only evidence is preserved.

36 local Cloudflare tests pass, including real SQLite control API tests, concurrent maxCount/chain behavior, signature verification, tenant substitution, key/authority revocation races, freeze, retries and error codes. Existing action-control tests remain applicable. The new app is an alpha staging control path, not production certification or complete product parity.

Secrets are deployed as Worker secrets. The fresh signing key is distinct from historical Firewall keys. Keep old public keys for historical verification. Do not copy source databases, reset existing receipts, or run PostgreSQL migrations against D1.

## Next implementation sequence

1. Bind browser authentication and memberships to these workspace APIs; then release the actual frontend staging build.
2. Implement approval consumption and the credential broker, with single-use claims and revocation checks immediately before credential use.
3. Connect one provider gateway, encrypted credentials and outcome reconciliation; test external-call failure windows.
4. Add scanner jobs/findings, notifications and private R2 exports.
5. Add live billing only when provider credentials/configuration are supplied; finish rate limiting, domain routing and restore/load/outage gates.

None of these steps requires an external hosting migration as a prerequisite.
