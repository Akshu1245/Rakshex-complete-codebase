# DevPulse Investor Traction Dashboard

> Real-time metrics that prove market pull.
> Date: 2026-05-17

---

## NORTH STAR: WEEKLY ACTIVE DEVELOPERS (WAD)

```
Current WAD:     ___
Target (Month 1):  500
Target (Month 3):  2,000
Target (Month 6):  5,000
Target (Month 12): 15,000

Trend:
Week 1:  ___
Week 2:  ___
Week 3:  ___
Week 4:  ___
```

---

## GROWTH METRICS

### Acquisition

| Metric           | This Week | Last Week | Trend |
| ---------------- | --------- | --------- | ----- |
| New installs     | \_\_\_    | \_\_\_    | ▲ ▼ — |
| Activation rate  | \_\_\_%   | \_\_\_%   | ▲ ▼ — |
| Invites sent     | \_\_\_    | \_\_\_    | ▲ ▼ — |
| Waitlist signups | \_\_\_    | \_\_\_    | ▲ ▼ — |

### Sources

| Source              | Installs | Activation Rate | Best Performing |
| ------------------- | -------- | --------------- | --------------- |
| VS Code Marketplace | \_\_\_   | \_\_\_%         |                 |
| Product Hunt        | \_\_\_   | \_\_\_%         |                 |
| Twitter/X           | \_\_\_   | \_\_\_%         |                 |
| Reddit              | \_\_\_   | \_\_\_%         |                 |
| LinkedIn            | \_\_\_   | \_\_\_%         |                 |
| Direct / Referral   | \_\_\_   | \_\_\_%         |                 |

---

## RETENTION METRICS

### Cohort Retention

```
Cohort    | W0 | W1  | W2  | W4  | W8  | W12
----------|----|-----|-----|-----|-----|-----
Current   |100%| ___%| ___%| ___%| ___%| ___%
-1 week   |100%| ___%| ___%| ___%| ___%| ___%
-2 weeks  |100%| ___%| ___%| ___%| ___%| ___%
```

### Engagement

| Metric                     | This Week  | Target |
| -------------------------- | ---------- | ------ |
| Scans per user (weekly)    | \_\_\_     | 2+     |
| Avg session duration       | \_\_\_ min | 5+ min |
| Findings viewed per user   | \_\_\_     | 3+     |
| Findings marked (valid/FP) | \_\_\_     | 1+     |

---

## PRODUCT METRICS

### Scan Quality

| Metric              | This Week | Target |
| ------------------- | --------- | ------ |
| Total scans         | \_\_\_    |        |
| Findings per scan   | \_\_\_    | 3+     |
| True positive rate  | \_\_\_%   | >85%   |
| False positive rate | \_\_\_%   | <15%   |
| Avg scan time (p50) | \_\_\_s   | <10s   |
| Avg scan time (p95) | \_\_\_s   | <60s   |

### Security Impact

| Metric                  | This Week | Total   |
| ----------------------- | --------- | ------- |
| Secrets found           | \_\_\_    | \_\_\_  |
| Auth issues found       | \_\_\_    | \_\_\_  |
| Injection vectors found | \_\_\_    | \_\_\_  |
| Agents stopped          | \_\_\_    | \_\_\_  |
| Estimated $ saved       | $\_\_\_   | $\_\_\_ |

---

## BUSINESS METRICS

### Revenue

| Metric                | This Month | Last Month |
| --------------------- | ---------- | ---------- |
| MRR                   | $\_\_\_    | $\_\_\_    |
| ARR                   | $\_\_\_    | $\_\_\_    |
| Paying customers      | \_\_\_     | \_\_\_     |
| New customers         | \_\_\_     | \_\_\_     |
| Churned customers     | \_\_\_     | \_\_\_     |
| Net Revenue Retention | \_\_\_%    | \_\_\_%    |

### Unit Economics

| Metric                          | Value   |
| ------------------------------- | ------- |
| CAC (Customer Acquisition Cost) | $\_\_\_ |
| LTV (Lifetime Value)            | $\_\_\_ |
| LTV/CAC ratio                   | \_\_\_  |
| Months to payback CAC           | \_\_\_  |
| Gross margin                    | \_\_\_% |

---

## INVESTOR-READY SNAPSHOT

### For Monthly Email

```
DevPulse Monthly Update — [Month Year]

Growth:
  WAD: ___ (___% WoW)
  New signups: ___ (___% MoM)
  Activation rate: ___%
  D7 retention: ___%

Product:
  Scans this month: ___
  True positive rate: ___%
  AgentGuard incidents: ___

Business:
  MRR: $___ (___% MoM)
  Paying customers: ___
  NRR: ___%

Security Impact:
  $ saved for users: $___
  Agents stopped: ___
  Secrets found: ___

Ask: [specific request]
```

### For Pitch Deck Slide

```
SLIDE: Traction

📈 Weekly Active Developers: ___
📊 Activation Rate: ___%
🔄 D7 Retention: ___%
💰 MRR: $___
🛡️ $ Saved for Users: $___
⭐ NPS: ___
```

---

## DATA SOURCES

| Metric     | Source                      | Update Frequency |
| ---------- | --------------------------- | ---------------- |
| Installs   | VS Code Marketplace API     | Daily            |
| Activation | PostHog / Telemetry         | Real-time        |
| Retention  | PostHog cohorts             | Daily            |
| Revenue    | Stripe                      | Real-time        |
| Scans      | DevPulse DB                 | Real-time        |
| Findings   | DevPulse DB + user feedback | Daily            |
| NPS        | In-app survey               | Weekly           |

---

_Dashboard maintained by founder + data lead._
_Updated daily. Investor snapshot sent monthly._
