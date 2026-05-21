# Rakshex Habit Loop Design

> Making Rakshex as habitual as checking email.
> Date: 2026-05-17

---

## THE HOOK MODEL (Nir Eyal)

### Trigger → Action → Reward → Investment

---

## 1. TRIGGERS

### External Triggers

| Trigger                 | Channel              | Frequency         | User Action                 |
| ----------------------- | -------------------- | ----------------- | --------------------------- |
| Weekly summary email    | Email                | Weekly            | Open email → click scan     |
| Cost spike alert        | In-app toast         | Real-time         | Open sidebar → view details |
| AgentGuard alert        | In-app toast + email | Real-time         | View alert → check agent    |
| New vulnerability found | Badge + toast        | After scan        | Click finding → review      |
| Streak reminder         | In-app message       | Daily (if broken) | Run scan → continue streak  |
| Team activity           | In-app message       | Weekly            | "Your team found X issues"  |

### Internal Triggers

| Emotion                   | Trigger                      | Rakshex Action         |
| ------------------------- | ---------------------------- | ---------------------- |
| Anxiety about security    | "Did I leak a key?"          | Quick scan reassurance |
| Fear about API costs      | "Why is my bill so high?"    | Check cost dashboard   |
| Worry about AI agents     | "Is my agent still running?" | View AgentGuard status |
| Pride in security posture | "I want to show I'm secure"  | Share weekly summary   |

**Goal:** Rakshex becomes the default response to API security anxiety.

---

## 2. ACTIONS

### Make Scanning Effortless

**Before:**

```
1. Open Rakshex sidebar
2. Click "Import Collection"
3. Navigate file picker
4. Select file
5. Click "Run Scan"
6. Wait for results
```

**After:**

```
1. Click "Quick Scan" in status bar
2. Results appear in 3 seconds
```

**Actions to reduce friction:**

- [ ] Default keyboard shortcut: `Ctrl+Shift+D` (scan current file)
- [ ] Auto-scan on save (optional, off by default)
- [ ] One-click re-scan last collection
- [ ] Scan from status bar (no sidebar needed)

---

## 3. VARIABLE REWARDS

### The 3 Types of Rewards

**Tribe (Social)**

- "Your team is #1 on the security leaderboard this week"
- "3 team members ran scans today"
- Sharing badges on Twitter

**Hunt (Material)**

- "You saved $47 this week"
- "Found 2 exposed secrets"
- "AgentGuard blocked 1 incident"
- "Security streak: 5 days"

**Self (Personal)**

- "You're in the top 10% of security-conscious developers"
- "You've scanned 50 times — power user!"
- "Your API security score: 94/100"

### Variable Reward Schedule

Not every scan finds something. But every scan should feel rewarding:

| Outcome              | Reward                                                |
| -------------------- | ----------------------------------------------------- |
| Found critical issue | 🚨 "We found a critical issue!" + detailed fix        |
| Found high issue     | 🔥 "Found 2 high-severity issues"                     |
| Found medium/low     | ✨ "All clear on critical/high. 3 minor items noted." |
| No issues            | 🎉 "No issues found! Your API is secure."             |
| Cost spike detected  | 💰 "We spotted unusual spending"                      |
| Agent stopped        | 🛑 "We stopped a rogue agent"                         |
| Streak continued     | 🔥 "5-day scanning streak!"                           |

---

## 4. INVESTMENT

### Make Users Invest in Rakshex

**Data Investment:**

- Imported collections (hard to recreate)
- Historical scan data (valuable over time)
- False positive feedback (improves their experience)

**Social Investment:**

- Team invites sent
- Shared reports
- Public testimonials

**Customization Investment:**

- Configured AgentGuard thresholds
- Custom ignore rules
- Dashboard preferences

**Identity Investment:**

- "Security-conscious developer" self-image
- Streak badges and achievements
- Public leaderboard position

---

## HABIT LOOP IMPLEMENTATION

### Morning Habit Loop

```
Trigger: Open VS Code (9 AM)
  → Action: See Rakshex status bar badge
    → Reward: "No new issues" or "3 findings since yesterday"
      → Investment: Click to review, mark status, feel in control
```

### Pre-Deploy Habit Loop

```
Trigger: About to deploy (Git push)
  → Action: Run Rakshex scan (Ctrl+Shift+D)
    → Reward: "All clear — safe to deploy" or "Fix 1 issue first"
      → Investment: Fix issue, deploy confidently
```

### Weekly Review Habit Loop

```
Trigger: Monday morning email
  → Action: Open weekly summary
    → Reward: "You saved $X this week" + team stats
      → Investment: Share with team, set goals for next week
```

---

## HABIT SCORING

| Habit                 | Frequency | Difficulty | Reward Strength | Habit Score |
| --------------------- | --------- | ---------- | --------------- | ----------- |
| Daily status check    | Daily     | Easy       | Medium          | \_\_\_      |
| Pre-deploy scan       | 2-3×/week | Easy       | High            | \_\_\_      |
| Weekly summary review | Weekly    | Easy       | Medium          | \_\_\_      |
| Team sharing          | Weekly    | Medium     | High            | \_\_\_      |
| Cost dashboard check  | Weekly    | Easy       | Low             | \_\_\_      |

**Habit Score = Frequency × (1/Difficulty) × Reward Strength**

Target: At least 2 habits with score > 5

---

## ANTI-HABITS TO AVOID

| Anti-Pattern           | Why It Breaks Habits   | Fix                   |
| ---------------------- | ---------------------- | --------------------- |
| Too many notifications | Becomes noise, ignored | Max 1 toast per day   |
| Slow scans (> 10s)     | Breaks flow state      | Background scanning   |
| No findings ever       | Boring, unrewarding    | Celebrate "all clear" |
| Complex UI             | Too much effort        | One-click actions     |
| Required reading       | Cognitive load         | Visual, not textual   |

---

_Design maintained by product + growth team._
_Tested with 5 users before implementation._
