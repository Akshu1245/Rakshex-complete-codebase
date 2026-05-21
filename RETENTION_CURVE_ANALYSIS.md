# Rakshex Retention Curve Analysis

> Understanding who stays and why.
> Date: 2026-05-17

---

## COHORT RETENTION TABLE

```
Cohort     | Size | D1   | D3   | D7   | D14  | D30  | D60  | D90
-----------|------|------|------|------|------|------|------|------
2026-04-01 | ___  | ___% | ___% | ___% | ___% | ___% | ___% | ___%
2026-04-08 | ___  | ___% | ___% | ___% | ___% | ___% | ___% | ___%
2026-04-15 | ___  | ___% | ___% | ___% | ___% | ___% | ___% | ___%
2026-04-22 | ___  | ___% | ___% | ___% | ___% | ___% | ___% | ___%
2026-04-29 | ___  | ___% | ___% | ___% | ___% | ___% | ___% | ___%
2026-05-06 | ___  | ___% | ___% | ___% | ___% | ___% | ___% | ___%
2026-05-13 | ___  | ___% | ___% | ___% | ___% | ___% | ___% | ___%
-----------|------|------|------|------|------|------|------|------
Average    |      | ___% | ___% | ___% | ___% | ___% | ___% | ___%
```

---

## CURVE SHAPE ANALYSIS

### Type A: Flattening Curve (PMF Signal)

```
100% │
 80% │    ╭──╮
 60% │   ╭╯  ╰──╮
 40% │  ╭╯      ╰────╮
 20% │ ╭╯            ╰─────────
  0% └─────────────────────────
      D1  D7  D14 D30 D60 D90
```

**What it means:** Users who stay past Day 7 tend to stay long-term.
**What to do:** Optimize Day 1-7 experience.

### Type B: Steady Decline (No PMF)

```
100% │
 80% │  ╭╮
 60% │ ╭╯╰╮
 40% │╭╯  ╰╮
 20% │╯    ╰╮
  0% └───────
      D1 D7 D14 D30
```

**What it means:** Users don't find lasting value.
**What to do:** Find the wedge. Talk to users who stayed.

### Type C: Cliff Then Flat (Activation Problem)

```
100% │
 80% │╭╮
 40% │╯╰──╮
 20% │    ╰─────────────
  0% └───────────────────
      D1 D3 D7 D14 D30
```

**What it means:** Users who activate stay; most don't activate.
**What to do:** Fix onboarding. Get to value faster.

---

## SEGMENT RETENTION

| Segment          | D1      | D7      | D30     | Pattern |
| ---------------- | ------- | ------- | ------- | ------- |
| Security-First   | \_\_\_% | \_\_\_% | \_\_\_% | \_\_\_  |
| Cost-Optimizer   | \_\_\_% | \_\_\_% | \_\_\_% | \_\_\_  |
| AI Builder       | \_\_\_% | \_\_\_% | \_\_\_% | \_\_\_  |
| Curious Explorer | \_\_\_% | \_\_\_% | \_\_\_% | \_\_\_  |

**Insight:** **\*\***\_**\*\*** segment retains at **\_× the rate of \*\***\_\_\_**\*\***

---

## ACTIVATION IMPACT

| Action                  | D7 Retention | D30 Retention |
| ----------------------- | ------------ | ------------- |
| No action after install | \_\_\_%      | \_\_\_%       |
| Connected API key only  | \_\_\_%      | \_\_\_%       |
| Imported collection     | \_\_\_%      | \_\_\_%       |
| Ran first scan          | \_\_\_%      | \_\_\_%       |
| Found an issue          | \_\_\_%      | \_\_\_%       |
| Set up alert            | \_\_\_%      | \_\_\_%       |
| Shared with team        | \_\_\_%      | \_\_\_%       |

**Key insight:** Users who **\*\***\_**\*\*** retain at \_\_\_× the rate of those who don't.

---

## INTERVENTION IMPACT

| Intervention        | Applied To | Retention Lift |
| ------------------- | ---------- | -------------- |
| Onboarding email    | All        | \_\_\_%        |
| Personal outreach   | At-risk    | \_\_\_%        |
| Weekly digest       | Active     | \_\_\_%        |
| Feature tip         | Casual     | \_\_\_%        |
| Re-engagement email | Churned    | \_\_\_%        |

---

## TARGET CURVE

```
100% │
 60% │  ╭╮
 40% │ ╭╯╰──╮
 25% │╭╯    ╰────╮
 20% │╯          ╰──────────
  0% └──────────────────────
      D1 D7 D14 D30 D60 D90
```

| Day | Target | Current | Gap    |
| --- | ------ | ------- | ------ |
| D1  | 60%    | \_\_\_% | \_\_\_ |
| D7  | 40%    | \_\_\_% | \_\_\_ |
| D14 | 30%    | \_\_\_% | \_\_\_ |
| D30 | 25%    | \_\_\_% | \_\_\_ |
| D60 | 22%    | \_\_\_% | \_\_\_ |
| D90 | 20%    | \_\_\_% | \_\_\_ |

---

_Analysis maintained by growth + data team._
_Updated weekly with fresh cohort data._
