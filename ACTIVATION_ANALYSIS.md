# DevPulse Activation Analysis

> Understanding why users complete (or abandon) onboarding.
> Date: 2026-05-17

---

## ACTIVATION DEFINITION

A user is **activated** when they:

1. Install the extension
2. Connect an account (API key or create free account)
3. Import at least 1 collection
4. Run at least 1 scan
5. View at least 1 finding

**Target activation rate: 50%** (of installers)

---

## ONBOARDING STEPS & FRICTION POINTS

### Step 1: Install Extension

| Metric          | Target         | Actual   |
| --------------- | -------------- | -------- |
| Install rate    | 100% of visits | \_\_%    |
| Time to install | < 2 min        | \_\_ min |

**Friction observed:**

- Marketplace search doesn't find us? (check SEO)
- Installation fails on older VS Code versions?
- Extension size too large?

**Fixes applied:**

- ***

---

### Step 2: Connect Account

| Metric          | Target            | Actual   |
| --------------- | ----------------- | -------- |
| Connection rate | 70% of installers | \_\_%    |
| Time to connect | < 3 min           | \_\_ min |

**Friction observed:**

- "I don't have an API key" → Need "Create Free Account" flow
- "Where do I paste this?" → Improve welcome view instructions
- "Invalid key" error → Better validation and error messages

**Fixes applied:**

- Added "Create Free Account" as primary CTA
- Added inline help tooltip
- Improved error messages with next steps

---

### Step 3: Import Collection

| Metric         | Target           | Actual   |
| -------------- | ---------------- | -------- |
| Import rate    | 60% of connected | \_\_%    |
| Time to import | < 2 min          | \_\_ min |

**Friction observed:**

- "I don't have a collection" → Provide sample collection
- "Import failed" → Better error handling and format support
- "Which file do I pick?" → File picker with filter

**Fixes applied:**

- Added sample collection download link
- Added auto-detect for Postman/OpenAPI/Bruno
- Improved error messages with file format examples

---

### Step 4: Run Scan

| Metric       | Target          | Actual   |
| ------------ | --------------- | -------- |
| Scan rate    | 80% of imported | \_\_%    |
| Time to scan | < 1 min         | \_\_ min |

**Friction observed:**

- "Scan button is disabled" → Explain why (waiting for connection?)
- "Scan takes too long" → Progress indicator + background scanning
- "Scan failed" → Better error recovery and retry

**Fixes applied:**

- ***

---

### Step 5: View Findings

| Metric              | Target         | Actual |
| ------------------- | -------------- | ------ |
| View rate           | 90% of scanned | \_\_%  |
| Time to first value | < 30s          | \_\_s  |

**Friction observed:**

- "No findings found" → Show "All clear!" celebration
- "Too many findings" → Sort by severity + confidence
- "I don't understand this finding" → Add explainability panel

**Fixes applied:**

- ***

---

## SEGMENT ANALYSIS

### By User Type

| Segment               | Activation Rate | Top Blocker |
| --------------------- | --------------- | ----------- |
| Indie hackers         | \_\_%           |             |
| AI startup engineers  | \_\_%           |             |
| Enterprise developers | \_\_%           |             |
| Students / learners   | \_\_%           |             |

### By Acquisition Source

| Source                 | Users | Activation Rate |
| ---------------------- | ----- | --------------- |
| VS Code Marketplace    | \_\_  | \_\_%           |
| Product Hunt           | \_\_  | \_\_%           |
| Twitter/X              | \_\_  | \_\_%           |
| Reddit                 | \_\_  | \_\_%           |
| Direct (word-of-mouth) | \_\_  | \_\_%           |

---

## WEEKLY ACTIVATION REVIEW

```
Week of [DATE]

Activation rate: __% (target: 50%)
Trend: ▲ ▼ —

Top 3 blockers this week:
1. _____________ (__ users affected)
2. _____________ (__ users affected)
3. _____________ (__ users affected)

Experiments run:
1. _____________ → Result: _____________
2. _____________ → Result: _____________

Next week's focus:
- _____________
```

---

_Analysis maintained by growth + product team._
_Updated weekly._
