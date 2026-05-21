# Rakshex Scalability Risk Assessment

> Where the system breaks as we grow from 1 → 100 → 10,000 → 100,000 users.
> Date: 2026-05-17 | Current Scale: Pre-launch

---

## RISK MATRIX

| Risk                          | Probability | Impact   | Score | Mitigation Status                     |
| ----------------------------- | ----------- | -------- | ----- | ------------------------------------- |
| DB connection exhaustion      | High        | Critical | 🔴 12 | Partial — pool exists, no limit set   |
| Redis single point of failure | Medium      | High     | 🟠 8  | None — no Sentinel/Cluster            |
| Scan worker CPU saturation    | High        | High     | 🟠 10 | Partial — BullMQ concurrency controls |
| Webhook delivery backlog      | Medium      | Medium   | 🟡 6  | Partial — retry + DLQ added           |
| Audit log table bloat         | High        | Medium   | 🟡 8  | None — no partitioning                |
| Frontend bundle size          | Medium      | Low      | 🟡 4  | None — no code splitting              |
| Rate limiter memory leak      | Low         | Medium   | 🟢 3  | Mitigated — bounded Map size          |
| Job queue memory growth       | Low         | High     | 🟢 4  | Mitigated — BullMQ removes old jobs   |

---

## BREAKING POINTS

### Current Architecture Limits (Monolith, 1 Node)

| Resource                         | Limit       | At User Count                   |
| -------------------------------- | ----------- | ------------------------------- |
| MySQL connections (default pool) | ~150        | ~500 concurrent scans           |
| Redis connections (single node)  | 10,000      | ~5,000 concurrent users         |
| Memory (scan engine payloads)    | 1GB/process | ~50 concurrent 50MB collections |
| Disk (audit logs)                | Unbounded   | ~100K users / 6 months          |
| Network (webhook deliveries)     | 100 req/s   | ~1,000 active webhooks          |

### Horizontal Scaling Triggers

```
100   users → Single node (current)
1,000  users → Add read replica, CDN
5,000  users → Split scanner to separate worker nodes
10,000 users → Redis Cluster, DB sharding by workspace
50,000 users → API Gateway separate, multi-region
```

---

## DETAILED RISKS

### R1: Database Connection Exhaustion

**Current:** Drizzle uses mysql2 default pool (no explicit limit).
**Breaking point:** ~150 concurrent connections (MySQL default).
**Fix:**

```typescript
// server/db.ts
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  connectionLimit: 20, // Per process
  queueLimit: 0, // Unlimited queue (backpressure)
  acquireTimeout: 30000, // 30s
  timeout: 60000, // 60s idle
});
```

**Monitoring:** Alert when `Threads_connected > 100`.

### R2: Redis Single Point of Failure

**Current:** Single Redis instance. If it dies: rate limits fail-open, sessions lost, cache cold.
**Breaking point:** Any Redis failure.
**Fix:**

- **Short term:** Redis Sentinel (3 nodes, auto-failover)
- **Long term:** Redis Cluster (6 nodes, sharded)
- **Immediate:** In-memory fallback already implemented for rate limits

### R3: Scan Worker CPU Saturation

**Current:** Scans run inline or via BullMQ with default concurrency.
**Breaking point:** 50 concurrent full scans = CPU pegged.
**Fix:**

- Scan workers on separate dynos/nodes (CPU-isolated)
- Concurrency limit per scan type: quick=10, full=2, shadow=1
- Auto-scale scan workers based on queue depth

### R4: Audit Log Table Bloat

**Current:** All audit logs in single table, no archiving.
**Breaking point:** 100M rows = query timeouts, disk pressure.
**Fix:**

- Partition by `created_at` (monthly)
- Hot data (last 90 days) in primary, cold in S3
- Automated purge after 7 years (compliance requirement)

### R5: Collection Data Size

**Current:** 1MB limit (newly added) but JSON stored inline.
**Breaking point:** 10K users × 50 collections × 1MB = 500GB table.
**Fix:**

- Store collection data in S3/R2, DB stores URI
- Compress before storage (gzip)
- CDN for collection assets

---

## AUTOSCALING STRATEGY

### Phase 1: Vertical (Now — 1,000 users)

- Bigger dynos/containers
- Read replica for analytics queries
- Redis cache warming

### Phase 2: Horizontal Workers (1,000 — 10,000 users)

- Separate scan worker pool
- Separate webhook delivery pool
- Separate compliance report generation pool

### Phase 3: Sharding (10,000 — 100,000 users)

- Workspace-scoped DB shards
- Regional API deployments
- Edge caching for static assets

### Phase 4: Microservices (100,000+ users)

- Gateway service (auth, rate limit, routing)
- Scanner service (stateless, CPU-bound)
- Realtime service (WebSocket, alerts)
- Compliance service (batch, report generation)

---

## MONITORING CHECKLIST

```
□ DB: Connections, slow queries, replication lag
□ Redis: Memory usage, hit rate, evictions
□ Queue: Depth, processing rate, failed jobs
□ API: p50/p95/p99 latency, error rate, RPS
□ Memory: Heap usage, GC pressure
□ Disk: Audit log growth, collection data growth
□ Network: Webhook delivery rate, timeouts
□ Security: Blocked events, failed auth, rate limit hits
```

---

_Assessment by founding engineering & DevOps team._
_Review monthly during growth phase._
