# Rakshex — Technical Due Diligence

> For investor review. Prepared by founding engineering team.
> Date: 2026-05-17

---

## 1. COMPANY OVERVIEW

|                  |                                                                           |
| ---------------- | ------------------------------------------------------------------------- |
| **Product**      | Rakshex — AI-native developer security platform                           |
| **Category**     | Developer Tools + Cybersecurity + AI Infrastructure                       |
| **Stage**        | Pre-launch / Beta                                                         |
| **Architecture** | TypeScript/Node.js monolith, horizontally scalable                        |
| **Users**        | Developer-first, B2B SaaS                                                 |
| **Moat**         | VS Code-native workflow, real-time AgentGuard, thinking token attribution |

---

## 2. TECHNOLOGY STACK

### Backend

| Layer      | Technology          | Justification                            |
| ---------- | ------------------- | ---------------------------------------- |
| Runtime    | Node.js 22 LTS      | Team expertise, ecosystem maturity       |
| Framework  | Express + tRPC      | Type safety, batching, no API drift      |
| ORM        | Drizzle             | SQL-first, smaller bundle than Prisma    |
| Database   | MySQL 8.0           | Existing expertise, JSON support         |
| Cache      | Redis 7             | Rate limits, sessions, pub/sub           |
| Queue      | BullMQ              | Durable, Redis-backed, standard patterns |
| Auth       | JWT (jose) + bcrypt | Stateless, session versioning            |
| Validation | Zod                 | Runtime + static type safety             |

### Frontend

| Layer     | Technology              |
| --------- | ----------------------- |
| Framework | Next.js 15 (App Router) |
| Styling   | Tailwind CSS            |
| State     | React Query + Zustand   |
| Charts    | Recharts                |

### Infrastructure

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Hosting    | Render (API) + Vercel (Frontend)    |
| Container  | Docker + GHCR                       |
| CI/CD      | GitHub Actions                      |
| Monitoring | OpenTelemetry + Prometheus + Sentry |
| Logging    | Pino (structured)                   |

---

## 3. SECURITY POSTURE

### Controls Implemented

- ✅ JWT with HS256, 7-day expiry, session versioning
- ✅ CSRF double-submit cookie
- ✅ Rate limiting (Redis sliding window)
- ✅ Input validation (Zod on all endpoints)
- ✅ Helmet security headers + CSP
- ✅ CORS strict allowlist
- ✅ Secret scanning on collection import
- ✅ RCE prevention (MCP command allowlist)
- ✅ SSRF prevention (private IP blocklist + CIDR)
- ✅ AES-256-GCM encrypted vault
- ✅ Security event logging
- ✅ Webhook retry + dead letter queue
- ✅ Deep health checks (DB + Redis + memory)

### Audit Results

- **578 unit tests** passing (37 suites)
- **SAST scanning** in CI pipeline
- **Dependency audit** in CI pipeline
- **Secret scanning** (truffleHog) in CI pipeline
- **Penetration testing** scheduled Q3 2026

---

## 4. SCALABILITY ARCHITECTURE

### Current Limits (Single Node)

- ~500 concurrent users
- ~100 req/s webhooks
- ~50 concurrent full scans

### Horizontal Scaling Path

```
1,000   users → Read replica + CDN
5,000   users → Separate scan worker pool
10,000  users → Redis Cluster + DB sharding
50,000  users → Microservices split (gateway, scanner, realtime)
```

### Database Strategy

- Connection pool: 20 per process
- Read replica for analytics queries
- Monthly partitioning planned for audit_log table
- S3 offload for collection data at 10K users

---

## 5. TEST COVERAGE

| Suite              | Tests | Status         |
| ------------------ | ----- | -------------- |
| Server unit        | 583   | ✅ All passing |
| Server integration | ~50   | ✅ All passing |
| Frontend           | 45    | ✅ All passing |
| VS Code extension  | 12    | ✅ All passing |
| E2E (Playwright)   | 15    | ✅ All passing |

**Total: ~705 tests, all green**

---

## 6. DEPLOYMENT & OPERATIONS

### CI/CD Pipeline

1. Lint + Type Check
2. Unit Tests (MySQL + Redis services)
3. Security Audit (dependency + secrets + SAST)
4. E2E Tests (Playwright)
5. Docker Build + Push to GHCR

### Health Checks

- `/api/health` — Deep check: DB query + Redis PING + memory
- Returns 503 if any dependency unhealthy

### Monitoring

- OpenTelemetry traces (HTTP, Redis, MySQL)
- Prometheus metrics (custom + auto)
- Sentry error tracking
- Structured Pino logs with correlation IDs

---

## 7. INTELLECTUAL PROPERTY

| Asset                      | Status         | Protection           |
| -------------------------- | -------------- | -------------------- |
| AgentGuard algorithm       | Trade secret   | NDA with team        |
| Thinking token attribution | Patent pending | NHCE/DEV/2026/001    |
| Unified risk score engine  | Proprietary    | Code + documentation |
| Policy DSL                 | Proprietary    | Code + documentation |
| Secret scanning patterns   | Proprietary    | Continuous updates   |

---

## 8. RISK ASSESSMENT

| Risk                           | Likelihood | Impact | Mitigation                         |
| ------------------------------ | ---------- | ------ | ---------------------------------- |
| Database connection exhaustion | Medium     | High   | Pool limit set, monitoring alerts  |
| Redis failure                  | Low        | High   | In-memory fallback for rate limits |
| Dependency vulnerability       | Low        | Medium | Weekly Dependabot + CI audit       |
| Key person dependency          | Medium     | Medium | Documented architecture, runbooks  |
| Competition (Snyk, Datadog)    | High       | Medium | Developer-native UX moat           |

---

## 9. ROADMAP

### Q2 2026 (Now)

- [x] Core platform
- [x] VS Code extension
- [x] Security audit
- [x] Production hardening

### Q3 2026

- [ ] Public launch
- [ ] SOC2 Type 2 audit
- [ ] GitHub marketplace
- [ ] Team/enterprise features

### Q4 2026

- [ ] AI model routing engine
- [ ] Compliance-as-Code generation
- [ ] Multi-region deployment
- [ ] Series A fundraising

---

## 10. TEAM & GOVERNANCE

| Role          | Responsibility                                   |
| ------------- | ------------------------------------------------ |
| Security Lead | Architecture, threat modeling, incident response |
| Engineering   | Implementation, code review, deployment          |
| DevOps        | Infrastructure, CI/CD, monitoring                |
| Product       | Roadmap, UX, GTM                                 |

---

_Document prepared for investor due diligence._
_Contact: security@rakshex.in_
