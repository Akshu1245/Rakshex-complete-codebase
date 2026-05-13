"""
Hermes WorkflowRouter — Maps slash commands and natural language to agent dispatches + pipelines.
"""
import asyncio
import json
import time
from pathlib import Path

DEVPULSE_ROOT = Path(__file__).resolve().parent.parent

SLASH_COMMANDS = {
    "sprint": {
        "description": "Plan and execute a sprint from backlog",
        "pipeline": ["ceo-strategy", "cto-architect", "vp-engineering", "em-delivery"],
        "parallel": False,
    },
    "health-check": {
        "description": "Run full system health check across all services",
        "pipeline": ["ops-monitor", "performance-auditor", "qa-tester"],
        "parallel": True,
    },
    "competitive-brief": {
        "description": "Generate competitive intelligence brief",
        "pipeline": ["competitive-watch", "research-orchestrator", "ceo-strategy"],
        "parallel": False,
    },
    "deploy": {
        "description": "Run full CI/CD deployment pipeline (with handoff)",
        "pipeline": ["qa-tester", "ops-release", "ops-monitor"],
        "parallel": False,
        "requires_handoff": True,
    },
    "audit": {
        "description": "Full security + dependency + performance audit",
        "pipeline": ["dev-security", "dependency-guardian", "performance-auditor"],
        "parallel": True,
    },
    "review": {
        "description": "Review all open PRs and auto-merge if green",
        "pipeline": ["reviewer", "qa-tester"],
        "parallel": False,
    },
    "docs": {
        "description": "Regenerate all documentation from code",
        "pipeline": ["docs-writer"],
        "parallel": False,
    },
    "onboard": {
        "description": "Onboard a new project — scan, analyze, set up",
        "pipeline": ["research-orchestrator", "dependency-guardian", "docs-writer"],
        "parallel": False,
    },
    "research": {
        "description": "Deep research on a topic — web search + scrape + synthesize",
        "pipeline": ["research-orchestrator"],
        "skill_pipeline": "research_web",
    },
    "fix": {
        "description": "Fix all known bugs across the codebase",
        "pipeline": ["bug-hunter", "qa-tester", "reviewer"],
        "parallel": True,
    },
    "status": {
        "description": "Get current swarm status without interrupting work",
        "pipeline": [],
        "info_only": True,
    },
    "meeting": {
        "description": "Trigger immediate team sync (all 28 agents report in)",
        "pipeline": ["pulse-command", "em-delivery"],
        "info_only": True,
    },
    "parallel": {
        "description": "Force parallel execution of a task",
        "pipeline": [],
        "parse_subtasks": True,
    },
    "sequential": {
        "description": "Force sequential execution (one agent at a time)",
        "pipeline": [],
        "parse_subtasks": True,
    },
}

