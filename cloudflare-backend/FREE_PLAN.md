# Free-only resource policy and migration status

The owner's requirement is zero spending. No account upgrade, paid fallback, or paid provider call is authorized by this configuration. Existing Cloudflare services and PostgreSQL data must be preserved. A free quota is finite: availability can stop at quota exhaustion. This document does not claim a deployed free replacement.

## Implemented resource reductions

| Work | Previous steady interval/capacity | New default |
|---|---|---|
| Browser alerts, incidents, backend-status probes | 30 seconds | 60 seconds after the previous request completes |
| Browser dashboard stats | 60 seconds regardless of visibility | 60 seconds while visible and online |
| Health HTTP refresh | 30 seconds alongside WebSocket | 60 seconds; skipped while a valid WebSocket update was received in the last 90 seconds |
| Hidden/offline dashboard tabs | Repeated polling/socket reconnects | Poll timers and health socket suspended; resume on visibility/network recovery |
| Health socket failure | Reconnect every 5 seconds | Retry delay grows from 5 seconds to 60 seconds; reset after a valid update |
| Health socket snapshot messages | Every 10 seconds | Every 60 seconds; initial connection and explicit refresh remain immediate |
| Shared backend health probes | Every 60 seconds | Every 300 seconds |
| Shared backend schema checks | Every 300 seconds | Every 900 seconds |
| PostgreSQL pool | Retained capacity 5, total cap 20 | Retained capacity 1, total cap 3 |

These are configuration/scheduling reductions, not measured production speedups or capacity guarantees. At equal running time, changing the health interval from 60 to 300 seconds reduces scheduled probe frequency by 80%; 300 to 900 seconds reduces schema-check frequency by about 67%. Browser counts vary with page, visibility, network latency and WebSocket activity. An open connection pool is capacity, not a promise that all slots are used.

Tradeoff: background health may be up to five minutes old and schema detection up to fifteen minutes late, plus probe/request time. Manual browser refresh retrieves the current stored snapshot; it does not force a new provider probe. Backend monitoring still runs while FastAPI is alive, including without viewers. Socket health messages do not imply that a new provider probe ran. Neither background loop is durable across server sleep or restart.

`RESOURCE_PROFILE=free` is the default. Explicit `HEALTH_PROBE_INTERVAL_SECONDS`, `CHANGE_PROBE_INTERVAL_SECONDS`, `HEALTH_WEBSOCKET_INTERVAL_SECONDS`, `DB_POOL_MIN`, and `DB_POOL_MAX` override it. The `standard` profile restores prior defaults when those overrides are unset. Authentication, tenant scoping, signing/encryption, billing verification and persistence are unchanged; authenticated responses are not shared through a public CDN cache.

## Why the existing deployment still fails

Cloudflare rejects the Container API on this free account. Faster code and fewer requests do not remove that plan restriction. Python Workers support FastAPI, but Cloudflare explicitly documents that **async SQLAlchemy is not supported** because greenlet is unavailable. This app uses async SQLAlchemy throughout its persistence layer. Dropping the FastAPI app into Python Workers would therefore not preserve working database operations.

References checked 14 October 2026:

- [Cloudflare Python Workers and SQLAlchemy compatibility](https://developers.cloudflare.com/hyperdrive/examples/python-workers/#limitations-and-compatibility)
- [FastAPI in Python Workers](https://developers.cloudflare.com/workers/languages/python/packages/fastapi/)
- [Workers Free limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Static asset pricing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)

## Hosted free target — migration still required

Serve prerenderable frontend assets directly from Cloudflare, and handle APIs in a native Worker rather than a Container. Keep server-side secrets and tenant authorization at that API boundary. Reuse the existing database only after verifying its free quota, and use a Worker-compatible database driver. Alternatively evaluate a Python Worker with a rewritten compatible persistence layer; this is not a drop-in deployment.

Before cutover, port the actual browser/OpenAPI contracts, auth and account isolation, scans/history, costs/budgets, reports, team access, provider validation and durable schema snapshots. Replace in-process monitoring with bounded scheduled batches and persisted results. Port the frontend runtime proxy/docs/connection-info routes or replace them with equivalent Worker routing. Static export alone cannot keep these Next.js server routes working.

AI output requires an available provider free allowance or user-supplied credentials; deterministic scans/diffs should run without an LLM. Exhausted quotas must return a clear unavailable state. Do not invent generated output, bypass limits, weaken password hashing, distribute work across accounts to evade quotas, or treat a successful health response as proof that the whole app is working.

Only switch the existing public hostname after deployed signup/login, session handling, tenant isolation, persistence across restart, scan/history, cost/report flows, monitoring and quota-failure behavior pass. This PR optimizes the current source; it does not implement or deploy that native replacement.
