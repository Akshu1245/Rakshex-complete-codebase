# Rakshex Retention Optimization Report

> Engineering habits into the product.
> Date: 2026-05-17

---

## RETENTION DIAGNOSIS

### Current State

| Metric                | Value   | Target | Gap    |
| --------------------- | ------- | ------ | ------ |
| D1 retention          | \_\_\_% | 60%    | \_\_\_ |
| D7 retention          | \_\_\_% | 40%    | \_\_\_ |
| D30 retention         | \_\_\_% | 20%    | \_\_\_ |
| WAD / total installed | \_\_\_% | 50%    | \_\_\_ |

### Churn Reasons (Ranked)

| Reason           | % of Churned | Preventable?                |
| ---------------- | ------------ | --------------------------- |
| Never got value  | \_\_\_%      | Yes — better onboarding     |
| Confusing UI     | \_\_\_%      | Yes — UX fixes              |
| Found no issues  | \_\_\_%      | Yes — demo + sample data    |
| Forgot about it  | \_\_\_%      | Yes — email + notifications |
| Too slow         | \_\_\_%      | Yes — performance           |
| Bugs             | \_\_\_%      | Yes — QA                    |
| Missing features | \_\_\_%      | Partial — roadmap           |
| Privacy concerns | \_\_\_%      | Yes — trust center          |
| Too expensive    | \_\_\_%      | Partial — pricing test      |

---

## RETENTION LEVERS

### Lever 1: First-Session Value

**Hypothesis:** Users who find an issue in their first session retain at 2× the rate.

**Experiment:**

- Variant A: Current flow (import → scan)
- Variant B: Auto-scan sample collection on first connect
- Variant C: Show pre-loaded demo findings immediately

**Success metric:** First-session issue discovery rate

---

### Lever 2: Weekly Digest

**Hypothesis:** Weekly emails increase D7 retention by 15%.

**Implementation:**

```
Subject: Your weekly AI security summary

Hi {{name}},

This week with Rakshex:
🛡️ Scans run: {{scans}}
🔍 Issues found: {{findings}}
💰 Money saved: ${{saved}}
🛑 Agents stopped: {{agents}}

[View Dashboard]

Your API security score: {{score}}/100
```

**Success metric:** Email open rate > 40%, click rate > 15%

---

### Lever 3: Anomaly Alerts

**Hypothesis:** Real-time alerts about cost/security create immediate re-engagement.

**Trigger conditions:**

- Cost spike > 50% over baseline
- New critical finding detected
- AgentGuard stopped something
- Scan failed (potential issue)

**Delivery:**

- In-app toast (immediate)
- Email (if not seen in 1 hour)
- Slack (if team integration)

**Success metric:** Alert → scan within 1 hour: > 30%

---

### Lever 4: Streak System

**Hypothesis:** Gamification increases scan frequency.

**Design:**

```
🔥 5-day scanning streak!

Keep it going: Run a scan today.

[Scan Now]
```

**Rewards:**

- 3-day streak: "Security Sentinel" badge
- 7-day streak: "Guardian" badge + Pro trial extension
- 30-day streak: "Champion" badge + swag

**Success metric:** Users with streaks scan 2× more frequently

---

### Lever 5: Team Effects

**Hypothesis:** Team usage creates social retention.

**Implementation:**

- "Your team found X issues this week"
- Team leaderboard (optional)
- Shared weekly summary
- @mentions in Slack for findings

**Success metric:** Team users retain at 1.5× individual users

---

## RETENTION EXPERIMENT LOG

| #   | Experiment            | Hypothesis          | Duration | Result | Decision |
| --- | --------------------- | ------------------- | -------- | ------ | -------- |
| 1   | Auto-scan on import   | +20% activation     | 2 weeks  |        |          |
| 2   | Weekly email digest   | +15% D7             | 4 weeks  |        |          |
| 3   | Cost spike alerts     | +10% D7             | 4 weeks  |        |          |
| 4   | Streak system         | +25% scan frequency | 4 weeks  |        |          |
| 5   | Team summaries        | +15% D30            | 4 weeks  |        |          |
| 6   | Onboarding call offer | +20% activation     | 2 weeks  |        |          |
| 7   | Pro trial on Day 3    | +10% conversion     | 4 weeks  |        |          |
| 8   | Re-engagement email   | +5% resurrection    | 2 weeks  |        |          |

---

## ENGAGEMENT SCORING

### User Engagement Score (0-100)

| Action          | Points | Max per week |
| --------------- | ------ | ------------ |
| Run scan        | 10     | 50           |
| View finding    | 5      | 25           |
| Mark status     | 5      | 25           |
| Open dashboard  | 3      | 15           |
| Share report    | 15     | 15           |
| Invite teammate | 20     | 20           |
| Leave feedback  | 10     | 10           |

**Score tiers:**

- 0-20: At risk
- 21-50: Casual
- 51-80: Engaged
- 81-100: Power user

**Actions by tier:**

- At risk → Re-engagement campaign
- Casual → Feature discovery prompts
- Engaged → Pro upgrade prompt
- Power user → Champion program invite

---

## RETENTION TARGETS

| Timeline | D1     | D7     | D14    | D30    |
| -------- | ------ | ------ | ------ | ------ |
| Current  | \_\_\_ | \_\_\_ | \_\_\_ | \_\_\_ |
| Month 1  | 50%    | 30%    | 20%    | 15%    |
| Month 2  | 55%    | 35%    | 25%    | 20%    |
| Month 3  | 60%    | 40%    | 30%    | 25%    |
| Month 6  | 65%    | 45%    | 35%    | 30%    |

---

_Report maintained by growth + product team._
_Updated weekly with cohort data._
