# DevPulse Engagement Score System

> Quantifying user health for proactive retention.
> Date: 2026-05-17

---

## SCORING MODEL

### Events & Points

```typescript
interface EngagementRule {
  event: string;
  points: number;
  maxPerDay: number;
  maxPerWeek: number;
  category: "core" | "discovery" | "social" | "growth";
}

const RULES: EngagementRule[] = [
  // Core usage (50% of score)
  { event: "scan_run", points: 10, maxPerDay: 30, maxPerWeek: 50, category: "core" },
  { event: "finding_viewed", points: 5, maxPerDay: 20, maxPerWeek: 25, category: "core" },
  { event: "finding_status_changed", points: 5, maxPerDay: 15, maxPerWeek: 25, category: "core" },
  { event: "dashboard_opened", points: 3, maxPerDay: 10, maxPerWeek: 15, category: "core" },

  // Discovery (20% of score)
  { event: "feature_tried", points: 8, maxPerDay: 8, maxPerWeek: 16, category: "discovery" },
  { event: "settings_changed", points: 5, maxPerDay: 5, maxPerWeek: 10, category: "discovery" },
  { event: "demo_completed", points: 15, maxPerDay: 15, maxPerWeek: 15, category: "discovery" },

  // Social (15% of score)
  { event: "report_shared", points: 15, maxPerDay: 15, maxPerWeek: 15, category: "social" },
  { event: "team_invited", points: 20, maxPerDay: 20, maxPerWeek: 20, category: "social" },
  { event: "feedback_given", points: 10, maxPerDay: 10, maxPerWeek: 10, category: "social" },

  // Growth (15% of score)
  { event: "pro_trial_started", points: 25, maxPerDay: 25, maxPerWeek: 25, category: "growth" },
  { event: "collection_imported", points: 10, maxPerDay: 10, maxPerWeek: 20, category: "growth" },
  { event: "review_left", points: 30, maxPerDay: 30, maxPerWeek: 30, category: "growth" },
];
```

### Decay

| Inactivity | Score Decay              |
| ---------- | ------------------------ |
| 1 day      | -5%                      |
| 3 days     | -15%                     |
| 7 days     | -40%                     |
| 14 days    | -70%                     |
| 30 days    | -90% (effectively reset) |

### Score Calculation

```
Raw Score = Σ(event_points) for last 30 days
Weighted Score = (Core × 0.5) + (Discovery × 0.2) + (Social × 0.15) + (Growth × 0.15)
Final Score = Weighted Score × Decay Factor
```

---

## USER SEGMENTS BY SCORE

| Segment    | Score Range | % of Base | Risk Level | Action                    |
| ---------- | ----------- | --------- | ---------- | ------------------------- |
| 🔴 At Risk | 0-20        | ~30%      | Very High  | Immediate outreach        |
| 🟡 Casual  | 21-50       | ~40%      | Medium     | Re-engagement + education |
| 🟢 Engaged | 51-80       | ~20%      | Low        | Upsell + advocacy         |
| 🔵 Power   | 81-100      | ~10%      | Very Low   | Champion program          |

---

## AUTOMATED ACTIONS

### At Risk (Score < 20)

**Day 3 of inactivity:**

```
📧 Email: "We miss you — here's what you missed"
📊 Include: Last finding, money saved, security score
🎯 CTA: "Run a quick scan"
```

**Day 7 of inactivity:**

```
📧 Email: "Your APIs need a checkup"
👤 Personal outreach from founder (if < 100 users)
🎁 Offer: Extended Pro trial
```

**Day 14 of inactivity:**

```
📧 Email: "What would make DevPulse a 10?"
📋 1-question survey
🎁 Incentive: $50 Amazon gift card for call
```

**Day 30 of inactivity:**

```
📧 Final email: "We're here if you need us"
📎 Unsubscribe option
🚪 Graceful exit
```

### Casual (Score 21-50)

**Weekly:**

```
📧 Weekly summary (if not already engaged)
💡 Tip: "Did you know you can scan on save?"
```

**Bi-weekly:**

```
📧 Feature spotlight: "Try AgentGuard setup"
🎥 Short video walkthrough
```

### Engaged (Score 51-80)

**Monthly:**

```
📧 "You're a power user — here's what's next"
🚀 Pro features preview
💰 "You've saved $X with DevPulse"
```

**Trigger:**

```
🎉 In-app: "You've scanned 50 times!"
🏆 Badge unlock
📣 "Share your DevPulse story"
```

### Power (Score 81-100)

**Immediate:**

```
🏅 Champion program invite
🎁 Swag offer
📞 "Let's chat — your feedback shapes our roadmap"
```

**Monthly:**

```
📧 Exclusive: Product roadmap preview
👥 Private community access
🎤 Speaking opportunity at events
```

---

## IMPLEMENTATION

### Tracking Events

```typescript
// In extension code
function trackEvent(event: string, metadata?: object) {
  telemetry.track({
    user_id: getUserId(),
    event,
    metadata,
    timestamp: Date.now(),
  });
}

// Usage
trackEvent("scan_run", { collection_id, finding_count });
trackEvent("finding_viewed", { finding_id, severity });
```

### Score Calculation (Daily Cron)

```typescript
// server/cron/calculateEngagement.ts
async function calculateEngagementScores() {
  const users = await db.users.findActive();
  for (const user of users) {
    const events = await db.events.findLast30Days(user.id);
    const score = calculateScore(events);
    await db.users.updateEngagementScore(user.id, score);
    await triggerActions(user.id, score);
  }
}
```

### Dashboard

| Metric               | Value  |
| -------------------- | ------ |
| Avg engagement score | \_\_\_ |
| At-risk users        | \_\_\_ |
| Power users          | \_\_\_ |
| Score trend (weekly) | ▲ ▼ —  |

---

_System maintained by growth + data team._
_Scores calculated daily. Actions triggered automatically._
