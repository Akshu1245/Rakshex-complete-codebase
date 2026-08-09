# Rakshex — Dossier vs. Code Reality Audit

**Date:** 2026-08-08
**Addendum (2026-08-09):** §2 ("the defect that matters most" — two live
policy engines) is now fixed and verified; see `docs/POLICY_ENGINE_UNIFICATION.md`.
DevPulse branding fixes noted in §4 remain accurate. The rest of this
document (§1, §3, §5, §6) was not re-verified on this date — treat those
sections as still open unless a newer doc says otherwise.
**Compared:** `RaksHex_Final_Master_Idea_Market_Product_Funding_and_Go_Live_Dossier_2026.md` (v4.0, 2 Aug 2026) against direct inspection of the actual codebase at `Rakshex-complete-codebase-main`, cross-checked against the repo's own `docs/hackathon-repo-audit.md` and `docs/hackathon-gap-analysis.md` (both dated today, 2026-08-08 — the most current ground truth in the repo).
**Method:** status tags below follow the repo's own convention — VERIFIED / PARTIAL / MOCKED / DOCS-ONLY / BROKEN / STALE — because re-inventing a weaker standard would be a step backward from what's already in the repo.

---

## 0. The headline finding the dossier doesn't know about

The dossier's "Product Truth Today" section (and its whole P0 list) was written as if the codebase has one coherent story. It doesn't. The repo currently contains **two different self-descriptions of the same product**, roughly one month apart:

- `CLAUDE.md` (2026-08-06) and the dossier itself describe "Agent Firewall": semantic actions, delegated authority with attenuation, hash-chained Action Ledger, credential mediation.
- `README.md`, `docs/ARCHITECTURE.md`, `docs/FEATURE_MATURITY.md`, `docs/GAP_INVENTORY.md`, `PITCH_FOR_JUDGES.md` (all 2026-07-30) describe an older product — scanner-core, prompt-injection/PII findings, AgentGuard SDK telemetry, kill switches, pricing/compliance — and **never mention** action-control, Agent Firewall, delegated authority, or the Action Ledger at all.

Anyone who reads only `PITCH_FOR_JUDGES.md` will not learn the Agent Firewall exists. Anyone who reads only `CLAUDE.md`/the dossier will not learn the scanner/SDK story is still live and load-bearing. **Fix before writing any new external-facing material**, not after — otherwise new copy gets stitched onto one stale half of the story.

There is also a **naming collision**, confirmed by direct file read, not assumption — three unrelated systems in this repo answer to "AgentGuard" or "Agent Firewall":

1. `apps/api/api/agentGuard.ts` — prompt/response scanning (`scanPrompt`, `scanResponse`). Real, works.
2. `apps/api/api/agentFirewall.ts` (1,261 lines) — the actual Agent Firewall the dossier is about: action-control, ledger, delegated authority, brokered credentials. Real, substantial.
3. `apps/api/services/agentguard/engine.ts` — cloud-secret risk scoring that revokes/rotates Azure Key Vault secrets. Real, wired, but it's secret-lifecycle automation, **not** AI runtime governance.

If a design partner, judge, or investor asks "what does AgentGuard do," three different true answers exist in this codebase. Rename before anyone outside the team reads the code.

---

## 1. Dossier's P0 list vs. what's actually in the repo

The dossier (Section "Product Truth Today" / "Must build for the focused core") lists five P0 items as work still to be done. Direct inspection shows the dossier **underestimates existing progress on three of the five** and is correct that two are missing.

