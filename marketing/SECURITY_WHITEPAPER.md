# Rakshex Security Whitepaper

**Version:** 1.0
**Date:** May 2026
**Classification:** Public

---

## Executive Summary

Rakshex is an open-source AI runtime governance platform that secures, monitors, and governs production AI agents. This whitepaper describes the security architecture, threat model, and controls that protect customer data and platform integrity.

**Key Claims:**

- Zero customer data leaves your infrastructure when self-hosted
- All communications use TLS 1.3
- PII is redacted before reaching third-party LLMs
- Immutable audit logs for compliance
- 4 patent-pending security innovations

---

## 1. Architecture Overview

```
┌─────────────┐     TLS 1.3      ┌─────────────┐     mTLS         ┌─────────────┐
│   Client    │────────────────▶│   Nginx     │────────────────▶│   Express   │
│  (Browser/  │                 │  (Reverse   │                 │   (tRPC)    │
│   SDK/VSC)  │                 │   Proxy)    │                 │             │
└─────────────┘                 └─────────────┘                 └──────┬──────┘
                                                                         │
                                    ┌────────────────────────────────────┼──────┐
                                    │                                    │      │
                                    ▼                                    ▼      ▼
                              ┌─────────────┐                    ┌─────────────┐ ┌──────────┐
                              │   MySQL 8   │                    │   Redis 7   │ │  BullMQ  │
                              │  (AES-256   │                    │  (TLS +    │ │ Workers  │
                              │   at rest)  │                    │  AUTH)      │ │          │
                              └─────────────┘                    └─────────────┘ └──────────┘
```

---

## 2. Threat Model

### STRIDE Analysis

| Threat                     | Mitigation                                                               |
| -------------------------- | ------------------------------------------------------------------------ |
| **Spoofing**               | JWT + refresh token rotation, API key auth, OAuth 2.0                    |
| **Tampering**              | HMAC-SHA256 webhook signatures, request signing for internal services    |
| **Repudiation**            | Immutable audit logs with user ID, IP, timestamp, action                 |
| **Information Disclosure** | TLS 1.3 everywhere, PII redaction, field-level encryption for secrets    |
| **Denial of Service**      | Redis-backed rate limiting, circuit breakers, queue backpressure         |
| **Elevation of Privilege** | RBAC (admin/editor/viewer), workspace-scoped resources, ownership checks |

### Key Attack Scenarios

**1. Prompt Injection via User Input**

- Detection: Regex + heuristic engine with 50+ known payloads
- Response: Block, log, alert (configurable per policy rule)
- Patent: NHCE/DEV/2026/001 — Multi-layer prompt injection classifier

**2. Credential Leak in API Collections**

- Detection: Secret scanner runs on every import (AWS, GCP, Stripe, etc.)
- Response: Surface at import time, never persist plaintext secrets
- Patent: NHCE/DEV/2026/002 — Credential scan at collection import

**3. Shadow API Discovery**

- Detection: Compare OpenAPI spec against observed traffic
- Response: Flag undocumented endpoints with risk scoring
- Patent: NHCE/DEV/2026/003 — Shadow endpoint detection via spec diffing

**4. Unauthorized LLM Cost Spend**

- Detection: Per-request cost tracking + anomaly detection
- Response: Kill switch hard-stops traffic when budget exceeded
- Patent: NHCE/DEV/2026/004 — Budget-aware kill switch with graceful degradation

---

## 3. Data Protection

### Encryption

| Layer              | Algorithm                      | Key Management                        |
| ------------------ | ------------------------------ | ------------------------------------- |
| Data at rest (DB)  | AES-256-GCM                    | MySQL TDE / cloud KMS                 |
| Data in transit    | TLS 1.3                        | Let's Encrypt / Cloudflare            |
| Secrets (env vars) | AES-256-GCM                    | HashiCorp Vault / AWS Secrets Manager |
| API keys           | PBKDF2-SHA512, 100k iterations | Hashed with salt, never plaintext     |

### PII Redaction

Before any request reaches a third-party LLM:

1. Regex-based PII detection (email, phone, SSN, credit card, Aadhaar)
2. Named entity recognition for custom sensitive fields
3. Replacement with `[REDACTED-<type>]` tokens
4. Audit log entry with redaction count (no raw data)

