# DevPulse Onboarding Optimization

> Data-driven improvements to first-60-second experience.
> Date: 2026-05-17

---

## CURRENT FUNNEL

```
Install extension    →    Open sidebar    →    Connect account    →    Import collection    →    Run scan    →    See findings
   100%                     70%                  45%                    30%                    20%              15%
```

**Biggest drop-off:** Connect account (45% → 30%). Users don't have API keys yet.

---

## OPTIMIZATIONS IMPLEMENTED

### 1. Welcome View Redesign

- **Before:** Plain text, single connect button, no value preview
- **After:**
  - Animated logo with gradient glow
  - Trust badges (AES-256, SOC2, Real-time)
  - Dopamine counters ($ saved, tokens tracked, risks blocked)
  - Feature cards with icons and descriptions
  - Onboarding progress tracker (4 steps)
  - Quick actions with keyboard shortcuts
  - "Create Free Account" as primary CTA

### 2. First-Run Demo Mode

- **Scenario 1:** Instant Security Scan — shows 6 findings in 2 seconds
- **Scenario 2:** Hidden Cost Revelation — shows $1,247 in hidden costs
- **Scenario 3:** AgentGuard Kill Switch — shows rogue agent stopped
- Works offline, no API key needed

### 3. Reduced Friction

- **Before:** Must create account → generate API key → paste → connect
- **After:**
  - "Create Free Account" button opens signup in browser
  - API key field accepts paste with validation
  - Enter key submits form
  - Clear error messages with next steps

---

## TARGET FUNNEL (Post-Optimization)

```
Install extension    →    Open sidebar    →    Connect/Demo    →    First value    →    Return next day
   100%                     80%                  65%                    55%              30%
```

---

## METRICS TO TRACK

| Metric                | Baseline | Target | Tracking  |
| --------------------- | -------- | ------ | --------- |
| Sidebar open rate     | 70%      | 80%    | Telemetry |
| Account connect rate  | 45%      | 60%    | Telemetry |
| First scan within 1hr | 30%      | 50%    | Telemetry |
| Demo mode usage       | 0%       | 20%    | Telemetry |
| Day-1 retention       | ?        | 40%    | PostHog   |
| Day-7 retention       | ?        | 25%    | PostHog   |

---

## A/B TEST IDEAS

1. **CTA copy:** "Connect" vs "Get Started" vs "Secure My Code"
2. **Demo placement:** Top of sidebar vs after connect
3. **Trust badges:** With vs without
4. **Progress tracker:** 4 steps vs 3 steps vs none
5. **Feature order:** Security first vs Cost first

---

_Optimization plan reviewed weekly with telemetry data._
