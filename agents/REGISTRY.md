# DevPulse Agent Registry & Team Coordination

## ⚡ AUTONOMY MODE

**To start full autonomy, just say: `start`**

The entire team awakens, discovers work, makes decisions, executes, learns, and improves — continuously. No further input needed. You get updates every 2 days at team sync. Only protected operations (DB migrations, deployments, package changes, security changes) pause for your approval.

```
"start"    → Full autonomy begins
"stop"     → Pause all autonomous work
"status"   → Get current state
"meeting"  → Trigger team sync immediately
```

---

## Team Structure (23 Agents + Dynamic Spawned)

```
PULSE-COMMAND ←═══ ALL REPORTS FLOW HERE ════╗
│                                                ║
├── LEADERSHIP (4)                               ║
│   ├── 01-ceo-strategy    — Vision, roadmap     ║
│   ├── 02-cto-architect   — Architecture        ║
│   ├── 03-cpo-product     — Feature design      ║
│   └── 04-vp-engineering  — Sprint planning     ║
│                                                ║
├── MANAGEMENT (2)                               ║
│   ├── 05-em-delivery     — Task coordination   ║
│   └── 06-qa-lead         — Quality strategy    ║
│                                                ║
├── DEVELOPMENT (8)                              ║
│   ├── 07-dev-backend     — server/             ║
│   ├── 08-dev-frontend    — devpulse-frontend/  ║
│   ├── 09-dev-vscode      — devpulse-vscode/    ║
│   ├── 10-dev-database    — drizzle/             ║
│   ├── 11-dev-api         — server/api/         ║
│   ├── 12-dev-security    — Security engine      ║
│   ├── 13-dev-devops      — Docker, CI/CD       ║
│   └── 14-dev-fullstack   — Cross-cutting       ║
│                                                ║
├── SPECIALIZED (4)                              ║
│   ├── 15-qa-tester       — Tests               ║
│   ├── 16-docs-writer     — Documentation       ║
│   ├── 17-reviewer        — Code review         ║
│   └── 18-bug-hunter      — Bug fixing          ║
│                                                ║
├── OPERATIONS (2)                               ║
│   ├── 19-ops-release     — Releases            ║
│   └── 20-ops-monitor     — Monitoring          ║
│                                                ║
├── AUTONOMY (3)
│   ├── 22-agent-factory   — Spawns agents
│   ├── 23-research-orch   — Finds all work
│   └── 24-error-recovery  — Tracks & retries errors
│
├── GUARDIANS (4)  ← NEW
│   ├── 25-dependency-guardian — Supply chain security
│   ├── 26-api-steward         — API contract stability
│   ├── 27-competitive-watch   — Competitor monitoring
│   └── 28-performance-auditor — Latency & perf
│
└── DYNAMIC (variable)                           ║
    └── agents/ spawned by AGENT-FACTORY         ║
                                                 ║
EVERY AGENT REPORTS TO PULSE-COMMAND ═══════════╝
```

---

## The Autonomy Loop

```
┌─────────────────────────────────────────────────────────┐
│  RESEARCH-ORCHESTRATOR discovers all work               │
│          ↓                                              │
│  PULSE-COMMAND decides what to do                       │
│          ↓                                              │
│  VP-ENGINEERING plans the sprint                        │
│          ↓                                              │
│  EM-DELIVERY assigns tasks to DEV agents                │
│          ↓                                              │
│  DEV agents implement (parallel, non-conflicting)       │
│          ↓                                              │
│  QA-TESTER writes + runs tests                          │
│          ↓                                              │
│  REVIEWER reviews all PRs                               │
│          ↓                                              │
│  DOCS-WRITER updates documentation                      │
│          ↓                                              │
│  OPS-MONITOR watches everything                         │
│          ↓                                              │
│  OPS-RELEASE coordinates releases                       │
│          ↓                                              │
│  BUG-HUNTER fixes any issues found                      │
│          ↓                                              │
│  AGENT-FACTORY spawns new agents if overloaded          │
│          ↓                                              │
│  RESEARCH-ORCHESTRATOR finds MORE work (continuous)     │
│          ↓                                              │
│  PULSE-COMMAND learns, improves, REPEATS                │
└─────────────────────────────────────────────────────────┘
```

---

## How Work Flows

### When You Say "start"

```
T+0min  → RESEARCH-ORCHESTRATOR: 10 parallel discovery scans
T+2min  → PULSE-COMMAND: Builds prioritized backlog
T+3min  → VP-ENGINEERING: Drafts sprint plan
T+4min  → CTO-ARCHITECT: Reviews technical items
T+5min  → CEO-STRATEGY: Checks strategic alignment
T+6min  → Sprint published internally
T+7min  → EM-DELIVERY: Begins task assignment
T+8min  → DEV agents: Start coding
T+48hrs → First team sync (all agents report in)
```