### Data Residency

- Self-hosted: 100% data stays on your infrastructure
- Cloud: Primary region India (Mumbai), DR Singapore
- EU customers: EU-only Redis + DB deployment available

---

## 4. Access Control

### Authentication

- Password: PBKDF2-SHA512, 100k iterations, 32-byte salt
- OAuth: Google Workspace, custom SAML (Enterprise)
- API Keys: `dp_` prefix, 48-byte random, hashed storage
- Session: JWT (15 min) + refresh token (7 day) dual-cookie rotation

### Authorization (RBAC)

| Role    | Permissions                                                   |
| ------- | ------------------------------------------------------------- |
| Admin   | Full access, billing, team management, audit logs             |
| Editor  | Create collections, run scans, manage policies, view findings |
| Viewer  | Read-only access to dashboard and reports                     |
| API Key | Scope-limited by role at creation time                        |

### Ownership Enforcement

Every database query for tenant-scoped resources includes a `userId = ?` or `workspaceId = ?` filter. No global queries are permitted in tRPC routers.

---

## 5. Audit & Compliance

### Audit Log Events

- User login/logout
- Collection create/update/delete
- Scan start/complete
- Policy rule create/update/delete/enable/disable
- Kill switch trigger/reset
- API key create/revoke
- Team member invite/role change/removal
- Billing subscription create/cancel
- Data export

### Retention

- Audit logs: 7 years (compliance requirement)
- Request telemetry: 90 days (configurable)
- Scan findings: Indefinite (soft delete)
- Deleted data: Purged within 30 days of deletion

### Compliance Mapping

| Framework             | Coverage                                                   | Status            |
| --------------------- | ---------------------------------------------------------- | ----------------- |
| PCI DSS               | Req 6 (security), Req 8 (access control), Req 10 (logging) | Automated reports |
| OWASP Top 10 2025     | A01–A10 mapped to scan rules                               | Automated reports |
| SOC 2 Type 1          | CC6 (logical access), CC7 (system operations)              | In audit          |
| GDPR                  | Art 32 (security), Art 33 (breach notification)            | DPA available     |
| DPDP Act 2023 (India) | Data protection, consent, grievance                        | Compliant         |

---

## 6. Incident Response

### Severity Levels

- **SEV-1:** Data breach, unauthorized admin access, production outage
- **SEV-2:** Partial service degradation, security finding in production
- **SEV-3:** Non-critical bug, documentation issue

### Response Times

| Severity | Detection   | Containment | Communication                        |
| -------- | ----------- | ----------- | ------------------------------------ |
| SEV-1    | 5 min       | 30 min      | 1 hour (customer), 24 hours (public) |
| SEV-2    | 15 min      | 4 hours     | 4 hours (customer)                   |
| SEV-3    | Best effort | Best effort | Next business day                    |

### Playbooks

- Security incident playbook: `docs/security/incident-response.md`
- Kill switch emergency procedure: Automatic + manual trigger
- Customer notification template: Built into alert system

---

## 7. Penetration Testing

- **Frequency:** Annual (Enterprise+), bi-annual (standard)
- **Scope:** Full stack — frontend, backend, APIs, infrastructure
- **Provider:** Independent third-party (name redacted per NDA)
- **Last Test:** March 2026 — 0 critical, 2 high (remediated), 4 medium (accepted)

---

## 8. Responsible Disclosure

We operate a coordinated vulnerability disclosure program:

- Email: security@rakshex.in
- Response time: 48 hours acknowledgment
- Bounty: $500–$5,000 for valid findings (scope-dependent)
- Hall of Fame: Published on security.rakshex.in

---

## 9. Certifications & Attestations

| Certification | Status                      | Target Date |
| ------------- | --------------------------- | ----------- |
| SOC 2 Type 1  | In progress                 | Q3 2026     |
| ISO 27001     | Planned                     | Q1 2027     |
| PCI DSS SAQ A | Compliant (self-assessment) | Ongoing     |

---

## Contact

- Security team: security@rakshex.in
- Compliance: compliance@rakshex.in
- General: hello@rakshex.in

---

_This document is updated quarterly. Last reviewed: May 2026._
