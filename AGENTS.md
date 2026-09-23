# AGENTS.md

## Product truth — one story

**RaksHex is an AI agent Action Control Plane (Agent Firewall).**

The product thesis, in one flow:

1. An agent proposes a consequential semantic action (e.g. `financial.refund`).
2. RaksHex validates delegated authority (attenuated capability tokens) and evaluates policy server-side.
3. The decision is `ALLOW | DENY | APPROVAL_REQUIRED | LIMIT | PAUSE | FREEZE` — **before** the action executes.
4. Credential mediation: the agent never holds secrets; the fail-closed broker releases a credential only on the true `ALLOW` decision, single-use, fresh, origin-pinned, SSRF-blocked.
5. The Action Ledger records authorization evidence in a hash-chained, tamper-evident log, with Ed25519-signed receipts exportable as verifiable bundles.

**Not the story:** a secrets scanner, an LLM cost dashboard, or "stop AI agents burning your API budget". That was the pre-pivot DevPulse product. Scanner rules, prompt-injection detection, and gateway budget/kill-switch observability are *layers inside* the control plane — never the lead.

## Architecture map

| Layer | Location | What it does |
|---|---|---|
| Agent Firewall router | `apps/api/api/agentFirewall.ts` | evaluate, approvals, credential broker, ledger writes, SIEM export |
| Deterministic evaluation | `packages/action-control` (`evaluate.ts`, `authority.ts`) | policy brain as pure functions; delegated authority with attenuation |
| Declarative policy engine | `packages/policy-engine` | YAML policies → compiled, prioritized rule evaluation |
| Credential broker | `apps/api/services/credentialBroker.ts` | fail-closed: AES-256-GCM secrets, single-use egress, 5-min freshness, origin pinning, SSRF/private-host blocking |
| Action ledger | `apps/api/services/receipts/actionReceipts.ts` + `@rakshex/database` schemas | SHA-256 hash chain + Ed25519 signatures + canonical JSON; signed receipt bundles/PDF with chain verification |
| Node SDK | `packages/sdk` (`AgentFirewallClient`) | `evaluate`, `authorizeAndRun` (advisory — documented as such), `executeWithCredential` (enforced), `consumeApproval`, `recordOutcome` |
| Python SDK | `packages/agentguard-python` | mirrors the Node client (stdlib-only HTTP); **not published on PyPI** |
| Scanning layer | `packages/scanner-core` | secrets + prompt-injection-surface rule engine; `mcp-security` scans MCP servers; GitHub App PR scanning |
| Prompt-injection engine | `apps/api/engines/promptInjectionEngine.ts` | static + runtime multi-layer detection (baseline-grade, self-documented limits) |
| VS Code extension | `apps/vscode-extension` | scanner UI, gateway tester, control-plane panel; published as `rakshex.rakshex-vscode` |
| CLI | `apps/cli` | `rakshex scan`, secrets commands — one command surface, JSON + human output |
| Web | `apps/web` | marketing site + dashboard (firewall decisions, compliance evidence, billing, docs) |

Gateway proxies (OpenAI, Azure OpenAI, OpenRouter, Anthropic, ElevenLabs): enforcement applies **only to RaksHex-routed traffic** — never claim a kill switch for bypass traffic.

## Honesty rules (non-negotiable)

- Status is **private beta, uncertified, pre-revenue, no production deployment**. Never pitch it as more.
- **Never invent** users, metrics, traction, pilots, revenue, waitlist numbers, or testimonials. Every claim must be code-true.
- Compliance surface is **evidence mapping only** — no SOC 2 / ISO / GDPR certification claims from repo code.
- Demo pages and demo mode are labeled simulations; keep them labeled.
- Test counts: cite only verified numbers with dates. The 2026-07-30 "874 tests" snapshot predates the Agent Firewall — **do not quote it**. DB-backed integration tests, Playwright e2e, and CI-green-on-HEAD need a live environment to verify.
- Older dated docs (audit snapshots, gap registers, launch drafts) carry their own `CORRECTION` banners and are historical — never use them as current evidence. Current source, current CI, `CLAUDE.md`, and root `README.md` take precedence.

## How you work

1. **Read this file** and `CLAUDE.md` (engineering handoff). Locked libraries live in `STACK.md` — do not swap them.
2. Context7 before coding against an unfamiliar library.
3. shadcn CLI or 21st before inventing a component.
4. Playwright-verify any UI path you create.
5. Stop after one working vertical slice and name the next three files.

## Build conventions

- Web: Next.js App Router + TypeScript + Tailwind v4 + shadcn/ui. Dashboard chrome follows shadcn-admin patterns (sidebar, topbar, table, drawer, settings). Marketing pages: hero + one CTA, sparse, high contrast. No dashboard shell on a marketing page.
- VS Code extension: official VS Code contribution model; webview uses the same shadcn tokens as the web app. Never wrap a fake dashboard in a webview.
- CLI: one command surface, JSON + human output.
- Python backends: FastAPI.
- SaaS auth + billing: Better Auth/Auth.js + Stripe/Razorpay from a known starter. Do not hand-roll auth.

Forbidden: MUI, Chakra, Ant, Bootstrap, random CSS frameworks, a second icon set, a second color system. Never hand-roll Button, Input, Table, Dialog, Form, Sidebar, Tabs, Chart.

## Definition of done

One user path works end-to-end — a firewall decision, a policy evaluation, or a scan — with real UI, current docs, and no placeholder buttons. A DENY must be verifiable, not claimed.

## Stop rule

After a working slice, name the next 3 files. Do not expand scope. Do not re-litigate product positioning; it is locked above.