| Dossier P0 item | Dossier's assumption | Verified reality | Status |
|---|---|---|---|
| Agent Identity Registry | Must build from scratch | No dedicated identity-registry table/module found (`agentIdentity`, `identityRegistry` — zero matches). Agent identity today is implicit in `agentFirewall.ts`'s principal/agent fields, not a first-class registry with lifecycle state. | **Dossier is right — genuinely missing.** |
| Semantic Action Standard | Must build from scratch | `packages/action-control/src/semanticActions.ts` already exists and is wired into `agentFirewall.ts`. Not the full versioned multi-provider namespace the dossier describes (financial/code/database/comms/identity/cloud domains), but the core mechanism is real, not zero. | **PARTIAL — dossier overstates the gap.** Extend, don't rebuild. |
| Delegated Authority | Must build from scratch | `packages/action-control/src/authority.ts` implements exactly this: scoped grants, `validateAttenuation()`, `actionsCovered()`/`constraintCovered()` with the deliberate empty-list-means-deny-all vs. empty-list-means-no-restriction asymmetry (this was the subject of a real security fix — see CLAUDE.md's attenuation-bypass note). 61 tests per CLAUDE.md. | **VERIFIED, already substantially built.** Dossier's "must build" framing is wrong here. |
| Shadow Mode | Must build from scratch | `packages/action-control/src/evaluate.ts:94` already has `input.mode === "shadow"` forcing `effectiveDecision` to `ALLOW` while the real `decision` is still computed and recorded. This is the shadow-mode primitive. **Related known defect:** this is exactly the mechanism behind the "shadow-mode laundering" bug CLAUDE.md documents — the credential broker had to be fixed to require the *true* decision be ALLOW, not just the shadow-laundered `effectiveDecision`, or it would have executed every denied action while "just observing." | **PARTIAL — the engine primitive exists and has already needed one real security fix.** What's missing is the customer-facing product wrapper: a Shadow Mode report/dashboard showing would-allow/would-deny/would-approve distributions per agent, which is what the dossier's pilot script actually needs. |
| Action Ledger | Must build from scratch | `apps/web/components/agent-firewall/LedgerTimeline.tsx`, `apps/web/app/agent-firewall/page.tsx` (740 lines, 7 live tRPC queries, no mock data found on inspection), `apps/api/services/ledgerSiemExport.ts` all exist and are wired end to end per the repo's own audit. | **VERIFIED, already substantially built.** Dossier's "must build" framing is wrong here too. |

**Net correction to the dossier:** of its five P0 items, two (Agent Identity Registry, and the productized Shadow Mode report) are genuinely greenfield. Three (Semantic Actions, Delegated Authority, Action Ledger) already have real, tested, non-mocked code — the work remaining on those three is extension and productization, not new-system construction. This changes the effort estimate in the dossier's "Next 30 days" plan materially downward for those three items.

---

## 2. The defect the dossier never mentions, and it's the one that matters most

**Two live, incompatible policy engines**, confirmed with file:line evidence by the repo's own audit:

- `apps/api/engines/policyEngine.ts:208` — priority-sorted, first-match-wins, vocabulary `allow|block|redact|alert_only|require_approval`.
- `packages/policy-engine/src/evaluate.ts` — compiled `PolicyDocument`, vocabulary `allow|deny|redact|warn|require_approval` (different words for overlapping concepts). This is the one `apps/api/services/gateway/enforcement.ts` actually uses.
- A compatibility shim, `apps/api/services/policyDecisionCompat.ts`, exists **solely because the two vocabularies don't line up**, and fails closed to `"deny"` for unrecognized strings.
- A differential test, `apps/api/engines/policyEngine.differential.test.ts`, runs 10 policies through both engines. **7 agree. The other 3 are asserted as `expectDivergence` — the test's final line is `expect(agree).toBe(corpus.length - 3)`.** This means the disagreement is not an open bug someone forgot to fix — it is currently a *passing, pinned, intentional* test outcome. The three divergent cases are: network-destination policy is unenforceable in the app engine at all; prompt threat-level is unenforceable in the package engine at all; and cross-category rule priority means the opposite thing in each engine (a tool rule can override a model rule in one engine and can't in the other).

**Why this is the single highest-priority item, ahead of anything in the dossier's roadmap:** the dossier's entire pitch is "AI decides what it wants to do; RaksHex decides whether it is allowed to." If the answer to "is this allowed" depends on which internal code path handled the request, that sentence is not true today, and a technical buyer who finds the differential test file during diligence will find the company's own code admitting it. This is not a roadmap item to schedule after design partners — closing it, or at minimum re-routing every governance decision through one engine, has to happen before the "90-second demo script" the dossier proposes, because the demo's DENY moments are exactly the kind of decision this defect can flip.

**What the repo's own audit recommends, and I'd endorse it:** don't delete either engine yet — they encode different capabilities (the package engine has no threat-level concept at all; the app engine has no per-rule priority override). The real fix is to extend `PolicyDocument`'s schema to cover threat-level and priority-override, migrate the app engine's call sites onto it, and keep the differential test as a permanent regression gate that should read `expect(agree).toBe(corpus.length)` once done — zero permitted divergence, not three.

---

## 3. Claims found to be false or stale, with exact locations

