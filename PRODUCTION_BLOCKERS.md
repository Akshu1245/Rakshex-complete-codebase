# DevPulse Production Blockers

> Items that MUST be resolved before public launch, investor demo, or SOC2 audit.
> Date: 2026-05-17 | Severity: P0 = Launch Blocker, P1 = Demo Blocker, P2 = SOC2 Blocker

---

## P0 — LAUNCH BLOCKERS (Ship Without = Revenue Risk)

### P0.1 Database Connection Pool Limit

**Status:** ❌ NOT CONFIGURED
**Impact:** Under concurrent load, MySQL connections exhaust and the API becomes unresponsive.
**Fix:** Add `poolSize: 20` to Drizzle connection config in `server/db.ts`.
**Effort:** 5 minutes

### P0.2 Graceful Shutdown

**Status:** ❌ NOT IMPLEMENTED
**Impact:** On deploy/restart, in-flight requests (payments, scans) are dropped mid-transaction.
**Fix:** Add SIGTERM handler in `server/_core/index.ts` that drains HTTP connections before exit.
**Effort:** 30 minutes

### P0.3 Pagination on List Endpoints

**Status:** ❌ NOT IMPLEMENTED
**Impact:** Free-tier user with 10K audit logs crashes the API on `/api/audit-log.list`.
**Fix:** Add cursor-based pagination (limit/offset) to collections.list, scans.list, audit-log.list.
**Effort:** 2 hours

### P0.4 WebSocket JWT Expiry Check

**Status:** ❌ NOT IMPLEMENTED
**Impact:** Stolen session cookie provides indefinite WebSocket access even after password change.
**Fix:** Add token expiry validation in `verifyWebSocketAuth` before accepting connection.
**Effort:** 15 minutes

---

## P1 — DEMO BLOCKERS (YC Demo / Investor Pitch)

### P1.1 Mobile Dashboard Responsive

**Status:** ⚠️ PARTIAL
**Impact:** Sidebar takes full width on mobile. Tables overflow. Looks unprofessional in demo.
**Fix:** Add horizontal scroll to tables. Stack cards. 44px touch targets.
**Effort:** 4 hours

### P1.2 Loading States on All Dashboard Pages

**Status:** ❌ MISSING
**Impact:** Blank screens while tRPC loads = "is it broken?" in investor demo.
**Fix:** Add `loading.tsx` to every app directory route.
**Effort:** 2 hours

### P1.3 Empty States with CTAs

**Status:** ⚠️ PARTIAL
**Impact:** New user sees empty tables with no guidance = high bounce rate.
**Fix:** Consistent `EmptyState` component with "Import your first collection" CTA.
**Effort:** 2 hours

### P1.4 Feature Flags

**Status:** ❌ NOT IMPLEMENTED
**Impact:** Can't dark-launch features or A/B test pricing page for demo.
**Fix:** Add LaunchDarkly or simple env-based feature flags.
**Effort:** 3 hours

---

## P2 — SOC2 / ENTERPRISE BLOCKERS

### P2.1 Automated Database Backups

**Status:** ⚠️ MANUAL ONLY
**Impact:** SOC2 auditors require documented backup + restore testing.
**Fix:** Render MySQL has daily backups, but document RTO/RPO. Add S3 snapshot automation.
**Effort:** 4 hours

### P2.2 Security Event Persistence

**Status:** ⚠️ IN-MEMORY ONLY
**Impact:** Security events are lost on restart. Audit trail gaps.
**Fix:** Add `security_events` table + periodic flush from in-memory buffer.
**Effort:** 3 hours

### P2.3 Secret Rotation Policy

**Status:** ❌ NOT DOCUMENTED
**Impact:** SOC2 CC6.1 requires documented secret rotation.
**Fix:** Document 90-day rotation for JWT_SECRET, Stripe keys, webhook secrets.
**Effort:** 1 hour (documentation)

### P2.4 Penetration Test Report

**Status:** ❌ NOT CONDUCTED
**Impact:** Enterprise customers require third-party pen-test report.
**Fix:** Schedule with Bishop Fox or Cobalt.io post-launch.
**Effort:** 2 weeks (external), $5-15K

---

## P3 — TRUST & CONVERSION

### P3.1 Trust Badges on Landing Page

**Status:** ❌ MISSING
**Impact:** No security certifications = lower enterprise conversion.
**Fix:** Add "SOC2 Type 2 In Progress", "GDPR Compliant", "AES-256-GCM" badges.
**Effort:** 30 minutes

### P3.2 Public Status Page

**Status:** ❌ MISSING
**Impact:** Downtime without communication = churn.
**Fix:** Add status.devpulse.in via Instatus or UptimeRobot.
**Effort:** 1 hour

### P3.3 Incident Response Runbook

**Status:** ❌ MISSING
**Impact:** First incident = chaos, not calm.
**Fix:** Document 5 scenarios: DB outage, Redis outage, breach, DDoS, dependency failure.
**Effort:** 4 hours

---

## RESOLUTION ORDER

```
Week 1: P0.1 → P0.2 → P0.4 → P0.3
Week 2: P1.1 → P1.2 → P1.3 → P1.4
Week 3: P2.1 → P2.2 → P2.3
Week 4: P2.4 (external) + P3.x
```

---

_Blockers identified by founding engineering team._
_Assignee: All team — P0 this week, P1 next week._
