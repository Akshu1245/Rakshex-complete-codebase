# Rakshex Scan Trust Improvements

> Continuously improve scan quality so developers rely on findings.
> Date: 2026-05-17

---

## TRUST SCORE FORMULA

```
Trust Score = (True Positives × 2) - (False Positives × 3) - (Ignored Findings × 1)
              ─────────────────────────────────────────────────────────────────────
              Total Findings

Target: Trust Score ≥ 1.5
Current: ___
```

---

## CONTINUOUS VALIDATION PIPELINE

### 1. Public GitHub Repos (Weekly)

| Repo                                                         | Type                     | Scanned | Findings | True Pos | False Pos | Trust Score |
| ------------------------------------------------------------ | ------------------------ | ------- | -------- | -------- | --------- | ----------- |
| [vulnerable-node](https://github.com/cr0hn/vulnerable-node)  | Intentionally vulnerable |         |          |          |           |             |
| [OWASP Juice Shop](https://github.com/juice-shop/juice-shop) | Training app             |         |          |          |           |             |
| [RealWorld](https://github.com/gothinkster/realworld)        | Production-like          |         |          |          |           |             |
| [LangChain](https://github.com/langchain-ai/langchain)       | AI framework             |         |          |          |           |             |
| [OpenAI Python](https://github.com/openai/openai-python)     | AI SDK                   |         |          |          |           |             |

### 2. AI Agent Repos (Weekly)

| Repo                                                       | Framework   | Scanned | LLM Issues | AgentGuard Triggers |
| ---------------------------------------------------------- | ----------- | ------- | ---------- | ------------------- |
| [AutoGPT](https://github.com/Significant-Gravitas/AutoGPT) | Agent       |         |            |                     |
| [CrewAI](https://github.com/joaomdmoura/crewAI)            | Multi-agent |         |            |                     |
| [LangGraph](https://github.com/langchain-ai/langgraph)     | Graph-based |         |            |                     |

### 3. Startup APIs (With Permission)

| Startup | Industry | Collection Size | Issues Found | Fixed |
| ------- | -------- | --------------- | ------------ | ----- |
|         |          |                 |              |       |

---

## FALSE POSITIVE REDUCTION

### FP Tracking

| Rule                              | Total Fired | FPs Reported | FP Rate | Action |
| --------------------------------- | ----------- | ------------ | ------- | ------ |
| Missing auth on public endpoint   |             |              |         |        |
| HTTP instead of HTTPS (localhost) |             |              |         |        |
| Exposed key in test fixture       |             |              |         |        |
| Prompt injection in documentation |             |              |         |        |

### FP Feedback Loop

```
User marks finding as FP
  → Record: finding type, rule, confidence, context
  → Adjust: lower confidence for similar patterns
  → Review: weekly FP analysis meeting
  → Fix: update rule or add exception
  → Validate: re-scan same collection
```

---

## REMEDIATION CLARITY SCORE

For each finding, measure:

| Criterion          | Weight | Score |
| ------------------ | ------ | ----- |
| Clear title        | 20%    | 1-5   |
| Specific location  | 20%    | 1-5   |
| Evidence provided  | 20%    | 1-5   |
| Fix steps included | 20%    | 1-5   |
| Code example given | 20%    | 1-5   |

**Target avg: 4.0+**
**Current: \_\_\_**

### Remediation Improvement Backlog

| Finding Type     | Current Score | Issue | Fix | Owner |
| ---------------- | ------------- | ----- | --- | ----- |
| Exposed secret   |               |       |     |       |
| Missing auth     |               |       |     |       |
| HTTP endpoint    |               |       |     |       |
| Prompt injection |               |       |     |       |
| Cost anomaly     |               |       |     |       |

---

## CONFIDENCE SCORING VALIDATION

### Confidence Calibration

| Confidence Range | Actual Accuracy | Calibration |
| ---------------- | --------------- | ----------- |
| 95-100%          | \_\_\_%         | \_\_\_      |
| 80-94%           | \_\_\_%         | \_\_\_      |
| 60-79%           | \_\_\_%         | \_\_\_      |
| 40-59%           | \_\_\_%         | \_\_\_      |
| < 40%            | \_\_\_%         | \_\_\_      |

**Well-calibrated when:** 95% confidence → ~95% accuracy

---

## SCAN PERFORMANCE BUDGET

| Metric                  | Budget   | Current | Status |
| ----------------------- | -------- | ------- | ------ |
| Parse collection        | < 500ms  | \_\_\_  |        |
| Send to API             | < 1s     | \_\_\_  |        |
| Process response        | < 500ms  | \_\_\_  |        |
| Render findings         | < 300ms  | \_\_\_  |        |
| **Total time-to-value** | **< 3s** | \_\_\_  |        |

---

## TRUST METRICS DASHBOARD

| Date | Scans | Findings | TP Rate | FP Rate | Trust Score | Remediation Score |
| ---- | ----- | -------- | ------- | ------- | ----------- | ----------------- |
|      |       |          |         |         |             |                   |

---

_Improvements maintained by engineering + product team._
_Reviewed weekly. Top 3 FP sources fixed every sprint._
