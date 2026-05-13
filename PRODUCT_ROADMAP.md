# DevPulse — Product Roadmap (Phase 2 → 6)

**Status of this document:** Living plan. Phase 1 (security hardening + product
positioning) is shipped on `devin/1778265742-phase-1-hardening`. Phases 2 → 6
below are the work that turns DevPulse from "API security + cost monitoring"
into a true **Enterprise AI Runtime Governance Platform** comparable in
positioning to Wiz, Datadog AI, Cloudflare AI Gateway, Lakera, Traceable AI,
and Palo Alto Prisma AIRS.

These phases are sequenced. Each one builds on data, infra, and primitives
introduced in the previous phase. Cutting corners on phase ordering produces
half-built features that don't compose. **All effort estimates assume one
senior full-stack engineer + design + QA support.** A small team of 2-3 can
roughly halve calendar time but not effort.

---

## Phase 1 — Production hardening (✅ complete)

Shipped on this branch. Summary:

- Zod-validated environment schema with fail-fast in production.
- Strict CORS allowlist (`devpulse.in`, `www.devpulse.in`, `app.devpulse.in`).
- Refresh-token rotation foundation (sessions table tracks IP + user-agent +
  expiry; `auth.logoutAllSessions`, `auth.listSessions`, `auth.revokeSession`
  procedures landed).
- Audit log entries on every auth event (login / logout / signup /
  password-reset / lockout / session revoke / logout-all).
- Distributed rate limiting via Redis sorted-sets sliding-window
  (`rateLimitSlidingWindow` in `server/_core/cache.ts`).
- Webhook idempotency table (`processed_webhook_events`) covers Razorpay +
  Stripe replay storms.
- Explicit `ON DELETE CASCADE` foreign keys on every user-owned table
  (migration `0006_cascade_deletes.sql`).
- All outbound `fetch`/`axios` calls have explicit timeouts via
  `fetchWithTimeout`.
- Pino structured logs with PII redaction; Sentry events scrubbed before send.
- Brand: README + landing repositioned around AI Runtime Governance.

What is **not** Phase 1:

- AI runtime telemetry (no SDK ingest, no live AI request stream).
- MCP security governance.
- Security Copilot (no LLM-backed auto-fix engine).
- Multi-tenancy (org/workspace model is single-user-per-account today).
- SOC 2 / ISO 27001 reports (audit logs are present but no auditor framework).
- Load testing with k6.

---

## Phase 2 — AI Runtime Telemetry & Observability (≈ 6–8 weeks)

> **Goal:** ingest, store, query and visualize live AI agent traffic
> (prompt/response/tool-call/cost/latency) across customer codebases with
> sub-second dashboards.

### Deliverables

1. **DevPulse SDK (TypeScript + Python)** — drop-in wrapper around OpenAI,
   Anthropic, Bedrock, Vertex, Cohere, Mistral, MiniMax, Groq, and
   self-hosted Ollama / vLLM. Captures:
   - prompt, response, system message, function/tool calls, tool results
   - token counts (input/output/cached), latency, model, temperature, user_id
   - PII redaction at the SDK layer (regex + ML detector toggle)
   - configurable sampling (1.0 default, 0.1 in high-volume tiers)
2. **Ingestion API** — `/v2/telemetry/events` accepts batched events, signs +
   compresses. Backpressure via 429 + retry-after header.
3. **Storage layer** — append-only event store. Recommend ClickHouse for
   columnar analytics OR TimescaleDB if MySQL/Postgres parity is required.
   Hot tier: 14 days. Warm tier: 90 days S3 parquet.
4. **Live dashboard** — per-agent token spend, latency P50/P95/P99,
   error rate, by-model mix, anomaly markers.
5. **Per-call drill-down** — full prompt/response trace with redaction
   toggles; cost and latency breakdown; tool-call tree view.
6. **Real-time WebSocket stream** — push new events to the dashboard within
   1s of ingest.

### Threat model

- Prompts contain PII / regulated data → redact at SDK before egress.
- Customers send 50k events/sec at peak → ingest must scale horizontally;
  use a Kafka or Redpanda buffer in front of the storage writer.
- A leaked SDK key dumps a customer's entire AI history → keys are
  workspace-scoped + revocable + monthly auto-rotated.

### Schema sketch

```sql
CREATE TABLE ai_events (
  event_id        UUID PRIMARY KEY,
  workspace_id    UUID NOT NULL,
  agent_id        VARCHAR(64) NOT NULL,
  user_id         VARCHAR(128),                -- end-user, hashed
  provider        ENUM('openai','anthropic','bedrock','vertex','cohere',...),
  model           VARCHAR(128) NOT NULL,
  request_ts      TIMESTAMP(3) NOT NULL,
  latency_ms      INT NOT NULL,
  input_tokens    INT NOT NULL,
  output_tokens   INT NOT NULL,
  cached_tokens   INT NOT NULL DEFAULT 0,
  cost_usd        DECIMAL(10,6) NOT NULL,
  status          ENUM('ok','error','timeout','blocked') NOT NULL,
  redaction_count INT NOT NULL DEFAULT 0,
  prompt_hash     CHAR(64) NOT NULL,           -- SHA-256
  prompt_blob_id  UUID,                        -- pointer to S3 if retained
  response_hash   CHAR(64) NOT NULL,
  response_blob_id UUID,
  tool_calls      JSON,
  metadata        JSON
) ENGINE=InnoDB PARTITION BY RANGE (UNIX_TIMESTAMP(request_ts));
```

