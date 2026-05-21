# Rakshex — Enterprise Readiness Report (Phase 1 Hardening)

**Branch:** `devin/1778267018-phase1-hardening`
**Scope:** Phase 1 cleanup + the highest-leverage parts of Phases 2–5.
**Out of scope (deferred with rationale):** Phases 7–10 (AI Runtime Governance,
Red Teaming, MCP Governance, Shadow AI, Runtime Policy Engine, Security Copilot,
GitHub/VS Code product surfaces, full load testing, Lighthouse).

This report grades the 29 numbered items from the original brief against an
honest three-state rubric:

| Status     | Meaning                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------- |
| ✓ done     | Implemented, type-checks pass, lint clean, tests green.                                         |
| ⚠ partial  | Implemented for the production-critical surface; the long-tail items are listed under each row. |
| ✗ deferred | Intentionally not in this PR — represented in the **Roadmap** section with a sized estimate.    |

CI status: `pnpm check` ✓, `pnpm build` ✓, `pnpm test` ✓ (221/221 passing).

---

## Phase 1 — Codebase Cleanup

| #   | Item                           | Status | Evidence                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Remove all `throw new Error()` | ✓ done | All ~100 production sites replaced with typed `AppError` subclasses (`server/_core/errors.ts`). Remaining sites are: tests (intentional), `_core/env.ts` startup fail-fast (runs before logger), and React provider-guard `useContext` checks (standard Radix/shadcn pattern, never user-facing).                  |
| 2   | Remove all `as any`            | ✓ done | All 25 production sites replaced with proper interfaces, `z.infer` types, type-narrowing helpers, or schema-derived literal unions. Drizzle `mysqlEnum` columns now flow through `SubscriptionStatus` / `PaymentStatus` / `RefundStatus` derived from `$inferSelect`. Decimal columns are parsed via `toNumber()`. |
| 3   | Replace `console.*` with Pino  | ✓ done | `server/_core/logger.ts` is a full pino setup with PII redaction (Authorization, cookies, tokens, secrets), per-request child loggers, and an Express access-log middleware. All ~80 `console.*` calls in `server/` are gone except for `_core/env.ts` (startup-only, fires before logger config exists).          |
| 4   | Verify XSS safety              | ✓ done | One `dangerouslySetInnerHTML` site (`ui/chart.tsx`); audited inline. Inputs are non-user-controlled by design (`React.useId` + developer-provided `ChartConfig`); defensive `cssIdent` / `cssValue` sanitizers added so a future caller can't accidentally introduce a CSS-injection sink.                         |

### Phase 1 details

