# Rakshex User Behavior Patterns

> Understanding how developers actually use Rakshex.
> Date: 2026-05-17

---

## BEHAVIOR SEGMENTS

### Segment A: "Security-First"

| Trait            | Pattern                                    |
| ---------------- | ------------------------------------------ |
| Who              | Senior engineers, security-conscious teams |
| First action     | Imports collection, runs full scan         |
| Typical session  | 10-15 min, reviews all findings            |
| Return frequency | Daily or every 2 days                      |
| Feature love     | Confidence scores, detailed evidence       |
| Feature ignore   | Cost dashboard                             |
| Wow moment       | Finding a real exposed secret              |
| Pain point       | False positives on complex auth            |
| Retention driver | Trust in scan quality                      |
| Churn risk       | If FP rate > 20%                           |

**How to serve them:**

- Prioritize scan accuracy above all
- Add advanced filtering (by CWE, OWASP category)
- Enable CI/CD integration
- Provide detailed remediation steps

---

### Segment B: "Cost-Optimizer"

| Trait            | Pattern                                                  |
| ---------------- | -------------------------------------------------------- |
| Who              | Indie hackers, bootstrapped founders, API-heavy startups |
| First action     | Connects account, checks cost dashboard                  |
| Typical session  | 3-5 min, checks weekly summary                           |
| Return frequency | Weekly (when summary arrives)                            |
| Feature love     | Cost breakdown, AgentGuard                               |
| Feature ignore   | Detailed security findings                               |
| Wow moment       | Discovering hidden reasoning costs                       |
| Pain point       | Not enough cost history                                  |
| Retention driver | Saving money every week                                  |
| Churn risk       | If no cost anomalies for 2 weeks                         |

**How to serve them:**

- Make cost dashboard the default landing page
- Add cost forecasting
- Alert on unusual spend patterns
- Show "money saved this month" prominently

---

### Segment C: "AI Builder"

| Trait            | Pattern                                |
| ---------------- | -------------------------------------- |
| Who              | Engineers building AI agents, LLM apps |
| First action     | Runs demo scenario, then imports       |
| Typical session  | 5-10 min, tests AgentGuard             |
| Return frequency | When deploying new agents              |
| Feature love     | AgentGuard, kill switch                |
| Feature ignore   | Traditional API security checks        |
| Wow moment       | AgentGuard stopping a rogue loop       |
| Pain point       | Not sure how to configure thresholds   |
| Retention driver | Preventing embarrassing incidents      |
| Churn risk       | If no agents deployed recently         |

**How to serve them:**

- AgentGuard wizard for first-time setup
- Pre-configured templates for common frameworks
- Agent-specific scan rules
- Incident replay feature

---

### Segment D: "Curious Explorer"

| Trait            | Pattern                               |
| ---------------- | ------------------------------------- |
| Who              | Students, learners, early-career devs |
| First action     | Plays with demo, explores UI          |
| Typical session  | 2-3 min, clicks around                |
| Return frequency | Sporadic                              |
| Feature love     | Demo mode, visual design              |
| Feature ignore   | Everything else                       |
| Wow moment       | Seeing scan results on demo data      |
| Pain point       | No real projects to scan              |
| Retention driver | Learning and curiosity                |
| Churn risk       | High — no real use case               |

**How to serve them:**

- Provide sample projects to scan
- Educational content on API security
- "Learn by scanning" tutorials
- Free forever tier with limited scans

---

## BEHAVIORAL FUNNEL PATTERNS

### Pattern 1: "Immediate Value" (Best)

```
Install → Connect → Scan → Find issue → Fix → Return next day
→ High retention, high referral
→ 20% of users
```

### Pattern 2: "Delayed Value" (Good)

```
Install → Connect → Scan → No issues → Check cost → Discover hidden cost
→ Medium retention, medium referral
→ 35% of users
```

### Pattern 3: "Confused Drop-off" (Bad)

```
Install → Connect → ??? → Close sidebar → Never return
→ Churn in 48 hours
→ 25% of users
```

### Pattern 4: "Tool Collector" (Neutral)

```
Install → Play with demo → Ignore for weeks → Uninstall
→ Vanity install, no real usage
→ 20% of users
```

---

## USAGE HEATMAP (Hypothesis)

| Time  | Monday | Tuesday | Wednesday | Thursday | Friday | Saturday | Sunday |
| ----- | ------ | ------- | --------- | -------- | ------ | -------- | ------ |
| 9 AM  | 🟡     | 🟡      | 🟡        | 🟡       | 🟡     | 🟢       | 🟢     |
| 12 PM | 🔴     | 🔴      | 🔴        | 🔴       | 🔴     | 🟡       | 🟡     |
| 3 PM  | 🔴     | 🔴      | 🔴        | 🔴       | 🟡     | 🟢       | 🟢     |
| 6 PM  | 🟡     | 🟡      | 🟡        | 🟡       | 🟢     | 🟢       | 🟢     |
| 9 PM  | 🟢     | 🟢      | 🟢        | 🟢       | 🟢     | 🟢       | 🟢     |

Legend: 🔴 High usage | 🟡 Medium | 🟢 Low

**Hypothesis:** Peak usage is weekday lunch hours (security checks before deploys).

**Validate with:** Telemetry heatmap in PostHog.

---

## BEHAVIORAL TRIGGERS

| Trigger                 | Action                | Expected Response   | Actual Response |
| ----------------------- | --------------------- | ------------------- | --------------- |
| New collection imported | Auto-suggest scan     | 60% scan rate       | \_\_%           |
| Critical finding found  | Show toast + badge    | 80% click rate      | \_\_%           |
| Weekly summary email    | Open email            | 40% open rate       | \_\_%           |
| AgentGuard alert        | Notification          | 70% check dashboard | \_\_%           |
| Cost spike detected     | Alert banner          | 50% investigate     | \_\_%           |
| Streak broken           | "You're back" message | 30% return          | \_\_%           |

---

## PREDICTIVE CHURN SIGNALS

| Signal                    | Churn Risk | Action                |
| ------------------------- | ---------- | --------------------- |
| No scan in 7 days         | Medium     | Re-engagement email   |
| No sidebar open in 3 days | High       | In-app toast          |
| Marked 3+ findings as FP  | High       | Personal outreach     |
| Never imported collection | Very High  | Onboarding call       |
| Uninstalled once before   | Very High  | Special win-back      |
| Only used demo mode       | High       | Sample project prompt |

---

## SEGMENT TARGETING

| Goal               | Target Segment | Feature to Push     |
| ------------------ | -------------- | ------------------- |
| Increase retention | Cost-Optimizer | Weekly cost summary |
| Increase scans     | Security-First | CI/CD integration   |
| Increase referrals | AI Builder     | Team plan invite    |
| Reduce churn       | All            | Proactive alerts    |
| Increase MRR       | Security-First | Enterprise features |

---

_Patterns maintained by growth + data team._
_Updated weekly with telemetry analysis._
