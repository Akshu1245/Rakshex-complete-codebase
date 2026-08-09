# RaksHex — agent handoff

**Last verified:** 2026-08-06 (every claim below was executed, not inferred)

Read this file first. It exists so you don't have to re-derive the state of the repo by
reading 10,000 files. Where a claim is unverified, it says so explicitly — trust the
labels, and re-run the commands in §2 before believing anything is still true.

---

## 1. What this is

pnpm + turbo monorepo. "AI agent and API security platform." Previously branded
**DevPulse** — that name is retired and a test (`apps/api/runtimeClaims.test.ts`) fails
the build if it reappears in shipped source.

The strategic positioning is the **Agent Firewall**: runtime authorization for
autonomous AI actions. The one-line differentiator, which is defensible and narrow:

> Competitors govern the *session*. RaksHex governs the *action*.

Concretely: semantic actions (`financial.refund`), delegated authority with
parent→child attenuation, a hash-chained tamper-evident Action Ledger, and
credential mediation so a DENY is enforceable rather than advisory.

- **API** — `apps/api`, Express + tRPC, port 3000
- **Web** — `apps/web`, Next.js, port 3001
- **Packages** — `packages/*`, all `workspace:*`

---

## 2. Verified state — run these to confirm

```bash
pnpm install
pnpm lint          # clean, --max-warnings=0
pnpm typecheck     # 18/18 packages
pnpm build         # 18/18
pnpm test:api      # 872 tests, 81 files (was 831 — +policy differential corpus, +SIEM export)
pnpm test:packages # 158 tests
```

With Postgres + Redis running (`docker compose up -d postgres redis`):

```bash
pnpm db:migrate       # 26 migrations
pnpm test:integration # 57 tests
pnpm test:db          # VERIFIED 2026-08-06 on real Postgres 18.4 — 10/10 pass, see §5 item 1
pnpm test:e2e         # NOT VERIFIED — needs API + web up
```

**As of 2026-08-05 the first two blocks pass.** The API boots against a live DB and
`/api/health` returns `{"status":"ok","db":"ok","redis":"ok","queue":"ok"}`.

> **Important history:** before 2026-08-05 this repo **did not typecheck** — 7
> pre-existing errors, including four calls to DB functions that did not exist. That
> means the CI typecheck gate was not being enforced. Several status docs asserted
> "code-complete and test-covered" while the build was broken. Seven of them were
> **deleted on 2026-08-05** (`MARKET_READY.md`, `MARKET_READINESS_LAUNCH_BAR.md`,
> `LAUNCH_BAR.md`, `PRODUCTION_READINESS_REPORT_2026-07-30.md`,
> `rakshex_verification_report.md`, `docs/MARKET_READY_COMPLETE.md`,
> `ARCHITECTURE_AUDIT.md`) because a future reader inheriting their false baseline is
> worse than having no status doc at all. **This file is now the only status doc.**
> `docs/FEATURE_MATURITY.md` and `docs/GAP_INVENTORY.md` survive but are still dated
> 2026-07-30 — treat them as marketing, not evidence. Some docs still contain dangling
> links to the deleted files; harmless, but fix on sight.

---

## 3. Completion, honestly

Percentages are meaningless without an axis, so here are four. Overall single number
if you must have one: **~72%** — but read the rows, because they disagree for good
reasons.

| Axis | % | Basis |
|---|---|---|
| **Code exists & compiles** | ~95% | lint + typecheck + build all green, executed |
| **Verified by execution** | ~75% | 1046 tests pass; app boots; migrations apply/roll back; routes mounted |
| **Proven correct in domain terms** | ~40% | tests passing ≠ features behave correctly. ~20 of 296 API files have been read closely |
| **Business / ops / legal ready** | ~30% | legal review, pen test, live payment keys, SOC2, support all outstanding |

**Do not tell the user this is "100% market ready."** It is not, and the gap is
specific and listed in §5 — not vague.

### What is genuinely done and proven