- **Typed error hierarchy** (`server/_core/errors.ts`) — `AppError` base class with structured `code`, `httpStatus`, `trpcCode`, `safeMessage`, and `context`. Concrete subclasses: `ValidationError`, `AuthError`, `InvalidCredentialsError`, `SessionExpiredError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `BillingError`, `BillingProviderError`, `ExternalServiceError`, `DatabaseUnavailableError`, `RuntimePolicyError`, `AIThreatDetectedError`, `InternalError`. Helpers: `assertDb()` (auto-throws `DatabaseUnavailableError`), `assertExists()`, `toTRPCError()`, `isAppError()`.
- **tRPC error boundary** (`server/_core/trpc.ts`) — `errorBoundary` middleware wraps every procedure. `TRPCError` passes through; `AppError` is mapped to `TRPCError` via `toTRPCError()`; everything else becomes `INTERNAL_SERVER_ERROR` with the safe message **"An unexpected error occurred"** so we never leak stack traces or DB error text to clients. The custom `errorFormatter` exposes `appCode` + `zodIssues` to clients.
- **Structured logger** (`server/_core/logger.ts`) — pino in JSON mode in prod, `pino-pretty` in dev. Aggressive `redact` paths cover `password`, `*.password`, `accessToken`, `refreshToken`, `idToken`, `authorization`, `cookie`, `set-cookie`, etc. `requestIdMiddleware` generates or propagates `X-Request-Id` and `X-Correlation-Id`, attaches `req.log = logger.child({...})`, and echoes both back as response headers so end users can quote them in bug reports. `accessLogMiddleware` emits one structured log per completed request.

---

## Phase 2 — Authentication Hardening

| #   | Item                                                                                     | Status    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | Refresh-token rotation, suspicious-login detection, IP/device fingerprinting, audit logs | ⚠ partial | Existing primitives in place: HS256 JWT sessions in `_core/sdk.ts` (1y expiry, secret-rotated), `userSessions`/`auditLog` Drizzle tables, `googleOAuth.ts` profile sync, password reset with token expiry. **Not yet built:** rotating refresh tokens (today the access token is the session), revoke-all-sessions endpoint, impossible-travel detection, and the `device_fingerprint` join. Estimated 1–2 weeks for refresh rotation + revoke flow; longer for anomaly detection (needs a real user telemetry pipeline). |
| 6   | Session management — secure cookies, SameSite, sliding expiration                        | ⚠ partial | Cookies are set `httpOnly`, `Secure`, `SameSite=Lax` from the SDK (`server/_core/cookies.ts`). **Open items:** sliding expiration (today expiry is fixed at 1y), revocation list, refresh rotation. The strong CORS allowlist (#8 below) compensates for the `Lax` rather than `Strict` setting on the dashboard cookie.                                                                                                                                                                                                  |

The ⚠ here is intentional. Building a real refresh-rotation flow with replay
detection, a Redis-backed revocation list, and impossible-travel telemetry is
~1–3 sprints of work and must not be stubbed. It belongs in a follow-up PR.

---

## Phase 3 — Security Hardening

| #   | Item                                                | Status     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | --------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 7   | Helmet — CSP, HSTS, COOP/COEP/CORP, Referrer-Policy | ✓ done     | `server/_core/index.ts:259+` configures helmet with a strict CSP (`default-src 'self'`, per-request nonces for `script-src`, `frameSrc: 'none'`, `objectSrc: 'none'`), HSTS (`maxAge=31536000`, `includeSubDomains`, `preload`), `frameguard=sameorigin`, `crossOrigin*Policy`, and `referrer-policy=strict-origin-when-cross-origin`. Inline scripts get a per-request nonce generated at the very top of the middleware chain.                                                                             |
| 8   | Strict CORS allowlist                               | ✓ done     | `buildCorsAllowlist()` returns exactly `https://rakshex.in`, `https://www.rakshex.in`, `https://app.rakshex.in`, plus the `FRONTEND_URL` override. No wildcard, no origin-reflection. Trusts a single proxy hop in production so `X-Forwarded-For` cannot be spoofed past the rate limiter.                                                                                                                                                                                                                  |
| 9   | Per-endpoint zod / RBAC / BOLA / SSRF audit         | ⚠ partial  | Every tRPC procedure already validates input via zod and the `protectedProcedure` / `editorProcedure` / `adminProcedure` tiers enforce role-based access. Per-resource ownership checks (BOLA prevention) are present in `scanning.ts`, `compliance.ts`, etc. — every router I touched cross-checks `collection.userId === ctx.user.id`. **What's still open:** a written attestation per endpoint, mass-assignment audit, and SSRF allowlists for external fetches. The latter is doable in another sprint. |
| 10  | OWASP API Top-10 self-audit + report                | ✗ deferred | A real Top-10 audit needs a written test plan per category, threat-model diagrams, and concrete reproductions where applicable. Producing a hand-wavy table here would be theater. Sized at ~2 weeks of dedicated security review (1 person) to do honestly.                                                                                                                                                                                                                                                 |

---

## Phase 4 — Database & Redis Hardening

| #   | Item                                                      | Status     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | DB indexes, FK constraints, transaction safety, N+1 audit | ⚠ partial  | The drizzle schema already has indexes for `userId`, `scanId`, `createdAt`, `orgId`, etc. on the high-traffic tables. **Not done in this PR:** EXPLAIN-driven query audit, missing-index report, FK migration plan. Needs a real production traffic profile to do correctly.                                                                                                                                                                                                                             |
| 12  | Distributed Redis rate limiting                           | ⚠ partial  | `_core/cache.ts` provides a real Redis client (`ioredis`) shared across replicas. The express-level limiter in `_core/index.ts` uses `express-rate-limit` (memory store) — fine for a single replica, but not horizontally distributed. The per-user **scan-count** limit at `api/scanning.ts:55+` already uses an atomic Redis INCR + EXPIRE pipeline keyed by `scan_count:{userId}:{day}`, which IS horizontally safe. **Open:** swap the express middleware to `rate-limit-redis`. ~half-day of work. |
| 13  | BullMQ queues for scans/webhooks/emails/digests           | ✗ deferred | Today scans run synchronously in the request lifecycle. Webhooks have an in-process retry loop in `services/webhookDelivery.ts`. Moving to BullMQ is a meaningful architectural change (worker process, separate Procfile entry, queue introspection UI, dead-letter dashboard) — sized at ~1–2 weeks. Worth doing as soon as scan volume grows past a single replica.                                                                                                                                   |

---

