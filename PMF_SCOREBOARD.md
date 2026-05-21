# Rakshex Product-Market Fit Scoreboard

> Measuring the signals that prove we're building something people want.
> Date: 2026-05-17

---

## THE PMF SCORECARD

Based on Rahul Vohra's Product-Market Fit framework and Sean Ellis's 40% rule.

### 1. The "Very Disappointed" Test (Sean Ellis)

> "How would you feel if you could no longer use Rakshex?"

| Response              | Count | %     |
| --------------------- | ----- | ----- |
| Very disappointed     | \_\_  | \_\_% |
| Somewhat disappointed | \_\_  | \_\_% |
| Not disappointed      | \_\_  | \_\_% |
| N/A — no longer use   | \_\_  | \_\_% |

**Target:** ≥ 40% "Very disappointed"
**Current:** \_\_%
**Status:** 🔴 Not there / 🟡 Getting close / 🟢 PMF achieved

---

### 2. The "Must-Have" Test

> "What type of person do you think would benefit most from Rakshex?"

If users describe themselves → strong signal.

| User Self-Description Match | Count | %     |
| --------------------------- | ----- | ----- |
| Describes themselves        | \_\_  | \_\_% |
| Describes someone else      | \_\_  | \_\_% |
| Can't answer                | \_\_  | \_\_% |

**Target:** ≥ 50% describe themselves
**Current:** \_\_%

---

### 3. The "Push" Test

> "Have you recommended Rakshex to anyone?"

| Response                 | Count | %     |
| ------------------------ | ----- | ----- |
| Yes, already recommended | \_\_  | \_\_% |
| Not yet, but planning to | \_\_  | \_\_% |
| No                       | \_\_  | \_\_% |

**Target:** ≥ 30% already recommended
**Current:** \_\_%

---

### 4. The "Alternative" Test

> "What would you use if Rakshex didn't exist?"

| Response                      | Count | %     |
| ----------------------------- | ----- | ----- |
| Nothing — I'd build something | \_\_  | \_\_% |
| Manual process                | \_\_  | \_\_% |
| Competitor (Snyk, etc.)       | \_\_  | \_\_% |
| Don't know                    | \_\_  | \_\_% |

**Strongest signal:** "Nothing — I'd build something" or "Manual process"

---

## QUANTITATIVE PMF SIGNALS

### Cohort Retention (The Real Test)

```
Cohort    | W0 | W1  | W2  | W4  | W8  | W12
----------|----|-----|-----|-----|-----|-----
Current   |100%| ___%| ___%| ___%| ___%| ___%
-1 week   |100%| ___%| ___%| ___%| ___%| ___%
-2 weeks  |100%| ___%| ___%| ___%| ___%| ___%
```

**PMF Signal:** Flattening retention curve by Week 8.

---

### Usage Intensity

| Metric                    | Target | Current  | PMF? |
| ------------------------- | ------ | -------- | ---- |
| Scans per user / week     | 2+     | \_\_     |      |
| Sessions per user / week  | 3+     | \_\_     |      |
| Avg session duration      | 5+ min | \_\_ min |      |
| Features used per session | 2+     | \_\_     |      |

---

### Organic Growth

| Metric                       | Target       | Current |
| ---------------------------- | ------------ | ------- |
| Organic installs / week      | 50% of total | \_\_%   |
| Referral rate (invites/user) | 0.5+         | \_\_    |
| Organic mentions / week      | 5+           | \_\_    |
| User-generated content       | 2+ / month   | \_\_    |

---

## QUALITATIVE PMF SIGNALS

### What Users Say (Track Verbatim)

| Signal Type           | Example Quote | User Count |
| --------------------- | ------------- | ---------- |
| "Can't live without"  |               | \_\_       |
| "Tells colleagues"    |               | \_\_       |
| "Requests enterprise" |               | \_\_       |
| "Offers to pay more"  |               | \_\_       |
| "Asks for team plan"  |               | \_\_       |
| "Checks daily"        |               | \_\_       |

### What Users Do

| Behavior                | Count | % of Active |
| ----------------------- | ----- | ----------- |
| Return within 24h       | \_\_  | \_\_%       |
| Use 3+ days / week      | \_\_  | \_\_%       |
| Scan without prompting  | \_\_  | \_\_%       |
| Open sidebar unprompted | \_\_  | \_\_%       |
| Click weekly summary    | \_\_  | \_\_%       |
| Share with team         | \_\_  | \_\_%       |

---

## PMF SCORING

| Signal                      | Weight   | Score (0-10) | Weighted      |
| --------------------------- | -------- | ------------ | ------------- |
| Very disappointed ≥ 40%     | 20%      | \_\_         | \_\_          |
| W8 retention ≥ 20%          | 20%      | \_\_         | \_\_          |
| Scans/week ≥ 2              | 15%      | \_\_         | \_\_          |
| Referral rate ≥ 0.5         | 15%      | \_\_         | \_\_          |
| Organic installs ≥ 50%      | 15%      | \_\_         | \_\_          |
| "Can't live without" quotes | 15%      | \_\_         | \_\_          |
| **TOTAL**                   | **100%** |              | **\_\_ / 10** |

**Interpretation:**

- 0-3: No PMF. Pivot or iterate heavily.
- 4-6: Early signals. Double down on what's working.
- 7-8: Strong PMF. Time to scale.
- 9-10: Category leader potential.

---

## ACTIONS BY SCORE

| Score | Action                                                 |
| ----- | ------------------------------------------------------ |
| < 3   | Talk to 20 more users. Find the segment that loves it. |
| 3-5   | Run retention experiments. Fix top 3 blockers.         |
| 5-7   | Optimize onboarding. Increase scan frequency.          |
| 7-9   | Scale acquisition. Launch publicly. Raise seed.        |
| 9+    | Scale aggressively. Series A. Hire fast.               |

---

_Scoreboard maintained by founder._
_Updated weekly with fresh survey data._