- Agent Firewall core (`packages/action-control`) — 61 tests
- Credential mediation — service, schema, router, SDK, UI; 58 unit + 10 real-socket tests
- MCP adversarial-intent scanning — 11 tests
- All 26 migrations apply **and roll back**, verified on real Postgres 18.3
- Anti-replay is enforced by a **DB unique index**, proven by a failing duplicate insert
- App boots; every new tRPC route confirmed mounted and auth-gated

---

## 4. What changed recently (and why it matters)

### Security fix — attenuation bypass (`packages/action-control/src/authority.ts`)

`validateAttenuation()` accepted a child authority that **omitted** `resources` /
`environments`, and an omitted constraint means *unrestricted* at evaluation time —
so the child was strictly **broader** than its parent. This falsified the product's
headline claim. Fixed via two helpers with deliberately opposite semantics:

- `actionsCovered()` — empty list means **deny all** (restrictive)
- `constraintCovered()` — empty list means **no restriction** (permissive)

That asymmetry is the whole point. Do not "simplify" them back into one function.

> **Behaviour change:** existing authorities in a live DB that omit these fields under
> a scoped parent will now be **rejected**. Audit production data before deploying.

### Credential mediation (the enforcement story)

`apps/api/services/credentialBroker.ts` — all security decisions live in the **pure**
`authorizeBrokeredRequest()` so they are exhaustively testable. Router wiring is in
`apps/api/api/agentFirewall.ts` under `credentials`.

Non-obvious invariants, each of which has a test:

1. **Shadow-mode laundering.** In shadow mode `effectiveDecision` is ALLOW even for a
   DENY. Brokering on that alone would execute every denied action. The broker
   requires the **true `decision`** to be ALLOW too.
2. **Claim before spend.** The egress row is inserted *before* the secret is
   decrypted. The unique index on `ledger_id` means two racing calls cannot both win.
3. **No redirects.** `redirect: "manual"` — a 302 could send the credential to an
   unvetted host.
4. **Secret never leaves the server.** `credentials.list` uses an explicit column list,
   never `select()`. Never add `secretCiphertext` to a response.

### SDK/router scope mismatch on `ledger.outcome` — fixed 2026-08-09

