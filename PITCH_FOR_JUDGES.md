# Rakshex — Pitch for Judges

**[0:00–0:20] The Problem**

Teams shipping AI agents end up with 4–6 disconnected tools: routing, security filters, logging, and cost dashboards that do not talk to each other. Prompt injection, shadow APIs, and runaway LLM bills slip through the gaps.

**[0:20–0:45] Our Solution**

Rakshex is a single AI runtime governance platform that sits in front of (or beside) every AI call.

Real things we do today:

- Deterministic API + AI surface scanning (collections, OpenAPI, shadow endpoints)
- Prompt-injection and PII signals with policy-as-code (YAML)
- AgentGuard Node & Python SDKs for telemetry without storing raw prompts by default
- Kill switch + budget enforcement with Redis-fast path and durable audit
- LLM cost attribution (including thinking tokens) and forecasts
- MCP security inventory and compliance control mapping (non-certified reports)

**[0:45–1:10] Product proof**

- Monorepo: Express/tRPC API, Next.js dashboard, CLI, VS Code extension, GitHub Action
- Auth: Argon2id, MFA, workspace RBAC, hashed API keys
- Security defaults fail closed in production (Redis, email, GitHub App, CORS allowlist)
- Automated tests: unit, security, integration, smoke, Playwright suite

**[1:10–1:30] Market readiness**

Code is market-ready for private beta and self-serve free/Pro (July 2026 audit). Live billing keys, production secrets, and legal entity fields are operator steps — not missing features.

**[1:30–1:45] Ask**

Pilot design partners + waitlist conversion. We ship governance, not another generic LLM wrapper.

---

See also: `docs/MARKET_READY_COMPLETE.md`, `JUDGES_PITCH_DECK.html`.
