# DevPulse Weekly Execution Review

> The operating rhythm of a real startup.
> Date: 2026-05-17

---

## EVERY MONDAY (9:00 AM, 30 min)

### Attendees

- Founder (CEO)
- Engineering lead
- Growth lead
- Product lead (if exists)

### Agenda

**1. Metrics Review (10 min)**

```
GROWTH
  New installs:        ___  (target: ___)
  Activations:           ___% (target: 50%)
  WAD:                  ___  (target: ___)
  D7 retention:         ___% (target: 40%)
  D30 retention:        ___% (target: 20%)

PRODUCT
  Scans run:             ___
  Findings detected:     ___
  True positive rate:   ___% (target: >85%)
  False positive rate:  ___% (target: <15%)
  Avg scan time:        ___s (target: <10s)

BUSINESS
  MRR:                 $___  (target: ___)
  Paying users:         ___
  Churn:               ___%  (target: <5%)

SYSTEMS
  Uptime:              ___% (target: 99.9%)
  Error rate:          ___% (target: <1%)
  Extension crash rate: ___% (target: <0.5%)
  Support tickets:      ___  (target: <5/day)
```

**2. What Worked (5 min)**

- Top win this week: ******\_******
- Best user feedback: ******\_******
- Most impactful fix: ******\_******

**3. What Didn't (5 min)**

- Top blocker: ******\_******
- Biggest mistake: ******\_******
- Lesson learned: ******\_******

**4. Next Week's Priorities (10 min)**

| Priority | Owner | Deliverable | Success Metric |
| -------- | ----- | ----------- | -------------- |
| 1.       |       |             |                |
| 2.       |       |             |                |
| 3.       |       |             |                |

---

## EVERY WEDNESDAY (3:00 PM, 15 min)

### User Standup

- Review top 5 user pains from the week
- Check activation funnel for drop-offs
- Review churned users and exit surveys
- Assign quick fixes for Friday

---

## EVERY FRIDAY (4:00 PM, 15 min)

### Ship Review

- What shipped this week?
- Did we hit our 3 priorities?
- What needs to roll to next week?
- Any blockers for next week?

---

## DAILY (9:00 AM, 10 min)

### Daily Standup (async in Slack)

```
Yesterday I:
- _____________

Today I will:
- _____________

Blocked by:
- _____________
```

### Daily Metrics Check (automated)

Bot posts in #metrics at 9 AM:

```
📊 DevPulse Daily — May 17, 2026

New installs:    ___  (___ vs yesterday)
Active users:     ___  (___ vs yesterday)
Scans:            ___  (___ vs yesterday)
Errors:           ___  (___ vs yesterday)

Top finding today: _____________
Top blocker today: _____________
```

---

## MONTHLY (First Monday, 60 min)

### Strategy Review

1. **Retrospective** (20 min)
   - What went well?
   - What didn't?
   - What should we start/stop/continue?

2. **Metrics Deep Dive** (20 min)
   - Cohort retention analysis
   - Activation funnel trends
   - Revenue and unit economics
   - Competitive landscape changes

3. **Next Month Planning** (20 min)
   - Top 3 objectives
   - Key results for each
   - Resource allocation
   - Risk assessment

---

## METRIC OWNERSHIP

| Metric     | Owner       | Tool                | Review Frequency |
| ---------- | ----------- | ------------------- | ---------------- |
| Installs   | Growth      | VS Code Marketplace | Daily            |
| Activation | Product     | PostHog             | Daily            |
| Retention  | Product     | PostHog cohorts     | Weekly           |
| Scans      | Engineering | Telemetry DB        | Daily            |
| Findings   | Engineering | DB + user feedback  | Weekly           |
| MRR        | Founder     | Stripe              | Weekly           |
| Uptime     | Engineering | UptimeRobot         | Daily            |
| Errors     | Engineering | Sentry              | Daily            |
| NPS        | Growth      | In-app survey       | Weekly           |
| Support    | Growth      | Zendesk/Email       | Daily            |

---

## RULES OF EXECUTION

1. **Ship every week.** Something must go live every Friday.
2. **Metrics over opinions.** When in doubt, look at the data.
3. **Users over features.** Talk to users before writing code.
4. **Speed over perfection.** 80% done and shipped beats 100% done and hidden.
5. **No silent failures.** If something breaks, everyone knows in 5 minutes.
6. **Write it down.** Decisions, learnings, and processes are documented.
7. **Celebrate wins.** Even small ones. Momentum matters.

---

_Operating rhythm maintained by founder._
_Followed religiously._
