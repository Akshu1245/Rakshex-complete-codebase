# Security model

## Principles

1. **Server is authority** — roles, plans, kill-switch state, membership come from the database, not the client.
2. **Least privilege** — workspace RBAC maps role → resource → action.
3. **No secret storage in plaintext** — passwords Argon2id; API keys hashed; sessions server-side.
4. **Tenant isolation** — every resource access checks `workspaceId` membership; BOLA tests cover cross-tenant denial.
5. **Deterministic security findings** — scanner rules are pure functions with fixtures; AI is not the sole finding source.
6. **Privacy by default** — AgentGuard `metadata_only`; logs redact credentials; no full prompts by default.
7. **Runtime enforcement** — kill switch and budgets enforced on gateway preflight and telemetry, not only in the UI.

## Authentication

| Mechanism  | Implementation                                                     |
| ---------- | ------------------------------------------------------------------ |
| Password   | Argon2id (`utils/password.ts`); legacy PBKDF2 verify for migration |
| Session    | Cookie + server session store                                      |
| OAuth      | PKCE for Google/GitHub                                             |
| MFA        | TOTP + recovery codes                                              |
| Automation | Workspace API keys (hashed at rest, prefix display only)           |

## Authorization

```
request → authenticated user
       → requireWorkspaceMembership(workspaceId, userId)  // DB
       → assertPermission(role, resource, action)
       → assertSameWorkspace(resource.workspaceId, authorized)
```

Never accept client-sent `role`, `plan`, or `isAdmin` for authorization decisions.

## Kill switch

| Layer                                   | Behavior                                                      |
| --------------------------------------- | ------------------------------------------------------------- |
| UI                                      | Operator triggers/resets; audit trail                         |
| DB                                      | `killSwitchSettings.isActive`, budget fields                  |
| Gateway `controlPlane.gateway.evaluate` | Loads `isActive` from DB; **ignores client killSwitchActive** |
| Telemetry ingest                        | **403** when kill switch active                               |
| Enforcement module                      | Pure `decideEnforcement` for steps, allowlists, budgets       |

## Import / SSRF

- OpenAPI external `$ref` and arbitrary URL fetch blocked at secure parse.
- MCP stdio commands allowlisted; shell metacharacters rejected.

## Logging

Pino redacts: password, token, apiKey, authorization, cookie, and nested variants.

## Compliance

Evidence mapping only. **No automatic SOC 2 / ISO / GDPR certification claims.**

## Threat notes (known residual)

- Kill switch still primarily **user-scoped** in legacy schema; multi-workspace enterprise isolation for KS is incomplete.
- E2E browser suite does not prove all BOLA paths; unit/integration tests do for core helpers.
