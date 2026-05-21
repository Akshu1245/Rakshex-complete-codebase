# Rakshex Churn Prevention Playbook

> Stop users from leaving before they decide to.
> Date: 2026-05-17

---

## CHURN EARLY WARNING SYSTEM

### Risk Signals

| Signal                             | Weight | Threshold   |
| ---------------------------------- | ------ | ----------- |
| No scan in 7 days                  | 30     | Any         |
| No login in 3 days                 | 25     | Any         |
| Skipped weekly digest (not opened) | 15     | 2x in a row |
| False positive reported            | 15     | Any         |
| Support ticket unresolved > 48h    | 10     | Any         |
| Team member removed                | 5      | Any         |

### Risk Score

```
Risk Score = Σ(signal_weight × recency_factor)

recency_factor:
  Today:     1.0
  Yesterday: 0.8
  2-3 days:  0.5
  4-7 days:  0.3
  > 7 days:  0.1
```

| Score  | Action                            |
| ------ | --------------------------------- |
| 0-20   | Healthy — no action               |
| 21-40  | Watch — add to weekly review      |
| 41-60  | At risk — automated re-engagement |
| 61-80  | High risk — personal outreach     |
| 81-100 | Critical — founder call today     |

---

## INTERVENTION PLAYBOOKS

### Playbook A: "No Scan in 7 Days"

**Trigger:** User hasn't run a scan in 7 days.

**Day 7 — Automated Email:**

```
Subject: Your APIs haven't been checked this week

Hi {{name}},

We noticed you haven't scanned your collections recently.

Last scan: {{last_scan_date}}
Collections: {{collection_count}}

[Run Quick Scan] — takes 10 seconds

Or reply and tell us what's blocking you.
```

**Day 10 — Personal Outreach (if < 100 users):**

```
Hi {{name}},

Akshay here — founder of Rakshex.

I saw you haven't scanned recently. Is something broken?
Or is Rakshex not solving the problem you hoped it would?

I'd love to fix whatever's in your way.

[Schedule 5-min call]
```

**Day 14 — Value Reinforcement:**

```
Subject: What would make Rakshex a 10/10?

One question: What would need to change for you to
use Rakshex every day?

[Reply here — I read every response]
```

**Day 21 — Graceful Check:**

```
Subject: Should we pause your account?

Hi {{name}},

We haven't seen activity in 3 weeks.

Would you like us to:
1. Pause notifications (keep data)
2. Export your findings first
3. Help you get value again

[Choose an option]
```

---

### Playbook B: "Onboarding Drop-off"

**Trigger:** User installed but never connected API key or imported collection.

**Hour 1 — Welcome:**

```
Subject: Welcome — here's your first 2-minute setup

Step 1: Connect your API key [Link]
Step 2: Import a collection [Link]
Step 3: Run your first scan [Link]

Need help? Reply to this email.
```

**Hour 24 — Nudge:**

```
Subject: Your APIs are waiting to be secured

Hi {{name}},

Did the setup feel confusing? That's our fault, not yours.

Common fixes:
- Can't find API key? [Screenshot guide]
- No collections yet? [Sample collection]
- Something else? [Reply here]
```

**Day 3 — Direct Offer:**

```
Subject: I'll set it up for you

Hi {{name}},

You installed Rakshex but didn't finish setup.

I'll personally walk you through it — 5 minutes max.

[Book a time]
```

---

### Playbook C: "False Positive Frustration"

**Trigger:** User marked 2+ findings as "false positive" or reported inaccuracy.

**Immediate — In-app:**

```
"Sorry we got that wrong. We're learning.

This finding has been flagged for review.
Our team will improve this detection rule.

[Dismiss] [Report another]"
```

**Day 1 — Follow-up:**

```
Subject: We're fixing what we got wrong

Hi {{name}},

You flagged {{count}} findings as false positives.

We're reviewing them now. Here's what we're doing:
1. Adjusting the detection rule
2. Recalibrating confidence scores
3. Re-scanning your collections

You'll see improvements within 48 hours.

[See updated findings]
```

**Day 3 — Calibration:**

```
"We've adjusted our detection. Your false positive rate
should drop by ~30%. Let us know if it's better."
```

---

### Playbook D: "Team Member Left"

**Trigger:** Team admin removed a member or cancelled.

**Day 0 — Understanding:**

```
Subject: What changed?

Hi {{name}},

We noticed a change in your team setup.

Was it:
- A team member leaving?
- Budget constraints?
- Rakshex not meeting needs?

We're here to help either way.

[Quick survey — 1 question]
```

**Day 3 — Retention Offer:**

```
"If budget is the concern, we can offer:
- 50% off for 3 months
- Extended trial
- Free plan with limited features

What works for you?"
```

---

## WIN-BACK CAMPAIGNS

### Campaign 1: "We Fixed It"

**Audience:** Churned users who left due to specific issue.
**Timing:** 30 days after fix deployed.

```
Subject: We fixed {{issue}} — want to try again?

Hi {{name}},

You left Rakshex because {{reason}}.

We fixed it. Here's how:
{{explanation}}

[Re-install — your data is still here]
```

### Campaign 2: "Something New"

**Audience:** Churned users > 60 days.
**Timing:** After major feature launch.

```
Subject: Rakshex has changed since you left

Hi {{name}},

Since you left, we've shipped:
{{feature_list}}

The thing you wanted most: {{most_requested_feature}}

[Try it again]
```

### Campaign 3: "Founder's Ask"

**Audience:** High-value churned users.
**Timing:** Quarterly.

```
Subject: One honest question

Hi {{name}},

I'm Akshay, founder of Rakshex.

You were one of our early users, and we let you down.

What would it take for you to give us another chance?

I read every reply.
```

---

## CHURN PREVENTION METRICS

| Metric                     | Target             | Current |
| -------------------------- | ------------------ | ------- |
| At-risk users identified   | 100% within 3 days | \_\_\_  |
| Intervention response rate | > 30%              | \_\_\_  |
| Win-back success rate      | > 10%              | \_\_\_  |
| Churn rate                 | < 5%/month         | \_\_\_  |
| Time to intervention       | < 24h              | \_\_\_  |

---

_Playbook maintained by growth + customer success team._
_Interventions triggered automatically via engagement score._
