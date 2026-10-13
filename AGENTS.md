# AGENTS.md

## Role
You build. The human describes the product in one paragraph. You select stack, UI kit, skills, and components. No per-widget questions.

## Always
1. Read this file.
2. Use Context7 before coding against a library.
3. Use 21st or shadcn CLI before inventing a component.
4. Use Playwright to verify a UI path you just created.
5. Use find-skills when you lack a procedure.

## Stack
- Web app: Next.js App Router + TypeScript + Tailwind v4 + shadcn/ui
- Dashboard chrome: shadcn-admin patterns (sidebar, topbar, table, drawer, settings)
- Marketing motion: Magic UI / Aceternity-style via shadcn CLI or 21st search — never a second design system
- App blocks: ReUI / Kibo / Origin / 21st catalog when a block already exists
- Chat / agent UI: assistant-ui or CopilotKit (controlled generative UI = OUR components)
- Python / multi-agent backends: FastAPI
- SaaS auth + billing: Better Auth or Auth.js + Stripe or Polar from a known starter. Do not hand-roll auth.
- VS Code extension: official VS Code contribution model + webview. Webview UI still uses the same tokens as the web app if a companion dashboard exists.
- CLI: one command surface, JSON + human output.

Forbidden: MUI, Chakra, Ant, Bootstrap, random CSS frameworks, a second icon set, a second color system.

Install UI with:
```bash
npx shadcn@latest add <name>
# or 21st search + install
```
Never hand-roll Button, Input, Table, Dialog, Form, Sidebar, Tabs, Chart.

## UI kit by idea

### A. Landing / waitlist / launch
shadcn + Magic UI / Aceternity / 21st marketing blocks. nav, hero + one CTA, proof, 3-feature bento, pricing, FAQ, footer. Dark, sparse, high contrast. No dashboard shell on a marketing page.

### B. B2B SaaS dashboard (security, cost, compliance, admin)
shadcn-admin + ReUI/Kibo/21st app blocks. sidebar app, KPI row, filterable table, detail drawer, settings, billing. Look: Linear / Vercel / Stripe. Dense and quiet. Trust > decoration.

### C. Conversational / WhatsApp / voice console
assistant-ui or CopilotKit. transcript, tool-call cards, citations, approve/reject for side effects. Mobile-first empty states. English first; Kannada-ready copy structure.

### D. VS Code extension + optional companion CLI / web
Extension: package.json contributes, commands, views, webview or TreeView. Webview: same shadcn tokens as the SaaS dashboard if both exist. Marketing site for the extension uses kit A only. Never wrap a fake Next.js dashboard inside the webview.

### E. India ops tools (GST, clinic, school, RTO, forms)
shadcn forms + tables + stepper + printable/PDF output. Large tap targets, obvious primary button, bilingual-ready strings.

## Strategy precedence

Before planning, coding, reviewing, or documenting any RaksHex work:

1. Read `STRATEGY_LOCK.md`.
2. Read the GitHub issue assigned for the current task.
3. Treat `STRATEGY_LOCK.md` as authoritative if README files, older docs,
   pitch material, comments, or previous instructions conflict with it.
4. Do not infer production readiness from staging deployments, implemented
   source code, demonstrations, or issue closure.
5. Do not work on frozen scope unless the assigned issue explicitly
   authorizes that work.

## RaksHex — locked product direction

RaksHex is the authorization and execution-control layer for AI agents.

No consequential action proceeds without:

- valid delegated authority;
- policy enforcement;
- controlled credential use by the trusted RaksHex broker;
- verifiable authorization and execution evidence.

The central milestone is:

> One real agent → one Stripe test-mode refund → one enforceable credential
> boundary → one verifiable execution outcome.

### Non-negotiable invariants

- The agent must never receive the raw provider credential.
- The trusted broker executes only the exact authorized provider operation.
- Authority must be revalidated immediately before execution.
- Authorization receipts and execution receipts are different records.
- An `ALLOW` decision never proves provider execution succeeded.
- Retries must not create duplicate provider operations.
- Provider timeouts create uncertain outcomes requiring reconciliation.
- Historical receipts must never be rewritten.
- Unverifiable authority, policy, approval, credential, or execution state
  must fail closed.

### Current engineering order

Work only on the priority authorized by the current tracking issue:

1. Cloudflare browser authentication, memberships, RBAC, and tenant
   isolation.
2. Human approval expiry, rejection, revocation, and single-use consumption.
3. Stripe test-mode credential broker.
4. Idempotency, execution safety, and provider reconciliation.
5. Signed execution receipts and independent verification.
6. Customer validation with real agent builders.

Do not skip ahead to a later priority unless its dependencies and acceptance
gates are demonstrably complete.

### Frozen scope

Do not expand:

- API or secret scanning;
- MCP-security features;
- the VS Code extension;
- additional gateway providers;
- cost dashboards or general AI-governance dashboards;
- speculative Rust migration;
- additional cloud migrations;
- unrelated provider integrations;
- simulated production data or demonstrations.

Existing frozen code may receive security fixes or changes strictly required
to keep release gates passing.

### Deployment

- Cloudflare is the primary hosted-product deployment path, subject to the
  release, security, concurrency, durability, and recovery gates in
  `STRATEGY_LOCK.md`.
- Docker remains for local development, reproducible testing, and optional
  self-hosting.
- Do not present staging as production.
- Do not merge pull requests merely because they are complete in isolation.
  Reconcile dependencies, preserve existing production data and signed
  receipts, and run the required gates on the exact final commit.

### Definition of done

A task is done only when:

- the assigned acceptance tests pass;
- tenant isolation and fail-closed behavior are tested where relevant;
- no raw credential is exposed to an agent;
- authorization evidence is not represented as execution evidence;
- implementation status is classified accurately as implemented, tested in
  staging, unverified, or not implemented;
- the final commit passes the required CI and security gates.

## How you research
1. Context7 / ctx7 docs for that library + current version.
2. Component exists?: 21st search → shadcn registry → ReUI.
3. Repo/API/issue behavior: Firecrawl or GitHub search. Read README and last relevant issue/PR.
4. UI you just built: Playwright — open it, click the primary path, fix what broke.
5. Missing workflow: find-skills, install one skill, follow it.

Do not invent APIs from memory when Context7 is available.

## Definition of done
One user path works end-to-end with real kit UI, current docs, and no placeholder buttons.

## Stop rule
After a working slice, name the next 3 files. Do not expand scope.
