# Rakshex Security

## Overview

Rakshex processes API collections, AI agent telemetry, and governance controls. This document summarizes security posture for operators and customers.

**Maturity:** operational guidance — not a certification claim.

## Authentication and authorization

- Passwords hashed with Argon2id
- Sessions are server-side; OAuth uses PKCE
- Workspace-scoped RBAC; API keys are hashed at rest
- Cross-tenant access is denied by authorization helpers (BOLA prevention)

## AgentGuard runtime

- SDK defaults to `metadata_only` (no prompt content)
- Provider API keys never leave the customer process toward Rakshex
- Gateway kill switches: workspace, project, agent
- Fail-open vs fail-closed configurable; emergency bypass is audited and permissioned

## Secrets

- Structured logs redact passwords, tokens, API keys, cookies
- Collection import scans for embedded credentials
- MCP stdio commands are allowlisted; shell metacharacters blocked

## Data rights

- Export and deletion workflows anonymize or remove personal data
- Zero-retention and local-only modes available in the SDK
- Retention policies document telemetry and audit windows

## Reporting vulnerabilities

See `/.well-known/security.txt` and email security@rakshex.com.

## Compliance reports

Compliance dashboards map evidence to frameworks (OWASP, NIST AI RMF, ISO, SOC 2, GDPR, DPDP, EU AI Act). Reports are **not** certifications.