### Effort

- SDK (TS): 2 weeks
- SDK (Python): 1 week
- Ingest API + auth + rate limit: 1 week
- Storage layer + retention policy: 2 weeks
- Dashboard + WS stream + drill-down: 1.5 weeks
- QA + load test: 0.5 week
- **Total: ~8 weeks single engineer.**

---

## Phase 3 — AI Policy Engine + MCP Security Governance (≈ 6 weeks)

> **Goal:** declarative rules that block/redact/alert on AI traffic
> in real time. First-class support for MCP (Model Context Protocol)
> tool-call inspection.

### Deliverables

1. **Policy DSL** — YAML / JSON rules: match by model, agent, user, prompt
   regex, content classifier, cost threshold, tool name. Actions:
   `allow`, `redact`, `block`, `alert_only`, `require_approval`.
2. **Inline policy enforcement** — wrap SDK calls in a policy middleware.
   Sub-50ms decision latency.
3. **MCP tool registry** — register MCP servers, scan declared tools for
   risk (network egress, file write, shell exec, secret access). Score and
   gate via the policy engine.
4. **Approval workflow** — for `require_approval` actions, a pending queue
   surfaces in dashboard + Slack / email; security can ack within minutes.
5. **Prompt-injection detection** — pre-trained classifier (open-weights
   like Lakera-style or `protectai/deberta-v3-base-prompt-injection`) +
   custom regex layer.

### Threat model (OWASP API Top 10 + LLM Top 10)

- LLM01 prompt injection → classifier + sanitization rules.
- LLM02 insecure output → schema validation on tool args.
- LLM03 data poisoning → out-of-scope (training-side).
- LLM04 model DoS → cost ceiling + rate limit per agent.
- LLM05 supply chain → SBOM scan of MCP servers.
- LLM06 sensitive info disclosure → response-side PII redaction.
- LLM07 insecure plugin design → MCP risk scoring.
- LLM08 excessive agency → tool-call allowlist per agent.
- LLM09 overreliance → out-of-scope (user education).
- LLM10 model theft → request fingerprinting + anomaly detection.

### Effort

- Policy DSL + parser: 1 week
- Inline enforcement middleware (TS + Python SDK): 1.5 weeks
- MCP tool registry + risk scoring: 1.5 weeks
- Approval workflow UI: 0.5 week
- Prompt-injection classifier integration: 1 week
- QA + adversarial testing: 0.5 week
- **Total: ~6 weeks.**

---

## Phase 4 — Security Copilot + Auto-Fix Engine (≈ 8–10 weeks)

> **Goal:** explain findings in plain English and suggest concrete fixes —
> with an opt-in PR-creation flow for OpenAPI / Postman / IaC files.

### Deliverables

1. **RAG corpus** — OWASP API Top 10, OWASP LLM Top 10, CWE catalog,
   PCI DSS v4, GDPR Article references, NIST AI RMF, ISO 27001 control set.
2. **Per-finding explainer** — generate "why this matters" + "how attackers
   exploit this" + "remediation steps" for every scanner finding.
3. **Auto-Fix engine** — for OpenAPI / Postman / IaC findings, generate
   a unified diff + PR via GitHub App. User approves before merge.
4. **Security chat** — open chat on a scan, ask follow-up questions, get
   citations to the corpus + customer's own findings.
5. **Audit-friendly explanations** — every Copilot output is logged to the
   audit table with the model, prompt, response, citations.

### Threat model

- Customer data leaks into prompts → enforce redaction-before-LLM at the
  Copilot service boundary; never send customer secrets to a third-party
  LLM.
- Hallucinated fixes → require unit-test pass + human approval for every
  PR; never auto-merge.
- Prompt injection via finding text → sandbox model with strict system
  prompt + output schema + JSON-mode.

### Effort

- RAG corpus ingestion + chunking + embedding store: 1.5 weeks
- Per-finding explainer + caching: 1 week
- Auto-Fix engine (OpenAPI): 2 weeks
- Auto-Fix engine (Postman + IaC): 1.5 weeks
- GitHub App + PR creation flow: 1 week
- Chat UI + citations: 1 week
- QA + golden-set evals: 1 week
- **Total: ~9 weeks.**

---

## Phase 5 — Multi-tenancy, RBAC, SSO/SAML, Audit Export (≈ 6 weeks)

> **Goal:** enterprise-grade tenancy. Workspace = billing unit. Users join
> 1+ workspace via invitation or SSO mapping.

### Deliverables

1. **Workspace model** — every user-owned table gains a `workspace_id` FK.
   Migration is the bulk of the work and must be done with zero downtime
   (dual-write → backfill → switch read path → drop old column).
