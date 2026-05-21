# Rakshex Incident Disclosure Template

> Transparent communication during incidents.
> Date: 2026-05-17

---

## DISCLOSURE PRINCIPLES

1. **Fast** — Acknowledge within 1 hour
2. **Honest** — No spin, no blame-shifting
3. **Specific** — Exact scope, exact impact
4. **Actionable** — What users should do
5. **Follow-up** — Post-mortem within 24 hours

---

## TEMPLATES

### Initial Disclosure (Within 1 Hour)

```
🚨 Incident Alert — [Service] Disruption

Impact: [What is affected]
Started: [Time UTC]
Status: Investigating

What we know:
- [Fact 1]
- [Fact 2]

What we don't know yet:
- [Unknown 1]

User action needed: [Yes/No — if yes, what]

Updates: [status.rakshex.in link]
Next update: [Time]
```

### Update (Every 30 Minutes)

```
📋 Update — [Incident Name]

Status: [Investigating / Mitigating / Resolved]
Time: [Duration]

New information:
- [Update 1]
- [Update 2]

What we're doing:
- [Action 1]
- [Action 2]

ETA: [Time or "Unknown"]

Next update: [Time]
```

### Resolution

```
✅ Resolved — [Incident Name]

Duration: [X minutes]
Impact: [Brief description]

What happened:
[2-3 sentence summary]

What we did:
- [Action 1]
- [Action 2]

What we're doing next:
- [Prevention 1]
- [Prevention 2]

Post-mortem: [Link, within 24 hours]

We apologize for the disruption.
```

### Post-Mortem (Within 24 Hours)

```
📊 Post-Mortem: [Incident Name]
Date: [Date]
Severity: [SEV1/2/3]
Duration: [X minutes]
Impact: [Description]

## Timeline
T+0  — [Event]
T+X  — [Event]

## Root Cause
[What happened and why]

## Impact Assessment
- Users affected: [N]
- Data lost: [Yes/No — details]
- Features broken: [List]

## Resolution
[How we fixed it]

## Lessons Learned
[What we learned]

## Action Items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Action] | [Owner] | [Date] | Pending |

## What Users Should Know
[Any user action needed]
```

---

## SEVERITY-BASED COMMUNICATION

| Severity | Initial  | Updates       | Post-Mortem | Channels                   |
| -------- | -------- | ------------- | ----------- | -------------------------- |
| SEV1     | 1 hour   | Every 30 min  | 24 hours    | Status page, email, in-app |
| SEV2     | 2 hours  | Every 2 hours | 48 hours    | Status page, email         |
| SEV3     | 4 hours  | Daily         | 1 week      | Status page                |
| SEV4     | 24 hours | None          | Optional    | Internal only              |

---

_Template maintained by SRE + communications team._
_Practice quarterly._
