# Rakshex Scale Readiness Report

> Can Rakshex handle real traffic?
> Date: 2026-05-17

---

## CURRENT ARCHITECTURE LIMITS

| Component            | Current Capacity | Bottleneck at         | Scaling Strategy                   |
| -------------------- | ---------------- | --------------------- | ---------------------------------- |
| API Server (Node.js) | ~100 req/s       | CPU                   | Horizontal pods                    |
| Database (MySQL)     | ~500 queries/s   | Connection pool       | Read replicas + connection pooling |
| Redis                | ~10K ops/s       | Memory                | Cluster mode                       |
| Queue (BullMQ)       | ~50 jobs/s       | Redis memory          | Shard by queue type                |
| WebSocket            | ~1K connections  | Memory per connection | Sticky sessions + broadcast        |
| Extension API        | ~1K users        | Rate limits           | CDN for static, edge for API       |

---

## LOAD TEST RESULTS

### Test 1: API Throughput

```
Scenario: 1000 users scanning simultaneously
Duration: 10 minutes
Ramping: 100 users/min

Results:
  Requests:         ___
  Successful:       ___% (target: 99.9%)
  Avg latency:      ___ms (target: < 500ms)
  p95 latency:      ___ms (target: < 2s)
  p99 latency:      ___ms (target: < 5s)
  Error rate:       ___% (target: < 0.1%)
  CPU usage:        ___% (target: < 80%)
  Memory usage:     ___MB (target: < 2GB)
```

### Test 2: Queue Stress

```
Scenario: 10,000 scan jobs queued simultaneously
Duration: Until cleared

Results:
  Jobs queued:      10,000
  Jobs processed:   ___
  Processing rate:  ___/min (target: > 100/min)
  Failed jobs:      ___ (target: 0)
  Avg wait time:    ___s (target: < 30s)
  Max wait time:    ___s (target: < 5min)
```

### Test 3: WebSocket Flood

```
Scenario: 5000 concurrent WebSocket connections
Duration: 30 minutes

Results:
  Connections:      5000
  Successful:     ___% (target: 99%)
  Message latency: ___ms (target: < 100ms)
  Reconnect rate: ___% (target: < 1%)
  Memory per conn: ___KB (target: < 50KB)
```

### Test 4: Telemetry Ingestion

```
Scenario: 10K events/sec from extensions
Duration: 10 minutes

Results:
  Events received:  ___
  Events processed: ___ (target: 100%)
  Batch insert rate: ___/s (target: > 5K/s)
  Drop rate:        ___% (target: 0%)
```

---

## SCALING ROADMAP

### Phase 1: Current → 1K Users (Now)

- [ ] Single API server
- [ ] Single MySQL instance
- [ ] Single Redis instance
- [ ] Status: ✅ Ready

### Phase 2: 1K → 10K Users (Month 2)

- [ ] API: 3 replicas with load balancer
- [ ] DB: Read replica for analytics queries
- [ ] Redis: Sentinel for HA
- [ ] CDN: CloudFront for static assets
- [ ] Status: \_\_\_

### Phase 3: 10K → 50K Users (Month 4)

- [ ] API: 10+ replicas, auto-scaling
- [ ] DB: Sharding by workspace
- [ ] Redis: Cluster mode
- [ ] Queue: Separate workers per job type
- [ ] WebSocket: Dedicated gateway service
- [ ] Status: \_\_\_

### Phase 4: 50K → 200K Users (Month 8)

- [ ] Multi-region deployment
- [ ] Edge caching for API responses
- [ ] Event sourcing for telemetry
- [ ] Dedicated analytics pipeline
- [ ] Status: \_\_\_

---

## AUTOSCALING RULES

```yaml
api_server:
  min_replicas: 2
  max_replicas: 20
  scale_up:
    cpu: > 70% for 2 min
    memory: > 80% for 2 min
    requests_per_pod: > 500 for 1 min
  scale_down:
    cpu: < 30% for 5 min

scan_workers:
  min_replicas: 2
  max_replicas: 50
  scale_up:
    queue_depth: > 100 for 1 min
  scale_down:
    queue_depth: < 10 for 5 min

websocket_server:
  min_replicas: 2
  max_replicas: 10
  scale_up:
    connections_per_pod: > 1000 for 2 min
```

---

## DISASTER RECOVERY

| Scenario         | RTO   | RPO   | Procedure             | Last Tested |
| ---------------- | ----- | ----- | --------------------- | ----------- |
| Database failure | 1h    | 5min  | Failover to replica   | \_\_\_      |
| Redis failure    | 15min | 0     | Sentinel promotion    | \_\_\_      |
| API server crash | 2min  | 0     | K8s restart           | \_\_\_      |
| Region outage    | 4h    | 15min | DNS switch to standby | \_\_\_      |
| Data corruption  | 8h    | 1h    | Restore from backup   | \_\_\_      |

---

## OBSERVABILITY AT SCALE

### SLOs

| Service   | SLI                | Target    | Current    |
| --------- | ------------------ | --------- | ---------- |
| API       | Success rate       | 99.9%     | \_\_\_%    |
| API       | Latency (p95)      | < 2s      | \_\_\_s    |
| Queue     | Processing rate    | > 100/min | \_\_\_/min |
| WebSocket | Connection uptime  | 99.5%     | \_\_\_%    |
| Extension | Activation success | 98%       | \_\_\_%    |

### Alerting Thresholds

| Severity | Condition                   | Action       |
| -------- | --------------------------- | ------------ |
| P0       | API success rate < 95%      | Page on-call |
| P0       | p99 latency > 10s           | Page on-call |
| P1       | Queue depth > 1000 for 5min | Slack alert  |
| P1       | Error rate > 1% for 5min    | Slack alert  |
| P2       | CPU > 80% for 10min         | Auto-scale   |
| P2       | Memory > 85% for 10min      | Auto-scale   |
| P3       | Disk > 80%                  | Ticket       |

---

_Report maintained by engineering + SRE team._
_Load tests run before every major release._
