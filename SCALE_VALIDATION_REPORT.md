# Rakshex Scale Validation Report

> Can we handle real growth?
> Date: 2026-05-17

---

## LOAD TEST RESULTS

| Scenario                 | Target         | Actual   | Status |
| ------------------------ | -------------- | -------- | ------ |
| 100 RPS API              | < 200ms p95    | \_\_\_ms | \_\_\_ |
| 1000 scans/hour          | < 5s queue     | \_\_\_s  | \_\_\_ |
| 10K WebSocket conns      | < 50ms latency | \_\_\_ms | \_\_\_ |
| 1M events/hour telemetry | < 1s ingest    | \_\_\_s  | \_\_\_ |

---

## BOTTLENECKS

| Component      | Limit        | Current | Headroom |
| -------------- | ------------ | ------- | -------- |
| API server     | \_\_\_ RPS   | \_\_\_  | \_\_\_x  |
| Scan workers   | \_\_\_ /hour | \_\_\_  | \_\_\_x  |
| DB connections | \_\_\_       | \_\_\_  | \_\_\_x  |
| Redis memory   | \_\_\_ GB    | \_\_\_  | \_\_\_x  |

---

## AUTOSCALING RULES

| Metric        | Scale Up At | Scale Down At | Min | Max |
| ------------- | ----------- | ------------- | --- | --- |
| API CPU       | > 70%       | < 30%         | 2   | 20  |
| Workers queue | > 100       | < 10          | 2   | 50  |

---

## DISASTER RECOVERY

| Scenario        | RTO        | RPO        | Last Test | Status |
| --------------- | ---------- | ---------- | --------- | ------ |
| DB restore      | \_\_\_ min | \_\_\_ min | \_\_\_    | \_\_\_ |
| Region failover | \_\_\_ min | \_\_\_ min | \_\_\_    | \_\_\_ |
| Redis failover  | \_\_\_ min | \_\_\_ min | \_\_\_    | \_\_\_ |

---

_Owned by infrastructure team. Tested monthly._
