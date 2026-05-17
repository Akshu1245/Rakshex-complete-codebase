# DevPulse Beta Success Scorecard

> How we measure if a beta user is successfully onboarded.
> Date: 2026-05-17

---

## SUCCESS DEFINITION

A successful beta user has:

1. Installed the extension
2. Connected an account
3. Imported at least 1 collection
4. Run at least 1 scan
5. Viewed findings
6. Returned within 7 days
7. Responded to at least 1 feedback prompt

**Success rate target: 50% of invited users**

---

## SCORECARD PER USER

| #   | Milestone                 | Weight   | Evidence                         | Score    |
| --- | ------------------------- | -------- | -------------------------------- | -------- |
| 1   | Extension installed       | 5%       | Telemetry: `extension_activated` | /5       |
| 2   | Account connected         | 10%      | Telemetry: `auth_success`        | /10      |
| 3   | Collection imported       | 15%      | Telemetry: `collection_imported` | /15      |
| 4   | First scan completed      | 15%      | Telemetry: `scan_completed`      | /15      |
| 5   | Findings viewed           | 10%      | Telemetry: `finding_viewed`      | /10      |
| 6   | Finding marked valid/FP   | 10%      | Telemetry: `finding_feedback`    | /10      |
| 7   | Returned within 7 days    | 15%      | Telemetry: `session` within D7   | /15      |
| 8   | Gave qualitative feedback | 10%      | Survey/interview completed       | /10      |
| 9   | Referred another user     | 5%       | Referral code used               | /5       |
| 10  | Upgraded or intent to pay | 5%       | Survey: "would pay $29/mo"       | /5       |
|     | **TOTAL**                 | **100%** |                                  | **/100** |

---

## SCORING RUBRIC

| Score  | Classification | Action                                    |
| ------ | -------------- | ----------------------------------------- |
| 90-100 | Champion       | Ask for case study, testimonial, referral |
| 70-89  | Engaged        | Deepen usage, invite to beta community    |
| 50-69  | At-risk        | Personal outreach, identify blockers      |
| < 50   | Churned        | Exit interview, learn why                 |

---

## AGGREGATE METRICS

```
Week of May 17, 2026

Beta users invited:     25
Activated (step 2):    18 (72%)
Scanned (step 4):      12 (48%)
Successful (step 6):    10 (40%)
Champions (90+):       3  (12%)
Churned (<50):          5  (20%)

Top blocker: "Couldn't figure out API key" (5 users)
Top win: "Found exposed secret in collection" (8 users)
```

---

## WEEKLY REVIEW TEMPLATE

```
Beta Scorecard — Week of [DATE]

Users:
  Invited:     __
  Activated:   __ (__%)
  Scanned:     __ (__%)
  Successful:  __ (__%)
  Champions:   __ (__%)
  Churned:     __ (__%)

Blockers (top 3):
  1. _____________ (__ users)
  2. _____________ (__ users)
  3. _____________ (__ users)

Wins (top 3):
  1. _____________ (__ users)
  2. _____________ (__ users)
  3. _____________ (__ users)

Actions this week:
  - _____________
  - _____________
```

---

_Scorecard maintained by growth team._
_Reviewed weekly with product and engineering._