AGENT_ALIAS_MAP = {
    "pulse": "PULSE-COMMAND",
    "ceo": "CEO-STRATEGY",
    "cto": "CTO-ARCHITECT",
    "cpo": "CPO-PRODUCT",
    "vp": "VP-ENGINEERING",
    "em": "EM-DELIVERY",
    "qa-lead": "QA-LEAD",
    "backend": "DEV-BACKEND",
    "frontend": "DEV-FRONTEND",
    "vscode": "DEV-VSCODE",
    "db": "DEV-DATABASE",
    "api": "DEV-API",
    "security": "DEV-SECURITY",
    "devops": "DEV-DEVOPS",
    "fullstack": "DEV-FULLSTACK",
    "tester": "QA-TESTER",
    "docs": "DOCS-WRITER",
    "review": "REVIEWER",
    "bug": "BUG-HUNTER",
    "release": "OPS-RELEASE",
    "monitor": "OPS-MONITOR",
    "factory": "AGENT-FACTORY",
    "research": "RESEARCH-ORCHESTRATOR",
    "recovery": "ERROR-RECOVERY",
    "deps": "DEPENDENCY-GUARDIAN",
    "steward": "API-STEWARD",
    "competitor": "COMPETITIVE-WATCH",
    "perf": "PERFORMANCE-AUDITOR",
    "ceo-strategy": "CEO-STRATEGY",
    "cto-architect": "CTO-ARCHITECT",
    "cpo-product": "CPO-PRODUCT",
    "vp-engineering": "VP-ENGINEERING",
    "em-delivery": "EM-DELIVERY",
    "qa-lead-agent": "QA-LEAD",
    "dev-backend": "DEV-BACKEND",
    "dev-frontend": "DEV-FRONTEND",
    "dev-vscode": "DEV-VSCODE",
    "dev-database": "DEV-DATABASE",
    "dev-api": "DEV-API",
    "dev-security": "DEV-SECURITY",
    "dev-devops": "DEV-DEVOPS",
    "dev-fullstack": "DEV-FULLSTACK",
    "qa-tester": "QA-TESTER",
    "docs-writer": "DOCS-WRITER",
    "reviewer": "REVIEWER",
    "bug-hunter": "BUG-HUNTER",
    "ops-release": "OPS-RELEASE",
    "ops-monitor": "OPS-MONITOR",
    "agent-factory": "AGENT-FACTORY",
    "research-orchestrator": "RESEARCH-ORCHESTRATOR",
    "error-recovery": "ERROR-RECOVERY",
    "dependency-guardian": "DEPENDENCY-GUARDIAN",
    "api-steward": "API-STEWARD",
    "competitive-watch": "COMPETITIVE-WATCH",
    "performance-auditor": "PERFORMANCE-AUDITOR",
}