Found by comparing what `packages/agentguard-sdk/src/firewall.ts`'s
`AgentFirewallClient` actually calls against what
`apps/api/api/agentFirewall.ts` actually requires, endpoint by endpoint —
not by reading either file in isolation. `evaluate` and `credentials.broker`
both authorize a runtime call via
`assertRuntimeApiKeyScope(ctx.user, workspaceId, "agent:execute")` — the
scope on the API key itself, independent of the underlying user's workspace
RBAC role. `ledger.outcome` instead required the full `security:write` RBAC
permission (minimum role `security_lead`, rank 5 of 7). The SDK's
`recordOutcome()` is called by the exact same key that called `evaluate()`,
and `authorizeAndRun()`'s success path awaits it **uncaught** — so a
correctly least-privileged agent key (scope: `agent:execute` only, which is
the product's own recommended deployment shape) would 403 on `ledger.outcome`
even though the action it just took was correctly evaluated and allowed,
and `authorizeAndRun()` would throw after the real work already succeeded.

Fixed: `ledger.outcome` now uses the same `assertRuntimeApiKeyScope(...,
"agent:execute")` check as its two siblings. Verified by execution, not
assumed — a new regression test
(`apps/api/api/agentFirewall.e2e.test.ts`, describe block "runtime key scope
for ledger.outcome (regression)") creates a workspace member with role
`developer` (rank 3, well under the `security_lead` the old check required)
holding an `agent:execute`-only key, and asserts `ledger.outcome` succeeds.
Confirmed this test actually catches the bug by reverting the fix locally
and re-running: 12/13 pass with a `FORBIDDEN` failure on exactly this test;
13/13 pass with the fix restored. Full `apps/api` typecheck: 0 errors.

### Missing DB functions implemented (`apps/api/db.ts`)

`getAuditLogForUserPage`, `getScansPageByCollectionId`, `saveScanWithFindings`,
`createWorkspaceWithOwner`, `getLatestComplianceScoresForUser`. The middle two are
**transactional** — their call sites always documented them as atomic but they did
not exist at all. Also: `recordTokenUsage` was silently discarding cost attribution
despite the columns existing since migration 0013.

---

## 5. Known gaps — start here

0. ~~**TWO POLICY ENGINES ARE LIVE AT ONCE.**~~ **RESOLVED 2026-08-09** — see
   `docs/POLICY_ENGINE_UNIFICATION.md` for the full account. Original finding
   (2026-08-06), kept for history: two different functions both called
   `evaluatePolicy`, incompatible data models, both live on different request
   paths (`apps/api/engines/policyEngine.ts` vs `packages/policy-engine`),
   with a differential test proving 3 of 10 real policy intents got different
   verdicts depending only on which code path handled them.

   **Fix, verified by execution, not asserted:** `packages/policy-engine`
   gained a generic, priority-ordered `rules` field (`GenericRule` in
   `types.ts`) that is a faithful port of the app engine's entire condition
   model — every operator, threat-level comparison, multi-tool matching.
   `apps/api/engines/policyEngine.ts` is now a thin adapter that delegates
   every decision to that mechanism and translates types/vocabulary at the
   boundary; its external contract (types, function signature, return shape)
   is byte-identical, so `middleware/policyEnforcement.ts`,
   `services/policyCache.ts`, `api/policies.ts`, `api/policyRules.ts`
   required zero changes. There is now exactly one function that makes
   policy decisions.

   Verified this session against a real local install (not read-only code
   review): `packages/policy-engine` 14/14 tests pass; the **unmodified**
   `apps/api/engines/policyEngine.test.ts` 21/21 pass (proves behavioral
   equivalence to the old standalone engine); the differential test now
   asserts 9/10 agreement (up from 7/10) with 12/12 passing;
   `promptInjectionEngine.test.ts`, `services/gateway/enforcement.test.ts`,
   `services/policyDecisionCompat.test.ts` — 83 more tests, all pass; full
   `apps/api` TypeScript compile — 0 errors.

   **One item remains genuinely open, not an engine gap:** `AIEventContext`
   (the AI-telemetry event shape) has no network-destination field at all,
   because that data doesn't exist at the point telemetry events are built.
   This is a data-shape limitation of one event type, not a decision
   disagreement — network policy is correctly enforced in
   `services/gateway/enforcement.ts`, whose context does carry
   `ctx.destination`. Documented as such in the differential test rather
   than left unexplained.

   **A second item is not yet verified:** whichever surface serializes
   dashboard-authored policies into a `PolicyDocument` today (e.g.
   `services/policyAsCode.ts`) should be checked to confirm it actually
   emits `rules` entries for threat-level/priority intents now that the
   engine supports it — the engine-level fix is done, but audit the
   authoring path before claiming every dashboard policy can express these.

1. ~~`pnpm test:db` / `foundation.test.ts` — UNVERIFIED.~~ **VERIFIED 2026-08-06 on
   real Postgres 18.4 — 10/10 pass.** The earlier 6 PGlite failures
   (`Received unexpected rowDescription message from backend`) were confirmed as a
   **PGlite wire-protocol emulation bug**, not a schema defect: same migrations, same
   seed, same test file, zero failures under real Postgres. See §6 for how to get a
   real (non-WASM) Postgres in a sandbox with no root and no Docker — the
   `embedded-postgres` npm package ships native binaries and needs neither.
2. **No authenticated end-to-end broker call.** Route existence and anonymous
   rejection are proven; the full path (sign in → store credential → evaluate → broker
   → egress row) is not. Needs user/workspace/session seeding.
3. **Playwright E2E never run** — needs API + web + DB together.
4. **Ops/legal** — pen test, legal review, live payment keys, `RAKSHEX_VAULT_KEY` in
   the deploy environment.

`RAKSHEX_VAULT_KEY` is now **load-bearing**: `credentials.create` fails closed without
it. Wired into `.env.example`, `render.yaml`, `docker-compose.prod.yml`.

---

## 6. Gotchas that will cost you an hour

- **Migrations are driven by a hardcoded `MIGRATION_ORDER` array** in
  `packages/database/src/migrate.ts` — *not* drizzle-kit's journal, which is stale and
  abandoned after 0001. **A new `.sql` file that isn't added to that array silently
  never runs.** This has already caused a production-shaped bug once.
- There are **two `0012_` migrations** (compliance_report_types, workspace_subscriptions).
  Intentional, ordered by file date. Don't "fix" it.
- `apps/api/tsconfig.json` runs `strict: false`. Wrong-arity and wrong-order function
  calls can slip through review. **Check signatures; don't trust the type checker.**
  `requireWorkspacePermission(workspaceId, userId, resource, action)` — that order,
  four args. `requireWorkspaceMembership(workspaceId, userId)`.
- New `logSecurityEvent` strings must be added to the `SecurityEventType` union in
  `apps/api/services/securityEvents.ts` or typecheck fails.
- Workspace packages must be added to **both** `tsconfig.base.json` and
  `apps/api/tsconfig.json` `paths`.
- The `report_type` enum value is **`pci_dss`**, not `pci`.
- `apps/api/runtimeClaims.test.ts` fails the build on retired brand names and
  unverifiable superiority claims ("India's first", "world-first"). It is a
  **legal guardrail** — fix the copy, don't weaken the test.

### If you're in a sandboxed environment

- Bulk `rsync`/`cp` of the whole repo over a mounted FS times out.
  `tar cf - --exclude=node_modules | tar xf -` into `/tmp` works.
- turbo needs `pnpm` on `PATH`; a `corepack pnpm@10.32.1 "$@"` shim works.
- No root, so no apt Postgres. Two options, and they are not interchangeable:
  - **`@electric-sql/pglite`** gives you Postgres 18 compiled to **WASM**, and
    `@electric-sql/pglite-socket` exposes it over TCP so the real `pg` driver
    connects. Good enough for migrations and most integration tests. **Not** good
    enough for `foundation.test.ts` — 6 tests fail with
    `Received unexpected rowDescription message from backend`, a wire-protocol
    emulation gap in PGlite itself.
  - **`embedded-postgres`** (npm) ships **real native Postgres binaries** per
    platform and runs `initdb`/`pg_ctl` as the current user — no root, no Docker.
    This is what actually resolved `foundation.test.ts` (see §5 item 1, verified
    2026-08-06): `new EmbeddedPostgres({ databaseDir, user, password, port,
    persistent: false }); await pg.initialise(); await pg.start();` then point
    `DATABASE_URL` at it. Prefer this over PGlite whenever a test's failure mode
    is ambiguous between "real bug" and "emulator gap" — it removes the emulator
    as a variable entirely.
- Each bash call is a fresh PID namespace — background servers do not survive between
  calls. Start the server and run the tests in **one** invocation (wrap start →
  migrate/test → `pg.stop()` in a single Node script, not separate bash calls).
- The API boots in dev with `REDIS_URL=""` (falls back to in-memory MockRedis).
  Required env to boot: `DATABASE_URL`, `JWT_SECRET` (32+ chars), `RAKSHEX_VAULT_KEY`.

---

## 7. Working agreement

The user is the founder and moves fast. They have said "I agree with everything you
say" — **do not take that as licence.** Multiple real bugs in this codebase were
introduced by confident, plausible-looking code, including by prior agents. Two were
introduced during the session that produced this file and caught only by checking
actual function signatures against the source.

State confidence honestly, lead with the uncomfortable finding, and verify by
executing rather than by reading. When you can't verify something, say so plainly and
name the command that would settle it.
