# Rakshex Execution Operating System

> How we operate as a world-class startup.
> Date: 2026-05-17

---

## OPERATING PRINCIPLES

1. **Users over everything.** Every decision starts with "what do users need?"
2. **Ship every week.** Something must go live every Friday.
3. **Metrics over opinions.** When in doubt, look at the data.
4. **Speed over perfection.** 80% done and shipped beats 100% hidden.
5. **Trust compounds.** Every interaction either builds or destroys trust.
6. **No silent failures.** If something breaks, everyone knows in 5 minutes.
7. **Write it down.** Decisions, learnings, and processes are documented.
8. **Celebrate wins.** Even small ones. Momentum matters.

---

## WEEKLY CADENCE

### Monday (9:00 AM, 30 min)

**Metrics Review**

Attendees: Founder, Engineering, Growth, Product

```
GROWTH
  New installs:        ___  (target: ___)
  Activations:         ___% (target: 50%)
  WAD:                 ___  (target: ___)
  D7 retention:        ___% (target: 40%)
  D30 retention:       ___% (target: 20%)

PRODUCT
  Scans run:           ___
  Findings detected:   ___
  True positive rate:  ___% (target: >85%)
  False positive rate: ___% (target: <15%)
  Avg scan time:       ___s (target: <10s)

BUSINESS
  MRR:                 $___ (target: ___)
  Paying users:        ___
  Churn:               ___% (target: <5%)

SYSTEMS
  Uptime:              ___% (target: 99.9%)
  Error rate:          ___% (target: <1%)
  Extension crashes:   ___% (target: <0.5%)
  Support tickets:     ___ (target: <5/day)
```

**What worked:** **\_
**What didn't:** \_**
**This week's top 3 priorities:**

1. ***
2. ***
3. ***

---

### Tuesday

**Content + Outreach Day**

- Publish engineering blog post
- Post on Twitter/LinkedIn
- Outreach to 5 potential beta users
- Respond to all community messages

---

### Wednesday (3:00 PM, 15 min)

**User Standup**

- Review top 5 user pains from the week
- Check activation funnel for drop-offs
- Review churned users and exit surveys
- Assign quick fixes for Friday

---

### Thursday

**Product Hunt / Investor / Enterprise Prep**

- PH prep (if launching soon)
- Investor outreach (if fundraising)
- Enterprise demo prep (if piloting)
- Community engagement

---

### Friday (4:00 PM, 15 min)

**Ship Review**

- What shipped this week?
- Did we hit our 3 priorities?
- What needs to roll to next week?
- Any blockers for next week?
- Update CHANGELOG.md
- Celebrate wins

---

## DAILY CADENCE

### Morning (9:00 AM, 10 min)

- Check metrics dashboard
- Review overnight support tickets
- Respond to critical user issues
- Post daily standup in Slack

### Afternoon (3:00 PM, 10 min)

- Check activation funnel
- Review false positive reports
- Respond to marketplace reviews
- Engage with social mentions

### Evening (6:00 PM, 10 min)

- Fill out DAILY_BETA_REPORT.md
- Review day's progress
- Set tomorrow's top 3 tasks
- Check server health

---

## MONTHLY CADENCE

### First Monday (60 min)

**Strategy Review**

1. Retrospective (20 min)
   - What went well?
   - What didn't?
   - Start/stop/continue?

2. Metrics Deep Dive (20 min)
   - Cohort retention analysis
   - Revenue and unit economics
   - Competitive landscape

3. Next Month Planning (20 min)
   - Top 3 objectives
   - Key results
   - Resource allocation

### Mid-Month

- Security audit
- Performance review
- User interviews (minimum 3)

### End of Month

- Investor update (INVESTOR_UPDATE_TEMPLATE.md)
- Collect testimonials
- Update benchmark reports
- Content calendar for next month

---

## METRIC OWNERSHIP

| Metric     | Owner       | Tool                | Review |
| ---------- | ----------- | ------------------- | ------ |
| Installs   | Growth      | VS Code Marketplace | Daily  |
| Activation | Product     | PostHog             | Daily  |
| Retention  | Product     | PostHog cohorts     | Weekly |
| Scans      | Engineering | Telemetry DB        | Daily  |
| Findings   | Engineering | DB + feedback       | Weekly |
| MRR        | Founder     | Stripe              | Weekly |
| Uptime     | Engineering | UptimeRobot         | Daily  |
| Errors     | Engineering | Sentry              | Daily  |
| NPS        | Growth      | In-app survey       | Weekly |
| Support    | Growth      | Zendesk             | Daily  |
| Reviews    | Growth      | Marketplace         | Daily  |
| Content    | DevRel      | Analytics           | Weekly |

---

## DECISION FRAMEWORK

### The "5 Whys" for Every Feature

Before building anything, ask:

1. What user problem does this solve?
2. How many users have this problem?
3. Is this the most important problem to solve right now?
4. What's the simplest version that solves it?
5. How will we know if it worked?

### The "Kill Criteria"

Kill a feature if:

- Usage < 10% of active users after 30 days
- Support tickets > 2/week about it
- It slows scans by > 20%
- It complicates onboarding
- No user asked for it

---

## EMERGENCY PROTOCOLS

### P0 Incident (Service Down)

```
1. On-call receives alert (2 min)
2. Assess scope (3 min)
3. Mitigate (5 min)
4. Communicate in #incidents (5 min)
5. Post user update on status page (10 min)
6. Fix root cause (varies)
7. Post-mortem within 24h
```

### Critical Bug in Production

```
1. Reproduce locally (15 min)
2. Assess blast radius (5 min)
3. Deploy hotfix (30 min)
4. Verify fix (10 min)
5. Communicate to affected users (1h)
```

---

## SUCCESS CRITERIA BY PHASE

### Private Beta (Weeks 1-4)

- [ ] 25 users invited
- [ ] 50% activation rate
- [ ] 30% D7 retention
- [ ] 0 critical bugs
- [ ] 5+ testimonials

### Public Beta (Weeks 5-8)

- [ ] 200 active users
- [ ] 40% activation rate
- [ ] 25% D30 retention
- [ ] < 15% false positive rate
- [ ] 10+ testimonials

### Product Hunt (Week 9)

- [ ] Top 5 Product of the Day
- [ ] 500+ upvotes
- [ ] 200+ new installs
- [ ] 4.5+ star rating

### Post-Launch (Months 2-3)

- [ ] 1,000+ active users
- [ ] 5% free-to-paid conversion
- [ ] $10K MRR
- [ ] 20%+ D30 retention
- [ ] YC application submitted

---

## THE MOST IMPORTANT QUESTIONS

Ask these every week:

1. Would users keep Rakshex installed?
2. Does this reduce anxiety?
3. Does this save real money?
4. Would users recommend this?
5. Is onboarding magical?
6. Is the value obvious in 60 seconds?
7. Is trust increasing every week?
8. Are we shipping something this week?
9. Are we talking to users this week?
10. Are we measuring everything?

---

_Operating system maintained by founder._
_Followed religiously. Modified rarely._
