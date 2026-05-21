# Rakshex Infrastructure Hardening

> Production resilience checklist for traffic spikes, outages, and failures.
> Date: 2026-05-17

---

## 1. REDIS QUEUES (BullMQ)

### Current State

- BullMQ used for background jobs (scans, webhooks, reports)
- Redis Cloud single node

### Improvements Needed

- [ ] Redis Sentinel (3-node) for HA
- [ ] Redis Cluster at 10K+ users
- [ ] Queue monitoring dashboard
- [ ] Dead letter queue UI
- [ ] Job retry with exponential backoff
- [ ] Stalled job detection
- [ ] Worker scaling based on queue depth

### Implementation

```typescript
// server/queues/index.ts
import { Queue, Worker } from "bullmq";
import { logger } from "../_core/logger";

const scanQueue = new Queue("scan", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

const scanWorker = new Worker(
  "scan",
  async (job) => {
    // Scan logic
  },
  {
    connection: redisConnection,
    concurrency: 5,
  },
);

scanWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "[Queue] Scan job failed");
});
```

---

## 2. SENTRY ALERTING

### Current State

- Sentry SDK configured for error tracking
- Basic alerting

### Improvements Needed

- [ ] PagerDuty integration for SEV-1/SEV-2 errors
- [ ] Error rate thresholds (alert if > 0.1%)
- [ ] Performance regression alerts (p95 latency > 500ms)
- [ ] Source maps for TypeScript
- [ ] Release tracking
- [ ] Breadcrumbs for request context

---

## 3. UPTIME MONITORING

### Tools

- **UptimeRobot:** Free tier, 5-minute checks
- **Statuspage:** Public status page (by Atlassian)

### Checks

- [ ] `GET /api/health` every 60 seconds
- [ ] `GET /` (frontend) every 60 seconds
- [ ] WebSocket connectivity check
- [ ] SSL certificate expiry (alert 30 days before)

### Alert Channels

- PagerDuty: SEV-1 (complete outage)
- Slack #alerts: SEV-2 (degraded)
- Email: SEV-3 (minor issues)

---

## 4. DATABASE BACKUP VALIDATION

### Current State

- Render MySQL: Daily automated backups
- No validation of restore process

### Improvements Needed

- [ ] Monthly restore test (staging environment)
- [ ] Backup integrity checksums
- [ ] Point-in-time recovery testing
- [ ] Cross-region backup replication
- [ ] Documented RTO/RPO targets

### RTO/RPO

- **RTO (Recovery Time Objective):** 30 minutes
- **RPO (Recovery Point Objective):** 24 hours (daily backups)

---

## 5. CHAOS TESTING

### Scenarios to Test

1. **Redis failure:** Kill Redis, verify fallback behavior
2. **DB overload:** Simulate 10x connection load
3. **Network partition:** Isolate API from DB
4. **Provider outage:** Simulate OpenAI API down
5. **Memory exhaustion:** Scan 100MB collection

### Implementation

```bash
# Using chaos-monkey or custom scripts
npm run test:chaos
```

---

## 6. ROLLBACK DEPLOYS

### Strategy

- **Blue-green:** Two production environments, switch traffic
- **Canary:** Route 5% traffic to new version, monitor, then 100%
- **Feature flags:** Disable broken features without deploy

### Implementation

```yaml
# .github/workflows/deploy.yml
- name: Canary Deploy
  run: |
    render deploy --canary 5%
    sleep 300 # 5 min monitoring window
    render deploy --promote
```

---

## 7. API THROTTLING VALIDATION

### Current State

- Rate limits configured
- No load testing

### Test Scenarios

- [ ] 1000 RPM burst → Should rate limit gracefully
- [ ] Sustained 500 RPM → Should not degrade
- [ ] Distributed attack (100 IPs) → Should block by API key
- [ ] Webhook burst (1000 events) → Should queue, not drop

### Tools

- k6: `k6 run --vus 100 --duration 60s load-test.js`
- Artillery: `artillery quick --count 1000 --num 50 http://api.rakshex.in/health`

---

## 8. WEBSOCKET STABILITY

### Current State

- Socket.IO for real-time updates
- No reconnection testing

### Improvements Needed

- [ ] Reconnection with exponential backoff
- [ ] Heartbeat timeout detection
- [ ] Message delivery confirmation
- [ ] Offline queue (store events, replay on reconnect)
- [ ] Connection limit per user (max 5 concurrent)

---

## 9. FAILOVER TESTING

### Scenarios

| Component   | Failure               | Expected Behavior                    |
| ----------- | --------------------- | ------------------------------------ |
| Redis       | Connection lost       | Rate limits use in-memory fallback   |
| MySQL       | Connection lost       | API returns 503, health check fails  |
| OpenAI      | API timeout           | Circuit breaker opens, queue retries |
| Stripe      | Webhook delivery fail | Retry 3x, then dead letter           |
| VS Code ext | Network offline       | Cache last scan, queue actions       |

---

## 10. VALIDATION CHECKLIST

### Before Every Deploy

- [ ] All tests passing (583/583)
- [ ] Health check returns 200
- [ ] Database migrations applied
- [ ] Redis connectivity verified
- [ ] Sentry release created
- [ ] Feature flags checked

### Monthly

- [ ] Backup restore test
- [ ] Chaos test (1 scenario)
- [ ] Load test (k6)
- [ ] Security scan (dependency audit)
- [ ] Penetration test review

### Quarterly

- [ ] Full disaster recovery drill
- [ ] RTO/RPO validation
- [ ] Infrastructure cost review
- [ ] Scaling plan update

---

_Hardening maintained by DevOps + SRE team._
_Reviewed monthly, tested quarterly._
