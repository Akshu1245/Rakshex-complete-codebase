# Rakshex Load Test Results

> Proof we can handle real traffic.
> Date: 2026-05-17

---

## TEST ENVIRONMENT

| Component   | Spec                    |
| ----------- | ----------------------- |
| API server  | 2 vCPU, 4GB RAM         |
| Database    | MySQL 8.0, db.t3.medium |
| Redis       | cache.t3.micro          |
| Load tester | k6 Cloud / Artillery    |
| Duration    | 10 minutes per test     |

---

## TEST 1: SCAN API THROUGHPUT

### Scenario

1000 concurrent users, each running a scan every 30 seconds.

### Results

| Metric            | Value    | Target | Status |
| ----------------- | -------- | ------ | ------ |
| Requests          | \_\_\_   | —      | —      |
| Success rate      | \_\_\_%  | >99%   | 🔴🟡🟢 |
| Avg response time | \_\_\_ms | <500ms | 🔴🟡🟢 |
| p95 response time | \_\_\_ms | <2s    | 🔴🟡🟢 |
| p99 response time | \_\_\_ms | <5s    | 🔴🟡🟢 |
| Error rate        | \_\_\_%  | <0.1%  | 🔴🟡🟢 |
| CPU usage         | \_\_\_%  | <80%   | 🔴🟡🟢 |
| Memory usage      | \_\_\_MB | <2GB   | 🔴🟡🟢 |

---

## TEST 2: QUEUE PROCESSING

### Scenario

10,000 scan jobs queued simultaneously.

### Results

| Metric          | Value      | Target   | Status |
| --------------- | ---------- | -------- | ------ |
| Jobs queued     | 10,000     | —        | —      |
| Jobs processed  | \_\_\_     | 10,000   | 🔴🟡🟢 |
| Processing rate | \_\_\_/min | >100/min | 🔴🟡🟢 |
| Failed jobs     | \_\_\_     | 0        | 🔴🟡🟢 |
| Avg wait time   | \_\_\_s    | <30s     | 🔴🟡🟢 |
| Max wait time   | \_\_\_s    | <5min    | 🔴🟡🟢 |

---

## TEST 3: WEBSOCKET CONCURRENT CONNECTIONS

### Scenario

5000 concurrent WebSocket connections, sending messages every 5 seconds.

### Results

| Metric          | Value    | Target | Status |
| --------------- | -------- | ------ | ------ |
| Connections     | 5,000    | —      | —      |
| Successful      | \_\_\_%  | >99%   | 🔴🟡🟢 |
| Message latency | \_\_\_ms | <100ms | 🔴🟡🟢 |
| Reconnect rate  | \_\_\_%  | <1%    | 🔴🟡🟢 |
| Memory per conn | \_\_\_KB | <50KB  | 🔴🟡🟢 |

---

## TEST 4: TELEMETRY INGESTION

### Scenario

10,000 events/second from extensions.

### Results

| Metric            | Value    | Target | Status |
| ----------------- | -------- | ------ | ------ |
| Events received   | \_\_\_   | —      | —      |
| Events processed  | \_\_\_   | 100%   | 🔴🟡🟢 |
| Batch insert rate | \_\_\_/s | >5K/s  | 🔴🟡🟢 |
| Drop rate         | \_\_\_%  | 0%     | 🔴🟡🟢 |

---

## BOTTLENECKS IDENTIFIED

| Test   | Bottleneck | Mitigation | Priority |
| ------ | ---------- | ---------- | -------- |
| \_\_\_ | \_\_\_     | \_\_\_     | \_\_\_   |

---

_Tests maintained by engineering team._
_Run before every major release._
