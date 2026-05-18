# DevPulse — Uninstall Reason Collection

## How to capture uninstall reasons

VS Code doesn't provide a native uninstall hook (`deactivate()` runs on disable, not uninstall).

**Current mechanism:** `uninstallSurvey.ts` in the codebase. Verify it's wired correctly.

## Survey copy (shown on deactivation if survey not yet completed)

**Title:** Before you go — 30 seconds?

> We noticed you might be leaving DevPulse. Your honest reason helps us build something better. No email required.

**Options (single select):**
- Didn't find any useful findings
- Too complicated to set up
- Don't have API collections to import
- Not relevant to my current project
- Found a better alternative (which one? ______)
- Just testing / evaluating
- Privacy concerns
- Performance issues / VS Code slowdown
- Missing a feature I need (what? ______)
- Other: ______

**Follow-up (optional):**
> "Would a 15-minute call to share feedback be worth $20 in AWS credits to you?" [Yes / No thanks]

---

## Manual tracking (backup for beta)

For first 25 users, manually DM anyone who uninstalls within 7 days:

> "Hey — noticed you removed DevPulse. No hard feelings at all — I'm genuinely trying to understand what didn't work. Would you be willing to tell me in one sentence why? It'll directly shape what we build next."

---

## The questions that matter most

The uninstall reason alone isn't enough. The real question is:

**"Did DevPulse not solve a real problem, or did it solve a real problem badly?"**

- "Didn't find findings" → is their collection type not supported, OR is the scanner missing real issues?
- "Too complicated" → which step was the blocker? Key entry? Import? Finding the panel?
- "Not relevant" → what ARE they building with? Is there a product pivot signal here?

Log every uninstall response in the PMF tracker.
