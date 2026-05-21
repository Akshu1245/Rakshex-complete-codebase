# Rakshex Execution Checklist

> The master checklist for operating like a real startup.
> Date: 2026-05-17

---

## DAILY

### Morning (9:00 AM)

- [ ] Check metrics dashboard (installs, active users, errors)
- [ ] Review overnight support tickets
- [ ] Respond to any critical user issues
- [ ] Post daily standup in Slack

### Afternoon (3:00 PM)

- [ ] Check activation funnel for new users
- [ ] Review any new findings flagged as false positive
- [ ] Respond to marketplace reviews
- [ ] Engage with social media mentions

### Evening (6:00 PM)

- [ ] Fill out DAILY_BETA_REPORT.md
- [ ] Review day's progress against priorities
- [ ] Set tomorrow's top 3 tasks
- [ ] Check server health / uptime

---

## WEEKLY

### Monday (9:00 AM)

- [ ] Weekly metrics review meeting
- [ ] Review cohort retention from last week
- [ ] Plan week's top 3 priorities
- [ ] Send weekly protection summary emails to users

### Tuesday

- [ ] Publish engineering content (blog, Twitter, LinkedIn)
- [ ] Outreach to 5 potential beta users
- [ ] Review false positive rates and adjust rules

### Wednesday

- [ ] User standup (review top 5 pains)
- [ ] Check activation funnel drop-offs
- [ ] Reach out to 3 churned users for exit interviews

### Thursday

- [ ] Product Hunt prep (if launching soon)
- [ ] Investor outreach (if fundraising)
- [ ] Community engagement (Discord, Reddit)

### Friday

- [ ] Ship review — what went live this week?
- [ ] Update CHANGELOG.md
- [ ] Celebrate wins (team or solo)
- [ ] Plan weekend coverage (if needed)

---

## MONTHLY

### First Monday

- [ ] Monthly investor update (INVESTOR_UPDATE_TEMPLATE.md)
- [ ] Cohort retention deep dive
- [ ] Revenue and unit economics review
- [ ] Set next month's OKRs

### Mid-Month

- [ ] Security audit (dependency check, secret scan)
- [ ] Performance review (scan times, memory, errors)
- [ ] User interview (minimum 3 per month)

### End of Month

- [ ] Collect testimonials
- [ ] Update benchmark reports
- [ ] Review competitive landscape
- [ ] Plan next month's content calendar

---

## QUARTERLY

- [ ] Full infrastructure review (costs, scaling needs)
- [ ] Security penetration test
- [ ] Backup and disaster recovery drill
- [ ] Team planning (hiring, roles)
- [ ] Strategic review (market, competition, product direction)
- [ ] Update investor docs and pitch deck

---

## LAUNCH PHASE (When Active)

### T-Minus 2 Weeks

- [ ] Finalize all Product Hunt assets
- [ ] Prepare social media content calendar
- [ ] Email beta users for launch support
- [ ] Test all onboarding flows end-to-end
- [ ] Prepare rollback plan

### T-Minus 1 Week

- [ ] Daily metrics monitoring
- [ ] Respond to all pre-launch feedback
- [ ] Finalize reply templates for launch day
- [ ] Coordinate with supporters
- [ ] Set up real-time analytics dashboard

### Launch Day

- [ ] Post goes live at 00:01 PST
- [ ] Monitor all channels continuously
- [ ] Respond to comments within 15 minutes
- [ ] Track metrics hourly
- [ ] Fix critical bugs within 1 hour
- [ ] Celebrate at end of day

### Post-Launch Week

- [ ] Onboard new users within 24 hours
- [ ] Collect and respond to all feedback
- [ ] Fix bugs within 24 hours
- [ ] Update all marketing materials
- [ ] Write launch retrospective

---

## METRIC REVIEW RHYTHM

| Metric     | Owner       | Frequency | Tool                |
| ---------- | ----------- | --------- | ------------------- |
| Installs   | Growth      | Daily     | VS Code Marketplace |
| Activation | Product     | Daily     | PostHog             |
| Retention  | Product     | Weekly    | PostHog             |
| Scans      | Engineering | Daily     | Telemetry DB        |
| Findings   | Engineering | Weekly    | DB + feedback       |
| MRR        | Founder     | Weekly    | Stripe              |
| Uptime     | Engineering | Daily     | UptimeRobot         |
| Errors     | Engineering | Daily     | Sentry              |
| NPS        | Growth      | Weekly    | In-app survey       |
| Support    | Growth      | Daily     | Email/Discord       |
| Reviews    | Growth      | Daily     | Marketplace         |
| Content    | DevRel      | Weekly    | Analytics           |

---

## SUCCESS CRITERIA

### Private Beta (Weeks 1-4)

- [ ] 25 users invited
- [ ] 50% activation rate
- [ ] 30% D7 retention
- [ ] 0 critical bugs
- [ ] 5+ testimonials collected

### Public Beta (Weeks 5-8)

- [ ] 200 active users
- [ ] 40% activation rate
- [ ] 25% D30 retention
- [ ] < 15% false positive rate
- [ ] 10+ testimonials collected

### Product Hunt Launch (Week 9)

- [ ] Top 5 Product of the Day
- [ ] 500+ upvotes
- [ ] 200+ new installs
- [ ] 4.5+ star rating
- [ ] 50+ comments

### Post-Launch (Months 2-3)

- [ ] 1,000+ active users
- [ ] 5% free-to-paid conversion
- [ ] $10K MRR
- [ ] 20%+ D30 retention
- [ ] YC application submitted

---

_Checklist maintained by founder._
_Reviewed daily during active phases._
