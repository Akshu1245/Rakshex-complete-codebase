# DevPulse Retention Analysis

> Why users come back (or don't).
> Date: 2026-05-17

---

## RETENTION DEFINITION

### Cohort: Users who completed first scan

| Day | Definition                     | Target |
| --- | ------------------------------ | ------ |
| D1  | Opened sidebar within 24h      | 60%    |
| D7  | Ran scan within 7 days         | 40%    |
| D14 | Viewed findings within 14 days | 30%    |
| D30 | Any activity within 30 days    | 20%    |

---

## COHORT TABLE

```
Cohort    | D0 | D1  | D3  | D7  | D14 | D30
----------|----|-----|-----|-----|-----|-----
May 17    |100%| __% | __% | __% | __% | __%
May 10    |100%| __% | __% | __% | __% | __%
May 3     |100%| __% | __% | __% | __% | __%
```

---

## WHY USERS RETURN

### Top Retention Drivers (from surveys)

| Driver                       | % of returning users |
| ---------------------------- | -------------------- |
| Found a real security issue  | \_\_%                |
| Saved money on API costs     | \_\_%                |
| AgentGuard stopped something | \_\_%                |
| Weekly summary email         | \_\_%                |
| Team uses it together        | \_\_%                |

### Qualitative Feedback

> "I keep it installed because I found 3 exposed secrets I didn't know about."
> — User A, AI startup

> "The weekly cost summary is the first thing I check Monday morning."
> — User B, indie hacker

> "AgentGuard stopped a runaway agent after 2 hours. That's why I trust it."
> — User C, Series B SaaS

---

## WHY USERS CHURN

### Top Churn Reasons (from exit surveys)

| Reason            | % of churned users |
| ----------------- | ------------------ |
| Didn't find value | \_\_%              |
| Too confusing     | \_\_%              |
| Found bugs        | \_\_%              |
| Missing features  | \_\_%              |
| Too expensive     | \_\_%              |
| Privacy concerns  | \_\_%              |

### Qualitative Feedback

> "I installed it but never got around to importing a collection."
> — Churned User D

> "It found things but I didn't understand why they mattered."
> — Churned User E

---

## RE-ENGAGEMENT STRATEGY

### At-Risk Users (No activity for 7 days)

**Email:**

```
Subject: Your API collections need a checkup

Hi {{name}},

It's been a week since your last DevPulse scan.

A lot can change in a week — new endpoints, updated dependencies,
new team members pushing code.

Take 30 seconds to rescan:
[Run Scan Now]

This week, 12 vulnerabilities were found across all DevPulse users.
Make sure yours aren't among them.

Akshay
```

### Dormant Users (No activity for 30 days)

**Email:**

```
Subject: We're building something you asked for

Hi {{name}},

You mentioned {{feature_request}} when you tried DevPulse.

Good news: we shipped it last week.

[Try it now]

Plus, we found a few other things you might like:
- {{new_feature_1}}
- {{new_feature_2}}

Would love your feedback.

Akshay
```

---

## RETENTION EXPERIMENTS

| Experiment       | Hypothesis                      | Result |
| ---------------- | ------------------------------- | ------ |
| Weekly email     | Emails increase D7 by 10%       | \_\_   |
| In-product toast | "You haven't scanned in 3 days" | \_\_   |
| Security streaks | "5-day scanning streak!" badge  | \_\_   |
| Cost alerts      | Alert when spend > baseline     | \_\_   |
| Team features    | "Your team found X issues"      | \_\_   |

---

_Analysis maintained by growth team._
_Updated weekly with cohort data._
