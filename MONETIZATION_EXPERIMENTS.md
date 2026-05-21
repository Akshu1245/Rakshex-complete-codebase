# Rakshex Monetization Experiments

> Testing what developers will pay for.
> Date: 2026-05-17

---

## PRICING HYPOTHESES

### Hypothesis 1: Freemium Converts

**Test:** Free tier (1 collection, 10 scans/mo) → Pro ($29/mo)
**Mechanic:** Gate advanced features, not basic security
**Success metric:** Free-to-paid conversion rate ≥ 5%
**Duration:** 4 weeks
**Status:** Pending

### Hypothesis 2: Usage-Based Pricing

**Test:** $0.10 per scan + $5/mo base
**Mechanic:** Pay for what you use
**Success metric:** ARPU ≥ $25/mo
**Duration:** 4 weeks
**Status:** Pending

### Hypothesis 3: Team-Based Value

**Test:** $29/user/mo or $99/team/mo (up to 10)
**Mechanic:** Team features drive org adoption
**Success metric:** Team plan selection rate ≥ 30%
**Duration:** 4 weeks
**Status:** Pending

### Hypothesis 4: Enterprise-First

**Test:** No free tier. $500/mo minimum.
**Mechanic:** Position as enterprise tool from day 1
**Success metric:** Close 3 enterprise pilots in 8 weeks
**Duration:** 8 weeks
**Status:** Pending

---

## EXPERIMENT TEMPLATES

### Experiment: Pro Feature Gating

```
Name: Pro Feature Gating
Hypothesis: Users who hit the free limit will upgrade
Variant A: Limit to 10 scans/mo, no gating on features
Variant B: Limit to 5 scans/mo, gate advanced features
Control: Everything free during beta

Metrics:
  Primary: Free-to-paid conversion rate
  Secondary: Scans per user, retention, NPS

Duration: 4 weeks
Sample: 100 beta users (random assignment)

Success criteria:
  Variant A wins if conversion > 5% AND retention > 60%
  Variant B wins if conversion > 8% AND retention > 50%
```

### Experiment: Pricing Page A/B

```
Name: Pricing Page Optimization
Hypothesis: Feature-comparison tables increase conversion
Variant A: Simple 3-tier cards
Variant B: Feature matrix with checkmarks
Variant C: ROI calculator ("How much will you save?")

Metrics:
  Primary: Click-through to checkout
  Secondary: Time on page, bounce rate

Duration: 2 weeks
Sample: All pricing page visitors
```

---

## WILLINGNESS-TO-PAY SURVEY

### Van Westendorp Price Sensitivity Meter

Ask 4 questions to 30+ users:

1. At what price would Rakshex be so expensive you'd not consider it?
   → Point of Marginal Cheapness: $\_\_\_

2. At what price would Rakshex be priced so low you'd question its quality?
   → Point of Marginal Expensiveness: $\_\_\_

3. At what price would Rakshex start to feel expensive but you'd still buy it?
   → Optimal Price Point: $\_\_\_

4. At what price would Rakshex be a bargain?
   → Indifference Price Point: $\_\_\_

**Optimal price range:** $**_ — $_**

---

## REVENUE PROJECTIONS

### Scenario A: Freemium (Conservative)

| Month | Free Users | Pro Users | Team Users | MRR     |
| ----- | ---------- | --------- | ---------- | ------- |
| 1     | 500        | 10        | 0          | $290    |
| 3     | 2,000      | 50        | 2          | $1,650  |
| 6     | 5,000      | 150       | 10         | $5,350  |
| 12    | 15,000     | 500       | 30         | $17,470 |

### Scenario B: Enterprise-First (Aggressive)

| Month | Pilots | Paying Orgs | Avg Contract | MRR     |
| ----- | ------ | ----------- | ------------ | ------- |
| 1     | 3      | 0           | $0           | $0      |
| 3     | 8      | 2           | $1,000       | $2,000  |
| 6     | 15     | 5           | $1,500       | $7,500  |
| 12    | 25     | 12          | $2,000       | $24,000 |

### Scenario C: Hybrid (Recommended)

| Month | Free   | Pro | Team | Enterprise | MRR     |
| ----- | ------ | --- | ---- | ---------- | ------- |
| 1     | 200    | 10  | 0    | 0          | $290    |
| 3     | 1,000  | 60  | 5    | 1          | $3,235  |
| 6     | 3,000  | 200 | 20   | 3          | $10,800 |
| 12    | 10,000 | 700 | 60   | 8          | $35,300 |

---

## UNIT ECONOMICS TARGETS

| Metric                | Target | Current |
| --------------------- | ------ | ------- |
| CAC                   | < $50  | $\_\_\_ |
| LTV                   | > $300 | $\_\_\_ |
| LTV/CAC               | > 3    | \_\_\_  |
| Gross margin          | > 80%  | \_\_\_% |
| Months to payback     | < 12   | \_\_\_  |
| Net Revenue Retention | > 110% | \_\_\_% |

---

_Experiments maintained by founder + growth team._
_Run one pricing experiment at a time._
