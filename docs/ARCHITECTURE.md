# Architecture

Canonical monorepo architecture for Rakshex. Prefer this document over outdated pitch decks.

## System context

```
[Browser / VS Code / CLI / GH Action / AgentGuard SDK]
        │
        ▼
[apps/api  Express + tRPC]
   │         │          │
   ▼         ▼          ▼
[Postgres] [Redis]  [BullMQ workers]
```

## Packages

| Package                      | Responsibility                 |
| ---------------------------- | ------------------------------ |
| `@rakshex/database`          | Schema, migrations, seed       |
| `@rakshex/scanner-core`      | Deterministic findings         |
| `@rakshex/policy-engine`     | YAML policy evaluate/lifecycle |
| `@rakshex/pricing-engine`    | Versioned cost calculation     |
| `@rakshex/agentguard-sdk`    | Client telemetry + privacy     |
| `@rakshex/mcp-security`      | MCP risk scoring               |
| `@rakshex/compliance-engine` | Control catalog / reports      |

## Apps

| App                     | Responsibility                                             |
| ----------------------- | ---------------------------------------------------------- |
| `apps/api`              | Auth, tenancy, scan, findings, gateway, billing, telemetry |
| `apps/web`              | Operator dashboard                                         |
| `apps/cli`              | Local/CI scan CLI                                          |
| `apps/vscode-extension` | Editor diagnostics                                         |
| `apps/worker`           | Worker process entry (queues under api)                    |

## Critical flows

### Scan

1. Import collection (secure parse)
2. Enqueue scan job
3. Worker runs `scanner-core`
4. Persist findings with evidence
5. Web/CLI/VS Code consume findings

### Runtime governance

1. Client calls `controlPlane.gateway.evaluate` **or** SDK emits telemetry
2. Server loads kill switch + budget from DB
3. Policy engine may block
4. Audit log for blocks

## Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md). Compose services: postgres, redis, api, worker, web.

## Data classification

| Class              | Examples                           | Handling                                 |
| ------------------ | ---------------------------------- | ---------------------------------------- |
| Secrets            | passwords, API keys, provider keys | Hash or never store; never log           |
| PII                | email, name                        | Access control; deletion/anonymize paths |
| Telemetry metadata | tokens, model, latency             | Workspace scoped; privacy modes          |
| Findings           | endpoint, evidence                 | Workspace scoped                         |

## Non-goals of this architecture doc

- Marketing claims
- Certification status
- Unimplemented multi-cloud topology