| Claim | Where | Verdict |
|---|---|---|
| "residual DevPulse branding removed from user-facing runtime paths" | `docs/GAP_INVENTORY.md` | **False.** `runtimeClaims.test.ts` (the legal guardrail CLAUDE.md relies on) only scans `apps/web`, `apps/vscode-extension`, `apps/api/email.ts` — it has a blind spot over the rest of `apps/api`. Two live leaks existed outside that scan: `apps/api/api/quickScan.ts:119` (a user-facing signup CTA: *"Create a free DevPulse account..."*) and `ARCHITECTURE_FOR_JUDGES.html` (page title + body text). **Both fixed in this session** — see §5. |
| "Product/feature gaps — NONE remaining" | `docs/GAP_INVENTORY.md` | Contradicted by its own repo the same day this audit was written — the two-engine defect, the missing Agent Identity Registry, and the DevPulse leaks above all existed simultaneously with this claim. |
| "Market-ready for private beta," cites `docs/MARKET_READY_COMPLETE.md` | `PITCH_FOR_JUDGES.md` | **Dangling reference** — that file was deliberately deleted per CLAUDE.md's own account of the 2026-08-05 doc purge. Judge-facing collateral citing a file that doesn't exist. |
| "All product surfaces code-complete and test-covered," every row "Available" | `docs/FEATURE_MATURITY.md` | **STALE.** Dated 2026-07-30, predates the Agent Firewall entirely — zero rows for it. CLAUDE.md itself already warns not to trust this file; the warning is correct and still unresolved. |
| Package responsibility table omits `@rakshex/action-control` | `docs/ARCHITECTURE.md` | Accurate for what it lists, silent on the package that is now the strategic core of the company per the dossier. |
| Cost-control / pricing accuracy | `packages/pricing-engine/src/catalog.ts` | The code is real (not mocked), but the per-model rate table is a **hand-maintained static snapshot** with no live-price-feed mechanism, by its own code comment. Not a lie, but "controls cost" should not be said without the caveat that prices can silently drift stale. |
| 7 duplicate migration files under `0012`–`0018` that shadow wired migrations `0014`–`0020` | `packages/database/drizzle/` | Not currently harmful (excluded from `MIGRATION_ORDER`), but a landmine for any future script that runs `*.sql` by filename glob instead of the array. Should be deleted, not left. |
| `backend/github-router.ts` | repo root | Orphaned, not in `pnpm-workspace.yaml`, imports paths that don't resolve in the current layout. Dead code sitting where a reader would trip over it. |

---

## 4. What was fixed in this session (real, verifiable)

- `apps/api/api/quickScan.ts:119` — "DevPulse" → "Rakshex" in the live signup CTA string.
- `ARCHITECTURE_FOR_JUDGES.html` — page `<title>` and body copy — "DevPulse" → "Rakshex."

Both are mechanical, low-risk, single-string edits. Neither required a judgment call, which is why they were done immediately rather than queued.

---

## 5. Everything else, in the order I'd actually do it

This list is longer than "everything" can mean in one sitting — treat it as the backlog, sequenced by what blocks what, not as same-day work.

**Before touching anything customer-facing:**
1. Unify the two policy engines (§2). This blocks every other governance claim in the dossier and should gate the "90-second demo."
2. Delete the 7 orphaned duplicate migrations and the orphaned `backend/github-router.ts`.
3. Reconcile the two doc timelines (§0): retire or clearly date-stamp `README.md`, `docs/FEATURE_MATURITY.md`, `docs/GAP_INVENTORY.md`, `PITCH_FOR_JUDGES.md` so nobody reads a pre-Agent-Firewall description as current. Fix the dangling `MARKET_READY_COMPLETE.md` reference.
4. Resolve the "AgentGuard" naming collision — three things cannot keep the same name once this is shown to anyone outside the team.
5. Repo-wide grep for "DevPulse" beyond the two fixed spots and beyond `runtimeClaims.test.ts`'s current scan — the blind spot in that test means there could be others it wouldn't catch; widen the test's scan paths to cover all of `apps/api`, not just three subpaths.

**Then, the dossier's genuinely-missing P0s:**
6. Agent Identity Registry — build new: stable agent ID, owner, framework/version, environment, lifecycle state.
7. Shadow Mode product wrapper — build new on top of the existing `evaluate.ts` primitive: a report surface showing would-allow/would-deny/would-approve distributions, since the underlying engine flag already exists.

**Then P1, per the dossier, once P0 is real:**
8. Approval engine, cumulative/sequence controls, policy replay/diff, credential mediation hardening (`credentialBroker.ts` already has real invariants per CLAUDE.md — extend, don't rebuild).

**Do not start yet, explicitly out of scope until the above is done:**
- Hindsight/cascadeflow integration (referenced in `docs/hackathon-gap-analysis.md`) — confirmed zero prior code, large net-new scope, and per that same doc's own recommendation, should not be allowed to touch `apps/api/engines/policyEngine.ts` at all while the two-engine defect is unresolved, to avoid a live demo exposing the inconsistency.

---

## 6. Open decisions that need your call before I keep building

- **Policy engine unification approach**: extend `PolicyDocument` to absorb threat-level + priority-override (the repo audit's recommendation), or pick the app engine as canonical instead? These are different multi-day efforts with different regression risk — I'd rather confirm than guess on production authorization logic.
- **Which product story is canonical right now** — scanner/SDK/compliance (the 07-30 docs) or Agent Firewall (the dossier)? The dossier says concentrate on Agent Firewall and treat the rest as supporting surfaces; confirming that's still the call before I start rewriting docs to match.
- **Naming fix for the three "AgentGuard" systems** — I have a preference (keep "Agent Firewall" for #2 only, rename #1 to something like "Prompt/Response Scanner," rename #3 to "Secret Lifecycle Guard") but this is a product-naming decision, not a technical one — your call.

I'd suggest we lock the policy-engine approach next, since it's the one item blocking almost everything else on this list.
