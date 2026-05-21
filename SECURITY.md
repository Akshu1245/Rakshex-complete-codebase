# Security Policy

> Rakshex takes security seriously. We are a security company building security products.

---

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅ Active |
| < 1.0   | ❌ EOL    |

---

## Reporting a Vulnerability

**DO NOT** open a public issue for security vulnerabilities.

Instead, email us directly:

📧 **security@rakshex.in**

We will acknowledge receipt within 24 hours and provide a timeline for resolution within 72 hours.

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Impact assessment
- Suggested fix (if any)
- Your disclosure timeline preference

### Our Commitment

- **24h:** Acknowledge receipt
- **72h:** Provide initial assessment and timeline
- **90 days:** Fix and disclose (or coordinate disclosure if extension needed)
- **Hall of Fame:** Public recognition for responsible disclosure (with your permission)

---

## Security Architecture

### Authentication

- JWT with HS256, 7-day expiry
- Session versioning (invalidates on password change)
- Password hashing: bcrypt with cost factor 12
- CSRF: Double-submit cookie pattern

### Authorization

- RBAC with 4 roles: owner, admin, editor, viewer
- 9 resources × 3 actions = 27 permission combinations
- Workspace-scoped access control

### Data Protection

- AES-256-GCM encryption for vault secrets
- Per-tenant AAD (Additional Authenticated Data)
- TLS 1.3 for all transport
- HSTS with preload

### API Security

- Rate limiting: 20/15min auth, 100/hour scans, 500/min SDK
- Input validation: Zod schemas on all endpoints
- Output encoding: JSON only, no HTML injection path
- CORS: Strict allowlist, no wildcard reflection

### Infrastructure

- Security headers: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- Body parser limits: 5MB default, 1MB collections
- File upload: Type restricted (.json, .yaml, .yml), 50MB max
- Webhook SSRF protection: Blocklist + CIDR filter

---

## Security Controls

| Control             | Implementation                            | Status |
| ------------------- | ----------------------------------------- | ------ |
| Input validation    | Zod schemas                               | ✅     |
| Rate limiting       | Redis sliding window                      | ✅     |
| CSRF protection     | Double-submit cookie                      | ✅     |
| XSS prevention      | CSP + output encoding                     | ✅     |
| SQL injection       | Drizzle ORM (parameterized)               | ✅     |
| Secret scanning     | Collection import scan                    | ✅     |
| RCE prevention      | MCP command allowlist                     | ✅     |
| SSRF prevention     | URL validation + private IP block         | ✅     |
| Audit logging       | Structured Pino logs                      | ✅     |
| Security events     | In-memory buffer (DB persistence planned) | 🔄     |
| Dependency scanning | Snyk (CI planned)                         | 🔄     |
| Penetration testing | Scheduled Q3 2026                         | 📅     |

---

## Compliance

| Framework        | Status                    | Evidence                             |
| ---------------- | ------------------------- | ------------------------------------ |
| SOC2 Type 2      | In progress               | Evidence pack builder implemented    |
| GDPR             | Compliant                 | Data minimization, right to deletion |
| PCI DSS          | Compliant (self-assessed) | No card data stored                  |
| OWASP API Top 10 | Audited                   | See SECURITY_AUDIT.md                |

---

## Security Team

- **Akshay** — Security Lead, Architecture
- **Engineering Team** — Implementation, Review

---

_Last updated: 2026-05-17_
