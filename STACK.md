# STACK.md — locked libraries

Do not renegotiate these in chat. Change only via PR that updates this file + AGENTS.md together.

## Web
- Next.js App Router
- TypeScript (strict)
- Tailwind CSS v4
- shadcn/ui (components only via `npx shadcn@latest add`)

## Dashboard
- shadcn-admin patterns: sidebar, topbar, table, drawer, settings
- App blocks from ReUI / Kibo / Origin / 21st when a block already exists

## Marketing
- Magic UI / Aceternity-style via shadcn CLI or 21st search
- Never a second design system

## Chat / agent UI
- assistant-ui or CopilotKit
- Controlled generative UI must render OUR components

## Backend
- Python multi-agent: FastAPI
- Existing RaksHex Node API may remain; new Python surfaces use FastAPI

## Auth + billing
- Better Auth or Auth.js
- Stripe or Polar from a known starter
- Do not hand-roll auth or billing

## VS Code extension
- Official VS Code contribution model + webview
- Shared design tokens with companion web app when both exist

## CLI
- One command surface (`rakshex`)
- Human + JSON output modes
- API/OpenAPI scan: `rakshex scan <file-or-dir>`
- Secrets (high-confidence only): `rakshex secrets <path> [--format terminal|json] [--fail-on Critical,High]`
- List secret rules: `rakshex secrets rules`
- Fixture smoke: `apps/cli/fixtures/secrets-sample`

## Tooling / research
- Context7 / ctx7 for library docs
- 21st.dev for component discovery
- Playwright MCP for UI verification
- GitHub MCP / gh when authenticated
- Firecrawl only when `FIRECRAWL_API_KEY` exists; else fetch + Playwright

## Forbidden
MUI, Chakra, Ant Design, Bootstrap, random CSS frameworks, second icon set, second color system, hand-rolled Button/Input/Table/Dialog/Form/Sidebar/Tabs/Chart.
