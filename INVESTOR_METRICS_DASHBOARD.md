# Rakshex Investor Metrics Dashboard

> Metrics that prove traction, retention, and product-market fit.
> Date: 2026-05-17

---

## 1. GROWTH METRICS

### North Star: Weekly Active Developers (WAD)

```
Definition: Unique developers who run at least 1 scan in a 7-day window
Target: 500 WAD at launch, 5,000 at Series A
```

### Activation Rate

```
Definition: % of new signups who complete first scan within 24 hours
Baseline: ?
Target: 50%
Tracking: PostHog funnel
```

### Retention

```
Definition: % of users who return in Week N after first scan
Week-1: Target 40%
Week-4: Target 25%
Week-12: Target 15%
Tracking: Cohort analysis in PostHog
```

### Extension Install → Active

```
Definition: % of VS Code extension installs that connect an account
Target: 30%
Tracking: Telemetry event "extension_activated" → "auth_success"
```

---

## 2. PRODUCT HEALTH METRICS

### Scan Accuracy

```
Definition: % of findings that are true positives (validated by user or team)
Measurement: User marks finding as "valid" or "false positive"
Target: > 85% true positive rate
```

### False Positive Rate

```
Definition: % of findings marked as "not relevant" by users
Target: < 15%
Action: If > 20%, investigate rule quality
```

### Time to First Value

```
Definition: Minutes from signup to first meaningful finding
Target: < 5 minutes
Tracking: Onboarding funnel in telemetry
```

### Scan Performance

```
p50 scan duration: Target < 10s
p95 scan duration: Target < 60s
Error rate: Target < 1%
```

---

## 3. BUSINESS METRICS

### Revenue

```
MRR: Monthly Recurring Revenue
ARR: Annual Run Rate
ACV: Average Contract Value
Target: $10K MRR at Series A
```

### Conversion

```
Free → Pro: Target 5%
Pro → Enterprise: Target 10%
Trial → Paid: Target 20%
```

### Expansion

```
Net Revenue Retention (NRR): Target > 120%
Logo Churn: Target < 5% monthly
Seat Expansion: Average seats per org
```

---

## 4. SECURITY IMPACT METRICS

### Value Delivered

```
Vulnerabilities prevented: Total findings marked "fixed"
API spend saved: Estimated $ from hidden cost detection
Rogue agents stopped: AgentGuard kill-switch activations
Secrets rotated: Findings in "secret_leak" category marked resolved
```

### Developer Trust

```
NPS Score: Target > 50
Extension rating: Target > 4.5 stars
Support response time: Target < 4 hours
```

---

## 5. DASHBOARD SPECIFICATION

### Real-Time Dashboard (Internal)

```
┌─────────────────────────────────────────────────────────────┐
│  Rakshex Operational Dashboard                    [Refresh]│
├─────────────────────────────────────────────────────────────┤
│  WAD: 347 ▲ 12%    Scans Today: 1,247    Findings: 8,932  │
│  New Signups: 45     Activation: 48%      Retention D7: 38% │
├─────────────────────────────────────────────────────────────┤
│  True Positive Rate: 87%   False Positive: 13%            │
│  Avg Scan Time: 8.3s       Error Rate: 0.4%                │
├─────────────────────────────────────────────────────────────┤
│  Revenue: $4,200 MRR    Churn: 3.2%    NRR: 118%           │
│  Free→Pro: 4.8%    Pro→Ent: 8%    Trial→Paid: 18%        │
├─────────────────────────────────────────────────────────────┤
│  Agents Stopped: 47    Secrets Found: 234    $ Saved: $12K│
│  NPS: 52    Rating: 4.6★    Response Time: 2.3h          │
└─────────────────────────────────────────────────────────────┘
```

### Investor Snapshot (Monthly)

```
Rakshex Monthly Investor Update — May 2026

Growth:
  WAD: 347 (+12% MoM)
  New Signups: 1,350 (+18% MoM)
  Retention D7: 38% (stable)

Product:
  Scan Accuracy: 87% (+2% MoM)
  Time to Value: 4.2 min (-0.5 min MoM)
  Extension Rating: 4.6★

Business:
  MRR: $4,200 (+22% MoM)
  NRR: 118%
  Churn: 3.2%

Security Impact:
  Agents Stopped: 47
  Secrets Found: 234
  Est. $ Saved: $12,000

Key Milestones:
  ✅ 500 WAD target on track (June)
  🔄 SOC2 Type 2 audit in progress
  🔄 Product Hunt launch planned June 15
```

---

## 6. DATA SOURCES

| Metric        | Source                     | Frequency   |
| ------------- | -------------------------- | ----------- |
| WAD           | Telemetry + DB             | Daily       |
| Retention     | PostHog cohorts            | Weekly      |
| Revenue       | Stripe                     | Real-time   |
| Scan accuracy | User feedback + DB         | Per finding |
| Performance   | OpenTelemetry + Prometheus | Real-time   |
| NPS           | In-app survey              | Monthly     |

---

## 7. ALERTING

| Condition            | Alert              | Action                  |
| -------------------- | ------------------ | ----------------------- |
| WAD drops > 10%      | PagerDuty          | Investigate churn cause |
| False positive > 20% | Slack #product     | Pause new rules         |
| Error rate > 1%      | PagerDuty          | Check infrastructure    |
| Revenue churn > 5%   | Email CEO          | Review pricing/UX       |
| Scan time p95 > 120s | Slack #engineering | Scale workers           |

---

_Dashboard maintained by data + growth team._
_Investor snapshot sent monthly._
