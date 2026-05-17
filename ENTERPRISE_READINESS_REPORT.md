# DevPulse Enterprise Readiness Report

> What it takes to sell to serious organizations.
> Date: 2026-05-17

---

## READINESS SCORECARD

| Capability         | Status         | Gap                     | Priority |
| ------------------ | -------------- | ----------------------- | -------- |
| SSO / SAML         | 🔴 Not started | Need IdP integration    | P0       |
| RBAC               | 🟡 Partial     | Role definitions needed | P0       |
| Org workspaces     | 🟡 Partial     | Multi-tenant isolation  | P0       |
| Audit logs         | 🟡 Partial     | Export format needed    | P1       |
| SOC2 readiness     | 🟡 In progress | Controls documentation  | P0       |
| SLA                | 🟡 Draft       | 99.9% commitment        | P1       |
| Admin controls     | 🔴 Not started | Admin dashboard         | P1       |
| Compliance exports | 🔴 Not started | GDPR/SOC2 formats       | P2       |
| On-prem option     | 🔴 Not started | Self-hosted package     | P3       |
| Procurement docs   | 🔴 Not started | Vendor questionnaire    | P2       |

**Overall readiness: \_\_\_%**

---

## SSO / SAML IMPLEMENTATION

### Supported Providers

| Provider         | Protocol | Status  |
| ---------------- | -------- | ------- |
| Okta             | SAML 2.0 | Planned |
| Google Workspace | SAML 2.0 | Planned |
| Azure AD         | SAML 2.0 | Planned |
| OneLogin         | SAML 2.0 | Planned |
| Generic SAML     | SAML 2.0 | Planned |

### Architecture

```
User → IdP (Okta/Google/Azure)
  → SAML Response → DevPulse API
    → Validate signature
    → Create/fetch user
    → Issue JWT
    → Redirect to dashboard
```

### Implementation Plan

1. **Week 1-2:** SAML library integration (passport-saml)
2. **Week 3:** Admin configuration UI
3. **Week 4:** Test with Okta + Google
4. **Week 5:** Documentation + security review

---

## RBAC DESIGN

### Roles

| Role              | Permissions                                   | Use Case            |
| ----------------- | --------------------------------------------- | ------------------- |
| Owner             | Full access                                   | Company founder     |
| Admin             | Manage users, billing, settings               | Engineering manager |
| Security Engineer | View all findings, run scans, configure rules | Security team       |
| Developer         | View own findings, run scans                  | Individual devs     |
| Viewer            | Read-only dashboard access                    | Stakeholders        |

### Permission Matrix

| Action               | Owner | Admin | Security | Developer | Viewer |
| -------------------- | ----- | ----- | -------- | --------- | ------ |
| Run scan             | ✅    | ✅    | ✅       | ✅        | ❌     |
| View all findings    | ✅    | ✅    | ✅       | ❌        | ✅     |
| Mark finding status  | ✅    | ✅    | ✅       | Own only  | ❌     |
| Manage users         | ✅    | ✅    | ❌       | ❌        | ❌     |
| Configure AgentGuard | ✅    | ✅    | ✅       | ❌        | ❌     |
| Export audit logs    | ✅    | ✅    | ❌       | ❌        | ❌     |
| Manage billing       | ✅    | ✅    | ❌       | ❌        | ❌     |
| Delete workspace     | ✅    | ❌    | ❌       | ❌        | ❌     |

---

## MULTI-TENANT ARCHITECTURE

### Isolation Strategy

| Layer     | Isolation    | Implementation                                  |
| --------- | ------------ | ----------------------------------------------- |
| Data      | Row-level    | `workspace_id` column on all tables             |
| API       | JWT claims   | Workspace ID in JWT, validated on every request |
| Queue     | Queue prefix | `workspace_id:job_type` queue names             |
| Cache     | Key prefix   | `workspace:{id}:key`                            |
| WebSocket | Room-based   | Subscribe to `workspace:{id}` room              |

### Migration Path

1. Add `workspace_id` to all tables (nullable, backfill)
2. Update API to read workspace from JWT
3. Update queries to filter by workspace
4. Enforce workspace isolation in middleware
5. Remove nullable, add NOT NULL constraint

---

## AUDIT LOGS

### Events to Log

| Event                 | Data                    | Retention |
| --------------------- | ----------------------- | --------- |
| User login            | User, IP, time          | 1 year    |
| Scan started          | User, collection, time  | 90 days   |
| Finding status change | User, finding, old→new  | 1 year    |
| AgentGuard trigger    | User, agent, action     | 1 year    |
| Cost alert            | User, threshold, actual | 90 days   |
| Settings change       | User, setting, old→new  | 1 year    |
| User invited          | Inviter, invitee, role  | 1 year    |
| User removed          | Remover, removed user   | 1 year    |

### Export Format

```json
{
  "timestamp": "2026-05-17T10:30:00Z",
  "event": "finding.status_changed",
  "actor": { "id": "u_123", "email": "user@example.com" },
  "target": { "type": "finding", "id": "f_456" },
  "action": { "from": "open", "to": "resolved" },
  "workspace_id": "w_789",
  "ip_address": "10.0.0.1"
}
```

---

## SLA DRAFT

| Tier         | Uptime | Support Response | Price  |
| ------------ | ------ | ---------------- | ------ |
| Starter      | 99.5%  | 24h (business)   | $29/mo |
| Professional | 99.9%  | 4h               | $99/mo |
| Enterprise   | 99.99% | 1h + phone       | Custom |

### SLA Credits

| Downtime | Credit |
| -------- | ------ |
| < 1%     | 10%    |
| 1-5%     | 25%    |
| > 5%     | 50%    |

---

## SECURITY QUESTIONNAIRE (Sample)

**Q: How is data encrypted?**
A: AES-256-GCM at rest, TLS 1.3 in transit.

**Q: Do you store our source code?**
A: No. Collections are parsed locally in VS Code. Only metadata is uploaded.

**Q: Can we audit your infrastructure?**
A: Yes. We provide SOC 2 reports and can arrange penetration test witness.

**Q: How do you handle data deletion?**
A: Account deletion purges all data within 30 days. Immediate deletion available on request.

**Q: Where is data stored?**
A: Primary: AWS Mumbai (ap-south-1). Backups: AWS Singapore (ap-southeast-1).

**Q: Do you have a bug bounty?**
A: Yes. Up to $5,000 for critical vulnerabilities. Contact security@devpulse.in.

---

_Report maintained by engineering + sales team._
_Updated weekly during enterprise push._