2. **Roles** — Owner / Admin / Member / Viewer. Permissions matrix:
   - Owner: billing, delete workspace
   - Admin: manage users, manage policies, all data
   - Member: read all data, run scans, no user mgmt
   - Viewer: read-only dashboards
3. **SSO / SAML** — integrate `samlify` or `node-saml` with Okta, Google
   Workspace, Microsoft Entra. JIT provisioning + group → role mapping.
4. **API-key scoping** — every API key has workspace_id + role; rotating
   doesn't take down running agents.
5. **Audit export** — sign + export the audit log as JSONL or CSV; SIEM
   integrations (Splunk HEC, Datadog Logs).
6. **Data residency** — workspace-level region pin (us-east-1, eu-west-1,
   ap-south-1). Foundation for GDPR / DPDP compliance.

### Effort

- Schema migration + dual-write: 2 weeks
- Roles + permissions middleware: 1 week
- SSO/SAML integration: 1.5 weeks
- API-key scoping: 0.5 week
- Audit export + SIEM webhooks: 0.5 week
- QA + cross-tenant security review: 0.5 week
- **Total: ~6 weeks.**

---

## Phase 6 — Compliance & Enterprise GTM (≈ 8 weeks of code + ongoing audit)

> **Goal:** SOC 2 Type II readiness + ISO 27001 readiness + load + DR.

### Deliverables

1. **Compliance reports v2** — SOC 2 Trust Service Criteria mapping with
   evidence collection (audit log queries, control checklists, exportable
   PDF). PCI DSS v4 + GDPR + DPDP Act 2023 mappings.
2. **Real load testing** — k6 scenarios:
   - 1k concurrent scans for 10min
   - 50k AI events/sec ingest sustained for 1h
   - 10k webhook flood for 5min
   - Redis outage chaos test
   - DB read-replica lag chaos test
3. **Disaster recovery** — point-in-time recovery for the database;
   cross-region replication of S3 blobs; documented RTO 1h / RPO 15min.
4. **Status page + incident process** — `status.devpulse.in`, paged
   on-call rotation in PagerDuty, post-mortem template.
5. **Penetration test** — engage a 3rd party (e.g., Cure53, Trail of Bits)
   for a 2-week black-box + grey-box pentest. Fix all critical/high before
   launch.
6. **SOC 2 Type II audit** — engage an auditor (e.g., Drata, Vanta as
   evidence collectors; A-LIGN or Schellman as the auditor) and complete
   the 3-month observation period.

### Effort

- Compliance v2 + evidence pipeline: 2.5 weeks
- k6 scenarios + chaos tests: 1.5 weeks
- DR runbooks + cross-region replication: 1.5 weeks
- Status page + PagerDuty wiring: 0.5 week
- Pentest support + remediation: 2 weeks (calendar)
- SOC 2 audit prep: ongoing 3-6 months calendar
- **Total: ~8 weeks of engineering + audit calendar time.**

---

## Phase 7 — (Future) AI Red-team & Adversarial Simulation

> Not a current commitment — listed for completeness. Requires a curated
> attack corpus (jailbreaks, prompt injection, data exfil, function abuse),
> a scoring engine, a UX for replays, and a roadmap of new attack types.
> Estimate **~8 weeks** when prioritized.

---

## Cumulative timeline summary

| Phase | Duration | End-of-phase customer-facing capability |
|---|---|---|
| 1 — Hardening (shipped) | – | Production-grade auth + observability foundation |
| 2 — AI Runtime Telemetry | 8 wks | "I can see every AI call my agents make in real time" |
| 3 — Policy Engine + MCP | 6 wks | "I can block / redact / approve risky AI traffic in-line" |
| 4 — Security Copilot | 9 wks | "DevPulse explains findings and ships fixes via PR" |
| 5 — Multi-tenancy + SSO | 6 wks | "We can roll DevPulse out enterprise-wide via Okta" |
| 6 — Compliance + load + DR | 8 wks | "We pass procurement + SOC 2 evidence review" |
| **Total to enterprise-ready** | **~37 weeks (≈9 months) single engineer** | |

A team of 3 could plausibly compress this to **~5 months** with parallelism
on phases 2/3 (telemetry + policy engine share infra) and phases 4/5
(Copilot + tenancy are independent).

---

## Out-of-scope for any of the above (require dedicated initiatives)

- Mobile / iOS SDK
- On-prem / air-gapped deployment (k8s helm chart + dedicated DB)
- Federated multi-region deploy with active-active write
- Private LLM hosting (DevPulse-managed inference)
- Marketplace of pre-built policies / detectors
- Public bug bounty (separate budget + ops)

---

## How this document is meant to be used

- The README's "What DevPulse does" table is the **shipped** surface area.
- This document is the **next 9 months** of product surface area.
- Investor / customer pitches that reference Phase 2-6 capabilities should
  be marked "on roadmap" until the phase ships.
- Every phase ends with a **customer-facing capability** stated in plain
  English, not a feature list. If a phase doesn't move that needle, it's
  the wrong phase.
