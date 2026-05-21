# Rakshex Technical Roadmap

> Engineering priorities for the next 18 months.
> Date: 2026-05-17

---

## Q2 2026 (Current — Pre-Launch)

### Security Hardening

- [x] OWASP API Top 10 audit
- [x] RCE/SSRF prevention
- [x] Secret scanning on import
- [x] AES-256-GCM vault
- [x] Security event logging
- [x] Webhook retry + DLQ
- [x] Deep health checks

### Infrastructure

- [x] Docker + GHCR
- [x] GitHub Actions CI/CD
- [x] OpenTelemetry + Prometheus
- [x] Render + Vercel deployment
- [x] Redis + MySQL

### Product

- [x] VS Code extension
- [x] React dashboard
- [x] Collection import (Postman, OpenAPI, Bruno)
- [x] Risk score engine
- [x] Thinking token attribution
- [x] AgentGuard kill-switch
- [x] Shadow API discovery
- [x] PCI DSS compliance generator

### Documentation

- [x] API reference
- [x] Security audit
- [x] Architecture audit
- [x] Investor docs
- [x] Deployment guides

---

## Q3 2026 (Launch Quarter)

### Week 1-2: Launch Prep

- [ ] Fix P0 production blockers (connection pool, graceful shutdown)
- [ ] Performance optimization (bundle size, query optimization)
- [ ] Final security review
- [ ] Load testing (k6, Artillery)

### Week 3-4: Public Launch

- [ ] Product Hunt launch
- [ ] Hacker News launch
- [ ] Reddit r/webdev, r/programming
- [ ] Beta onboarding (500 users)

### Month 2: Post-Launch

- [ ] SOC2 Type 2 audit begins
- [ ] GitHub Marketplace listing
- [ ] Onboarding improvements (empty states, tooltips)
- [ ] Bug bounties (HackerOne or Bugcrowd)

### Month 3: Growth

- [ ] Referral program
- [ ] Team invites (viral loop)
- [ ] Public API documentation
- [ ] SDK improvements (Python, TypeScript)

---

## Q4 2026 (Scale)

### Enterprise Features

- [ ] SAML SSO (currently OIDC only)
- [ ] Role-based access control (RBAC) v2
- [ ] Audit log export (CSV, PDF)
- [ ] Custom compliance frameworks
- [ ] On-premise deployment option

### AI Infrastructure

- [ ] AI model routing engine (route to cheapest/fastest provider)
- [ ] Cost anomaly detection (ML-based)
- [ ] Thinking token attribution v2 (per-API-call breakdown)
- [ ] Prompt injection detection v2 (semantic analysis)

### Platform

- [ ] GitHub PR commenting (security findings inline)
- [ ] CI/CD security gates (GitHub Actions, GitLab CI)
- [ ] Slack/Discord bot for alerts
- [ ] Webhook marketplace ( Zapier, Make)

---

## Q1 2027 (Series A Prep)

### Scale Architecture

- [ ] Database read replicas
- [ ] Redis Cluster
- [ ] CDN for global assets
- [ ] Multi-region deployment
- [ ] Kubernetes migration

### Product Expansion

- [ ] OpenAPI import v2 (spec generation from code)
- [ ] Bruno import v2 (native .bru file support)
- [ ] API mocking from collections
- [ ] Contract testing integration

### Enterprise Readiness

- [ ] SOC2 Type 2 certification
- [ ] HIPAA compliance (healthcare customers)
- [ ] FedRAMP (government customers)
- [ ] Dedicated support tier
- [ ] SLA guarantees (99.9% uptime)

---

## Q2 2027 (Category Leadership)

### Platform Ecosystem

- [ ] Partner integrations (OpenAI, Anthropic, Vercel, Stripe)
- [ ] Plugin marketplace (community extensions)
- [ ] Public API v2 (GraphQL + REST)
- [ ] Webhook marketplace

### Advanced AI

- [ ] Autonomous remediation (AI-generated fixes)
- [ ] Predictive security (ML-based threat prediction)
- [ ] Natural language policy authoring
- [ ] Multi-model cost optimization

### Global Scale

- [ ] EU data residency (GDPR)
- [ ] APAC region deployment
- [ ] 99.99% uptime SLA
- [ ] 24/7 support

---

## TECHNICAL DEBT PAYOFF

| Quarter | Items                                                 |
| ------- | ----------------------------------------------------- |
| Q3 2026 | Security events persistence, pagination, Bruno import |
| Q4 2026 | SAML signature verification, OIDC JWS verification    |
| Q1 2027 | Collection data in S3, DLQ UI, feature flags          |
| Q2 2027 | Frontend any types, JSDoc coverage, test gaps         |

---

## METRICS

| Quarter | Target                          |
| ------- | ------------------------------- |
| Q3 2026 | 500 active developers, 50 teams |
| Q4 2026 | 5,000 developers, 500 teams     |
| Q1 2027 | 20,000 developers, 2,000 teams  |
| Q2 2027 | 50,000 developers, 5,000 teams  |

---

_Roadmap maintained by product + engineering leadership._
_Reviewed monthly, updated quarterly._
