# Rakshex Retention Dashboard

> What we track to ensure developers stay.
> Date: 2026-05-17

---

## 1. PRIMARY METRICS

### North Star: Weekly Active Developers (WAD)

```
Definition: Unique developers who interact with Rakshex in a 7-day window
  (open sidebar, run scan, view finding, or check dashboard)

Target:
  Week 1 (launch): 100
  Month 1: 500
  Month 3: 2,000
  Month 6: 5,000
  Month 12: 15,000

Current: [TBD at launch]
```

### Activation Rate

```
Definition: % of new users who complete first scan within 24 hours

Funnel:
  Install extension    →    Connect account    →    Import collection    →    Run scan
     100%                     60%                   40%                    25%

Target: 50% of installers complete full funnel
Action: If < 40%, investigate onboarding friction
```

### Retention Cohorts

```
Week 1: Target 40% (of users who activated)
Week 4: Target 25%
Week 12: Target 15%

Cohort table:
          W1    W2    W3    W4    W8    W12
May 1     100%  65%   50%   40%   30%   20%
May 8     100%  60%   48%   38%   —     —
May 15    100%  62%   —     —     —     —
```

---

## 2. PRODUCT HEALTH

### Time to First Value

```
Definition: Minutes from install to first meaningful finding

Distribution:
  p50: Target < 3 min
  p90: Target < 10 min
  p99: Target < 30 min

If p50 > 5 min: Onboarding is too slow
```

### Scan Frequency

```
Definition: Average scans per user per week

Target:
  Power users (top 10%): 5+ scans/week
  Regular users: 2-3 scans/week
  At-risk users: < 1 scan/month

Action: Email dormant users with "You haven't scanned in X days"
```

### False Positive Rate

```
Definition: % of findings marked "not relevant" by users

Target: < 15%
Warning: > 20%
Critical: > 30%

Action at warning: Pause new rules, investigate weak detections
```

---

## 3. CHURN SIGNALS

### Leading Indicators

| Signal                    | Meaning           | Action                                       |
| ------------------------- | ----------------- | -------------------------------------------- |
| No scan in 7 days         | Losing engagement | Email: "Your API collections need a checkup" |
| Marked > 5 findings as FP | Quality issue     | In-app survey: "How can we improve?"         |
| Extension disabled        | About to churn    | Email: "Having trouble? Let's fix it."       |
| High error rate           | Broken experience | Auto-create support ticket                   |
| Never imported collection | Onboarding failed | Email with video tutorial                    |

### Churn Recovery

```
Detect: No activity for 14 days
    ↓
Action 1: Email with "What you're missing" (week 2)
    ↓
Action 2: Personal email from founder (week 3)
    ↓
Action 3: Offer 1:1 onboarding call (week 4)
    ↓
Action 4: Mark as churned, learn from exit survey
```

---

## 4. VALUE METRICS

### Money Saved

```
Definition: Estimated $ from hidden cost detection + agent prevention

Calculation:
  hidden_costs_detected + (agents_stopped × avg_cost_per_agent)

Target per user: $50/month saved (justifies $29 Pro plan)
```

### Security Impact

```
Definition: Vulnerabilities found and fixed

Track:
  - Secrets found → rotated
  - Auth issues → fixed
  - Injection vectors → patched
  - Total prevented breaches (estimated)

Dashboard: "You've prevented 3 potential breaches this month"
```

### "Saved Me" Moments

```
Track events that trigger emotional response:
  - AgentGuard stopped rogue agent
  - Hidden cost alert saved > $20
  - Secret found before deploy
  - Compliance report passed audit

Target: 1 "saved me" moment per user per month
```

---

## 5. DASHBOARD SPEC

```
┌──────────────────────────────────────────────────────────────┐
│  Rakshex Retention Dashboard                    [Refresh]   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  WAD: 347    ▲ 12% WoW    Activation: 48%    ▲ 3%          │
│  Retention D7: 38%    D30: 22%    Churn: 4.2%               │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  ONBOARDING FUNNEL                                          │
│  Install [100%] → Connect [60%] → Import [40%] → Scan [25%] │
│  ⚠️  Drop-off at "Import collection" (40% → 25%)             │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  COHORT RETENTION                                           │
│  May 1 cohort:  W1 100% → W2 65% → W4 40% → W12 20%         │
│  May 8 cohort:  W1 100% → W2 60% → W4 38%                    │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  PRODUCT HEALTH                                             │
│  Time to value (p50): 3.2 min     ✅                          │
│  Scans/user/week: 2.4           ✅                          │
│  False positive rate: 12%         ✅                          │
│  Extension crash rate: 0.3%     ✅                          │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  VALUE DELIVERED                                            │
│  Total $ saved this month: $14,230                          │
│  Agents stopped: 47                                         │
│  Secrets found: 234                                         │
│  Potential breaches prevented: 12                           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  AT-RISK USERS (No scan in 7 days)                         │
│  23 users    → Send re-engagement email                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. WEEKLY REVIEW AGENDA

```
Retention Review (30 min, every Monday)

1. Metrics (5 min)
   - WAD, activation, retention
   - Compare to last week and target

2. Funnel Analysis (10 min)
   - Biggest drop-off point
   - Hypothesis for why
   - Experiment to fix

3. Churn Review (10 min)
   - Who churned this week?
   - Exit survey themes
   - Action items

4. Wins (5 min)
   - Best "saved me" story
   - Highest engagement user
   - Best feedback received
```

---

_Dashboard maintained by growth + product team._
_Reviewed weekly, strategy updated monthly._