### Continuous Cycle

```
DISCOVER → DECIDE → EXECUTE → LEARN → DISCOVER → ...
     ↑                                        │
     └────────────────────────────────────────┘
              (never stops)
```

---

## Meeting Cadence

| Cadence | What | Who |
|---|---|---|
| **Every 2 days** | Team sync standup | All 23 agents report status |
| **End of sprint** | Retrospective | All agents, facilitated by PULSE-COMMAND |
| **Start of sprint** | Planning | Leadership + EM-DELIVERY |
| **On incident** | War room | OPS-MONITOR + BUG-HUNTER + DEV-SECURITY |
| **On demand** | Any agent can request a sync via EM-DELIVERY |

---

## Decision Authority

| Decision | Autonomous? |
|---|---|
| What to build next | ✅ Yes |
| Code changes | ✅ Yes |
| Creating tests | ✅ Yes |
| Creating docs | ✅ Yes |
| PR merging | ✅ Yes |
| Creating new agents | ✅ Yes |
| Architecture decisions (non-breaking) | ✅ Yes |
| Bug fixes | ✅ Yes |
| DB migrations to production | ❌ Needs human |
| Production deployment | ❌ Needs human |
| Package changes | ❌ Needs human |
| Security rule changes | ❌ Needs human |
| Stripe/Razorpay config | ❌ Needs human |

---

## Communication

| How | When |
|---|---|
| **Silent** | Normal operation — team works, ships, improves |
| **Team sync report** | Every 2 days — status, blockers, next steps |
| **Approval request** | When protected operation needs human confirmation |
| **Incident alert** | Immediately when OPS-MONITOR detects critical issue |
| **Status report** | When you ask "status" |
| **Sprint retro** | At end of each sprint cycle |

---

## Agent Files Index

| # | File | Agent | Layer |
|---|---|---|---|
| 00 | `agents/00-master-orchestrator.md` | PULSE-COMMAND | Command |
| 01 | `agents/01-ceo-strategy.md` | CEO-STRATEGY | Leadership |
| 02 | `agents/02-cto-architect.md` | CTO-ARCHITECT | Leadership |
| 03 | `agents/03-cpo-product.md` | CPO-PRODUCT | Leadership |
| 04 | `agents/04-vp-engineering.md` | VP-ENGINEERING | Leadership |
| 05 | `agents/05-em-delivery.md` | EM-DELIVERY | Management |
| 06 | `agents/06-qa-lead.md` | QA-LEAD | Management |
| 07 | `agents/07-dev-backend.md` | DEV-BACKEND | Development |
| 08 | `agents/08-dev-frontend.md` | DEV-FRONTEND | Development |
| 09 | `agents/09-dev-vscode.md` | DEV-VSCODE | Development |
| 10 | `agents/10-dev-database.md` | DEV-DATABASE | Development |
| 11 | `agents/11-dev-api.md` | DEV-API | Development |
| 12 | `agents/12-dev-security.md` | DEV-SECURITY | Development |
| 13 | `agents/13-dev-devops.md` | DEV-DEVOPS | Development |
| 14 | `agents/14-dev-fullstack.md` | DEV-FULLSTACK | Development |
| 15 | `agents/15-qa-tester.md` | QA-TESTER | Specialized |
| 16 | `agents/16-docs-writer.md` | DOCS-WRITER | Specialized |
| 17 | `agents/17-reviewer.md` | REVIEWER | Specialized |
| 18 | `agents/18-bug-hunter.md` | BUG-HUNTER | Specialized |
| 19 | `agents/19-ops-release.md` | OPS-RELEASE | Operations |
| 20 | `agents/20-ops-monitor.md` | OPS-MONITOR | Operations |
| 22 | `agents/22-agent-factory.md` | AGENT-FACTORY | Autonomy |
| 23 | `agents/23-research-orchestrator.md` | RESEARCH-ORCHESTRATOR | Autonomy |
| 24 | `agents/24-error-recovery.md` | ERROR-RECOVERY | Autonomy |
| 25 | `agents/25-dependency-guardian.md` | DEPENDENCY-GUARDIAN | Guardians |
| 26 | `agents/26-api-steward.md` | API-STEWARD | Guardians |
| 27 | `agents/27-competitive-watch.md` | COMPETITIVE-WATCH | Guardians |
| 28 | `agents/28-performance-auditor.md` | PERFORMANCE-AUDITOR | Guardians |
| — | `agents/REGISTRY.md` | This file | Reference |