## Phase 5 — Observability & Monitoring

| #   | Item                                              | Status    | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 14  | Sentry + OpenTelemetry + tracing                  | ⚠ partial | **Sentry is fully wired** (`_core/index.ts:184+`): `Sentry.init` with `tracesSampleRate=0.1` in prod, custom `beforeSend` + `beforeSendTransaction` PII scrubbers (Authorization, cookies, set-cookie, `x-razorpay-signature`, etc.), `Sentry.setupExpressErrorHandler(app)`. **OpenTelemetry / distributed tracing** is not wired — would need an OTel collector, exporter config, and span instrumentation across tRPC/HTTP/MySQL/Redis. Sized at ~1 week. |
| 15  | Immutable audit logs for auth/billing/scans/admin | ⚠ partial | The `auditLog` table exists in the schema and is written from billing flows. **Open:** add audit writes to admin-action endpoints and the runtime policy events table (which doesn't exist yet — see roadmap).                                                                                                                                                                                                                                               |

The strong primitive added in this PR: **request-id propagation** (`logger.ts`)
means every Sentry event, every Pino log line, and every error response carries
the same correlation ID, so debugging a 500 from a customer ticket is a single
grep across log streams.

---

## Phase 6 — Frontend Hardening (touched in passing)

| #   | Item                                                      | Status     | Notes                                                                                                                                                                                                               |
| --- | --------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16  | React Error Boundaries, retries, skeletons, offline       | ⚠ partial  | The existing pages already use suspense/skeleton patterns from shadcn/ui. **Not done:** a top-level `<ErrorBoundary>` around the router, retry-on-mount logic, and offline state. Sized at ~3 days.                 |
| 17  | Lighthouse, accessibility, lazy loading, bundle splitting | ✗ deferred | The build warns at 1 MB+ JS chunk. Code-splitting routes via `React.lazy` + `manualChunks` is straightforward but pads the diff and risks hydration regressions; out of scope for a hardening PR. Sized at ~1 week. |

---

## Phases 7–10 — Product Surface (intentionally not in this PR)

These are real product builds, not refactors. Stubbing them here would create
the illusion of progress without actual capability. Sized estimates below assume
a small team (1–2 senior engineers) and are honest, not optimistic.

| #   | Item                                                          | Status     | Honest sizing                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 18  | AI Runtime Monitoring (prompts/tokens/agents/MCP/jailbreak)   | ✗ deferred | The platform already has a `tokenUsage` table and a kill-switch hook. A real runtime telemetry stream needs an SDK that customer apps embed, ingestion pipeline, and dashboard. **8–10 weeks** as a v1 with one model provider.                                                                            |
| 19  | AI cost governance (token burn analytics, forecasts, budgets) | ⚠ partial  | We already have `tokenUsage` analytics + a kill-switch with budget caps + Slack alerts (`server/slack.ts`, `server/api/killSwitch.ts`). Forecasting + per-model heatmaps are missing. **3–4 weeks** to ship v1 charts and forecast model.                                                                  |
| 20  | AI red-teaming engine                                         | ✗ deferred | The prompt-injection scan in `utils/promptInjectionScan.ts` is the seed. A real red-team engine needs a corpus pipeline, reproducible test runs against a live target, jailbreak signature DB, and reporting. **6–8 weeks** to ship a credible v1 (≥50 attack patterns, scoring, remediation suggestions). |
| 21  | MCP governance                                                | ✗ deferred | Rakshex currently has zero MCP integration. Needs MCP discovery agent, capability graph store, permission-graph viz. **8–12 weeks**.                                                                                                                                                                       |
| 22  | Shadow AI detection                                           | ✗ deferred | Needs a network-edge or DNS sensor — no existing collector primitive in the platform. **8–10 weeks**.                                                                                                                                                                                                      |
| 23  | Runtime policy engine                                         | ✗ deferred | The kill-switch is a single global enforcement point. A real policy engine needs a rule DSL, evaluation hooks at LLM/tool-call boundaries, and per-policy audit trail. **8–10 weeks**.                                                                                                                     |
| 24  | Security copilot                                              | ✗ deferred | Conversational answers over the customer's security data. Needs the schema layer + prompt design + eval harness. **6–8 weeks** for v1.                                                                                                                                                                     |
| 25  | Auto-fix engine                                               | ✗ deferred | "Generate a code patch for this finding." Needs a per-finding-type fix template library + safe code-mod runner. **8–10 weeks**.                                                                                                                                                                            |
| 26  | GitHub PR scanning + repo trust score                         | ✗ deferred | A separate GitHub App integration. **4–6 weeks** for app + scanner + trust score MVP.                                                                                                                                                                                                                      |
| 27  | VS Code AI security assistant                                 | ✗ deferred | Standalone extension; some scaffolding exists in `vscodeActivities` table. **4–6 weeks** for the assistant itself.                                                                                                                                                                                         |

| #   | Item                                                           | Status     | Notes                                                                                                                                                                                   |
| --- | -------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 28  | Performance optimization                                       | ✗ deferred | Needs a real workload profile. Premature optimization of websocket / queue throughput without measurements is wasted work.                                                              |
| 29  | Load testing (Redis fail / DB slow / 10k req / queue overload) | ✗ deferred | Needs a real target environment (today this is a single-process app on a developer's laptop). **2 weeks** to set up a k6 / Artillery harness + run scenarios against a staging cluster. |

---

## Summary Scorecard

| Phase                        | Items  | ✓ done | ⚠ partial | ✗ deferred |
| ---------------------------- | ------ | ------ | --------- | ---------- |
| 1 — Cleanup                  | 4      | 4      | 0         | 0          |
| 2 — Auth                     | 2      | 0      | 2         | 0          |
| 3 — Security                 | 4      | 2      | 1         | 1          |
| 4 — DB & Redis               | 3      | 0      | 2         | 1          |
| 5 — Observability            | 2      | 0      | 2         | 0          |
| 6 — Frontend                 | 2      | 0      | 1         | 1          |
| 7–10 — AI Governance product | 12     | 0      | 1         | 11         |
| **Total**                    | **29** | **6**  | **9**     | **14**     |

**Investor-readiness candor:** the platform is now in good shape on the
hygiene/observability axes (typed errors, structured logs, request IDs, strict
CORS+CSP, Sentry, no `as any` in prod). The big gaps before it can be marketed
as an "AI Runtime Governance Platform" comparable to Lakera / Traceable / Wiz
are Phases 7–10 — a real runtime telemetry SDK, MCP governance, and a runtime
policy engine. Those are 4–6 months of focused product work, not afternoons.

---

## Roadmap (recommended sequencing)

### Q1 (next 90 days, sized to 2 senior engineers)

1. **Refresh-token rotation + revoke-all-sessions endpoint.** Closes the biggest auth gap. _2 weeks._
2. **`rate-limit-redis` for the global Express limiter.** Trivial but unlocks horizontal scaling. _2 days._
3. **OWASP API Top-10 self-audit document.** Per-category test plan with concrete repros. _2 weeks._
4. **OpenTelemetry + tRPC/HTTP/MySQL spans → Sentry / OTel collector.** _1 week._
5. **AI cost governance v1** — forecasting, per-model heatmaps, anomaly detection on top of the existing `tokenUsage` table. _3–4 weeks._

### Q2

6. **AI runtime telemetry SDK (v1, one provider).** Customer apps emit prompts/tokens/tool-calls; we ingest + display. _8–10 weeks._
7. **BullMQ for scans/webhooks/emails.** _2 weeks._
8. **Frontend: top-level error boundary + bundle splitting + Lighthouse pass.** _2 weeks._
9. **Top-10 mitigations driven by the audit.**

### Q3

10. **Runtime Policy Engine v1** (rule DSL + enforcement hooks + audit trail).
11. **AI Red-Teaming Engine v1** (corpus + scoring + remediation).
12. **GitHub App integration.**

### Q4

13. **MCP Governance** (discovery + capability graph).
14. **Shadow AI detection** (DNS / proxy sensor).
15. **Security Copilot.**

This roadmap is intentionally honest about timelines. A tighter schedule is
possible with more headcount, but compressing AI Runtime Governance below ~6
months risks shipping the kind of shallow product the brief explicitly warned
against.

---

## How to Verify This PR Locally

```bash
pnpm install
pnpm check     # tsc --noEmit
pnpm build     # vite build + esbuild server bundle
pnpm test      # vitest — 221/221 passing
```

The new PII-redacted access log fires on every request:

```jsonc
{
  "level": "info",
  "time": "2026-05-08T19:24:38.123Z",
  "service": "rakshex",
  "env": "development",
  "requestId": "0192a4f0-…",
  "correlationId": "0192a4f0-…",
  "method": "POST",
  "url": "/trpc/scanning.startScan",
  "statusCode": 200,
  "durationMs": 142.6,
  "userId": 42,
  "msg": "request_ok",
}
```

Errors include the same `requestId` so a Sentry issue and a customer support
ticket can be correlated by quoting the `X-Request-Id` response header.
