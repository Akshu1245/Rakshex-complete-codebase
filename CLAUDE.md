# RaksHex — agent handoff

**Last verified:** 2026-08-05 (every claim below was executed, not inferred)

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
pnpm test:api      # 831 tests, 78 files
pnpm test:packages # 158 tests
```

With Postgres + Redis running (`docker compose up -d postgres redis`):

```bash
pnpm db:migrate       # 26 migrations
pnpm test:integration # 57 tests
pnpm test:db          # SEE §5 — not verified, needs real Postgres
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

### Missing DB functions implemented (`apps/api/db.ts`)

`getAuditLogForUserPage`, `getScansPageByCollectionId`, `saveScanWithFindings`,
`createWorkspaceWithOwner`, `getLatestComplianceScoresForUser`. The middle two are
**transactional** — their call sites always documented them as atomic but they did
not exist at all. Also: `recordTokenUsage` was silently discarding cost attribution
despite the columns existing since migration 0013.

---

## 5. Known gaps — start here

1. **`pnpm test:db` / `foundation.test.ts` — UNVERIFIED.** 6 tests fail under PGlite
   with `Received unexpected rowDescription message from backend`. That is a
   **PGlite wire-protocol emulation bug, not a schema defect** — the connection dies
   and the rest cascade. Needs real Postgres. *This is the highest-value 10 minutes
   available to you.*
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
- No root, so no apt Postgres. **`@electric-sql/pglite` gives you real Postgres 18 in
  WASM**, and `@electric-sql/pglite-socket` exposes it over TCP so the real `pg`
  driver connects. Good enough for migrations and integration tests; **not** good
  enough for `foundation.test.ts` (see §5).
- Each bash call is a fresh PID namespace — background servers do not survive between
  calls. Start the server and run the tests in **one** invocation.
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
