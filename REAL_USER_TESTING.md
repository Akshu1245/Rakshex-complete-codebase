# Rakshex Real User Battle Testing

> How we validate Rakshex with actual developers before public launch.
> Date: 2026-05-17

---

## 1. BETA COHORT STRUCTURE

### Cohort 1: Friendly Developers (Week 1-2)

|                  |                                 |
| ---------------- | ------------------------------- |
| **Size**         | 5 developers                    |
| **Profile**      | Known personally, forgiving     |
| **Goal**         | Find broken onboarding, crashes |
| **Compensation** | Free Pro for life               |
| **Feedback**     | Daily standup, Slack channel    |

### Cohort 2: Target ICP (Week 3-4)

|                  |                                  |
| ---------------- | -------------------------------- |
| **Size**         | 15 developers                    |
| **Profile**      | AI app builders, API-first teams |
| **Goal**         | Validate value proposition       |
| **Compensation** | Free Pro for 6 months            |
| **Feedback**     | Weekly survey, 1:1 interviews    |

### Cohort 3: Cold Outreach (Week 5-6)

|                  |                                       |
| ---------------- | ------------------------------------- |
| **Size**         | 30 developers                         |
| **Profile**      | Found via Reddit, HN, Twitter         |
| **Goal**         | Validate distribution + onboarding    |
| **Compensation** | Free Pro for 3 months                 |
| **Feedback**     | In-product analytics, support tickets |

---

## 2. ONBOARDING VALIDATION CHECKLIST

For each beta user, track:

```
□ Installs extension (telemetry: extension_activated)
□ Opens sidebar within 5 min (telemetry: sidebar_opened)
□ Sees welcome view
□ Clicks "Create Account" or connects API key
□ Successfully authenticates
□ Imports first collection within 24h
□ Runs first scan within 48h
□ Views findings
□ Marks at least 1 finding as valid/invalid
□ Returns within 7 days
□ Returns within 30 days
```

**Success criteria:** 50% complete the full funnel.

---

## 3. FEEDBACK COLLECTION SYSTEM

### In-Product Feedback

```typescript
// rakshex-vscode/src/feedback.ts
export async function showFeedbackPrompt(context: vscode.ExtensionContext) {
  // Show after 3rd successful scan
  const scanCount = context.globalState.get<number>("rakshex.scanCount") ?? 0;
  if (scanCount === 3) {
    const rating = await vscode.window.showQuickPick(
      ["⭐", "⭐⭐", "⭐⭐⭐", "⭐⭐⭐⭐", "⭐⭐⭐⭐⭐"],
      { title: "How is Rakshex working for you?" },
    );
    if (rating) {
      telemetry.track("nps_rating", { stars: rating.length });
      if (rating.length <= 2) {
        const reason = await vscode.window.showInputBox({
          prompt: "What's the biggest issue you're facing?",
        });
        telemetry.track("negative_feedback", { reason });
      }
    }
  }
}
```

### Uninstall Survey

```
When user uninstalls the extension:
1. Open browser to "https://rakshex.in/uninstall-survey?user={hash}"
2. Ask: "Why are you leaving?"
   - Didn't find value
   - Too confusing
   - Found bugs
   - Missing features
   - Too expensive
   - Other
3. Ask: "What would make you come back?"
4. Offer: "Email us directly: support@rakshex.in"
```

### Rage Click Detection

```typescript
// Track rapid successive clicks on the same element
let lastClickTarget = "";
let lastClickTime = 0;
let clickCount = 0;

function detectRageClick(target: string) {
  const now = Date.now();
  if (target === lastClickTarget && now - lastClickTime < 1000) {
    clickCount++;
    if (clickCount >= 3) {
      telemetry.track("rage_click", { target });
      // Show: "Having trouble? Get help →"
    }
  } else {
    clickCount = 1;
  }
  lastClickTarget = target;
  lastClickTime = now;
}
```

---

## 4. SESSION DIAGNOSTICS

### Extension Health Report

```
Rakshex Health Report (auto-generated on error)

Version: 0.1.0
VS Code: 1.85.0
OS: macOS 14.2
Node: 20.10.0

Network:
  API reachable: YES
  Latency: 145ms
  Last error: 401 on /trpc/scanning.start

State:
  Authenticated: YES
  Collections: 3
  Total scans: 12
  Findings: 47

Performance:
  Extension startup: 1.2s
  Memory usage: 87MB
  Last scan duration: 8.3s
```

---

## 5. ISSUE REPRODUCTION WORKFLOW

```
User reports issue
    ↓
Collect health report + logs
    ↓
Attempt reproduction in test environment
    ↓
If reproducible:
  → Create GitHub issue with label "confirmed"
  → Assign to engineer
  → Target fix within 48h for SEV-2
    ↓
If not reproducible:
  → Request more details (specific collection, steps)
  → Offer screen share debugging
    ↓
Fix deployed → Notify user → Request verification
    ↓
Close issue when user confirms
```

---

## 6. BETA EXIT CRITERIA

| Metric                                 | Minimum | Target |
| -------------------------------------- | ------- | ------ |
| Activation rate (install → first scan) | 40%     | 60%    |
| 7-day retention                        | 25%     | 40%    |
| NPS score                              | 30      | 50     |
| False positive rate                    | < 25%   | < 15%  |
| Extension crash rate                   | < 2%    | < 0.5% |
| Support tickets per user               | < 1     | < 0.5  |
| "Would recommend"                      | 60%     | 80%    |

**Beta is successful when ALL minimums are met.**

---

_Testing plan maintained by product + engineering._
_Updated weekly with cohort results._