class WorkflowRouter:
    def __init__(self, hermes_agent=None):
        self.hermes = hermes_agent

    def resolve_command(self, input_text: str) -> dict:
        """Parse slash command or natural language into a dispatch plan."""
        text = input_text.strip()

        # Check for slash commands
        if text.startswith("/"):
            parts = text[1:].split(maxsplit=1)
            cmd = parts[0].lower()
            args = parts[1] if len(parts) > 1 else ""

            if cmd in SLASH_COMMANDS:
                return self._build_slash_plan(cmd, args)
            elif cmd in AGENT_ALIAS_MAP:
                return self._build_agent_dispatch(AGENT_ALIAS_MAP[cmd], args)
            elif cmd == "help":
                return self._help_response()
            else:
                return {"type": "unknown", "message": f"Unknown command: /{cmd}. Try /help."}

        # Natural language routing
        return self._natural_language_route(text)

    def _build_slash_plan(self, cmd: str, args: str) -> dict:
        spec = SLASH_COMMANDS[cmd]

        if spec.get("info_only"):
            return {"type": "info", "command": cmd, "description": spec["description"]}

        if spec.get("parse_subtasks") and args:
            subtask_texts = [s.strip() for s in args.replace(" and ", ",").split(",") if s.strip()]
            return {
                "type": "swarm" if cmd == "parallel" else "pipeline",
                "command": cmd,
                "subtasks": subtask_texts,
                "parallel": cmd == "parallel",
            }

        if spec.get("skill_pipeline"):
            return {
                "type": "skill_pipeline",
                "command": cmd,
                "pipeline_name": spec["skill_pipeline"],
                "input": args,
            }

        return {
            "type": "pipeline" if not spec.get("parallel") else "swarm",
            "command": cmd,
            "agents": spec["pipeline"],
            "args": args,
            "parallel": spec.get("parallel", False),
            "requires_handoff": spec.get("requires_handoff", False),
            "description": spec["description"],
        }

    def _build_agent_dispatch(self, agent_name: str, task: str) -> dict:
        return {
            "type": "dispatch",
            "agent": agent_name,
            "task": task or "status",
        }

    def _natural_language_route(self, text: str) -> dict:
        """Route natural language to best agent using keywords."""
        lower = text.lower()
        scores = {}

        keyword_map = {
            "PULSE-COMMAND": ["start", "status", "meeting", "sprint", "plan", "orchestrat"],
            "CEO-STRATEGY": ["vision", "roadmap", "strategy", "competitor", "market", "pricing"],
            "CTO-ARCHITECT": ["architecture", "design", "tech debt", "refactor", "pattern"],
            "DEV-BACKEND": ["server", "api", "endpoint", "express", "middleware", "backend"],
            "DEV-FRONTEND": ["frontend", "react", "ui", "component", "page", "tailwind"],
            "DEV-SECURITY": ["security", "vuln", "inject", "xss", "csrf", "auth"],
            "DEV-DATABASE": ["database", "schema", "migration", "query", "drizzle", "sql"],
            "BUG-HUNTER": ["bug", "fix", "error", "crash", "broken"],
            "QA-TESTER": ["test", "coverage", "assert", "validate", "verify"],
            "DOCS-WRITER": ["docs", "document", "readme", "wiki", "guide"],
            "REVIEWER": ["review", "pr", "merge", "code review"],
            "OPS-MONITOR": ["monitor", "health", "alert", "metrics", "sentry"],
            "OPS-RELEASE": ["release", "deploy", "version", "changelog"],
            "RESEARCH-ORCHESTRATOR": ["research", "find", "search", "discover", "look up"],
        }

        for agent, keywords in keyword_map.items():
            score = sum(1 for kw in keywords if kw in lower)
            if score > 0:
                scores[agent] = score

        if not scores:
            return {"type": "dispatch", "agent": "PULSE-COMMAND", "task": text}

        best = max(scores, key=scores.get)
        return {"type": "dispatch", "agent": best, "task": text, "confidence": scores[best] / max(len(keyword_map[best]), 1)}

    def _help_response(self) -> dict:
        lines = ["Available slash commands:"]
        for cmd, spec in sorted(SLASH_COMMANDS.items()):
            lines.append(f"  /{cmd:<20} {spec['description']}")
        lines.append("\nAgent aliases (use /alias task):")
        for alias, agent in sorted(AGENT_ALIAS_MAP.items()):
            if "-" not in alias:
                lines.append(f"  /{alias:<20} → {agent}")
        return {"type": "help", "message": "\n".join(lines)}

    async def execute(self, plan: dict, hermes_agent) -> str:
        """Execute a resolved plan against the Hermes agent loop."""
        ptype = plan.get("type", "unknown")

        if ptype == "dispatch":
            await hermes_agent.submit_task(plan["task"], plan["agent"])
            return f"Dispatched to {plan['agent']}: {plan['task'][:100]}"

        elif ptype == "swarm":
            agents = plan.get("agents", [])
            args = plan.get("args", "")
            subtasks = [
                {"agent": AGENT_ALIAS_MAP.get(a, a), "prompt": f"{args}", "id": f"swarm_{a}_{int(time.time())}"}
                for a in agents
            ]
            from hermes.agent_loop import GatewayEvent
            await hermes_agent.event_queue.put(GatewayEvent(
                source="cli", event_type="task", content=f"/{plan['command']} {args}",
                agent_target="PULSE-COMMAND", subtasks=subtasks, priority=3,
            ))
            return f"Swarm launched: {len(agents)} agents in parallel — {plan['description']}"

        elif ptype == "pipeline":
            agents = plan.get("agents", [])
            args = plan.get("args", "")
            plan["_step"] = 0
            for agent_key in agents:
                agent_name = AGENT_ALIAS_MAP.get(agent_key, agent_key)
                await hermes_agent.submit_task(f"[Pipeline: {plan['command']}] {args}", agent_name)
                plan["_step"] += 1
            return f"Pipeline '{plan['command']}' started: {len(agents)} steps — {plan['description']}"

        elif ptype == "skill_pipeline":
            result = await hermes_agent.run_pipeline(plan["pipeline_name"], plan.get("input", ""))
            return json.dumps(result, indent=2)

        elif ptype == "info":
            return f"[{plan['command']}] {plan['description']} — status query sent to PULSE-COMMAND"

        elif ptype == "help":
            return plan["message"]

        return f"Unknown plan type: {ptype}"


# Singleton
router = WorkflowRouter()


def resolve(input_text: str) -> dict:
    return router.resolve_command(input_text)


async def execute(plan: dict, hermes_agent) -> str:
    return await router.execute(plan, hermes_agent)
