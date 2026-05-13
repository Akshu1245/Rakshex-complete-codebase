"""
DevPulse Autonomous Executor — Self-contained task execution engine.
Writes structured task prompts that CommandCode/Codex picks up automatically
via the master_prompt.md .team/ inbox bridge.

Runs inside the Hermes agent loop. When a task is dispatched, it:
1. Loads the agent's full system prompt from the agent .md file
2. Writes a detailed execution prompt to .team/inbox/
3. The next Codex session auto-reads and executes it
4. Results flow back via .team/outbox/
"""
import json
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

DEVPULSE_ROOT = Path(__file__).resolve().parent.parent
AGENTS_DIR = DEVPULSE_ROOT / "agents"
TEAM_DIR = DEVPULSE_ROOT / ".team"
INBOX = TEAM_DIR / "inbox"
OUTBOX = TEAM_DIR / "outbox"
MEMORY_DIR = TEAM_DIR / "memory"


class AutonomousExecutor:
    def __init__(self):
        for d in [INBOX, OUTBOX, MEMORY_DIR, TEAM_DIR / "errors", TEAM_DIR / "autonomy"]:
            d.mkdir(parents=True, exist_ok=True)

    def execute(self, agent_name: str, task: str, contexts: list[str] | None = None) -> dict:
        """Execute a task by writing a structured prompt to .team/inbox/."""
        timestamp = int(time.time())
        task_id = f"auto_{timestamp}_{agent_name.replace(' ', '_').replace('-', '_')}"

        prompt = self._build_prompt(agent_name, task, contexts)
        priority = self._detect_priority(task)

        task_file = {
            "id": task_id,
            "task": task,
            "agent": agent_name,
            "priority": priority,
            "prompt": prompt,
            "source": "hermes_executor",
            "timestamp": datetime.now().isoformat(),
            "contexts": contexts or [],
        }

        filepath = INBOX / f"{task_id}.json"
        filepath.write_text(json.dumps(task_file, indent=2), encoding="utf-8")

        return {
            "status": "dispatched",
            "task_id": task_id,
            "agent": agent_name,
            "priority": priority,
            "file": str(filepath),
        }

    def execute_parallel(self, tasks: list[dict]) -> list[dict]:
        """Queue multiple tasks in parallel."""
        results = []
        for t in tasks:
            r = self.execute(t.get("agent", "PULSE-COMMAND"), t.get("prompt", ""), t.get("contexts"))
            results.append(r)
        return results

    def _build_prompt(self, agent_name: str, task: str, contexts: list[str] | None = None) -> str:
        agent_file = self._find_agent_file(agent_name)
        agent_context = ""
        if agent_file and agent_file.exists():
            content = agent_file.read_text(encoding="utf-8")
            # Extract the first 500 chars of the agent's role/identity
            for line in content.split("\n"):
                if line.startswith("**Role**") or line.startswith("## Identity"):
                    agent_context = content[:800]
                    break

        context_block = ""
        if contexts:
            context_block = "\n".join(f"- {c}" for c in contexts)

        return f"""## AUTONOMOUS TASK — {agent_name}

{agent_context}

### Task
{task}

### Context
{context_block or 'No additional context.'}

### Instructions
1. Execute this task using your domain expertise
2. Make all necessary code changes
3. Write tests for any new code
4. Update documentation if applicable
5. Commit with conventional commit format
6. Push to the current branch

### Output
When complete, write results to .team/outbox/auto_{int(time.time())}_complete.json
"""

    def _find_agent_file(self, agent_name: str) -> Path | None:
        for f in AGENTS_DIR.glob("*.md"):
            content = f.read_text(encoding="utf-8", errors="ignore")
            if agent_name.upper() in content.upper():
                return f
        return None

    def _detect_priority(self, task: str) -> str:
        lower = task.lower()
        high_keywords = ["security", "vuln", "crash", "broken", "critical", "leak", "attack"]
        medium_keywords = ["bug", "fix", "error", "test", "dependency", "docs"]
        if any(k in lower for k in high_keywords):
            return "HIGH"
        if any(k in lower for k in medium_keywords):
            return "MED"
        return "LOW"

    def check_outbox(self) -> list[dict]:
        """Check for completed task results."""
        results = []
        for f in sorted(OUTBOX.glob("auto_*_complete.json")):
            try:
                data = json.loads(f.read_text())
                results.append(data)
                f.unlink()  # consumed
            except Exception:
                pass
        return results

    def run_autonomy_cycle(self):
        """Full autonomy cycle: execute pending tasks, check results, learn."""
        # Process inbox
        inbox_files = sorted(INBOX.glob("auto_*.json"))
        completed = self.check_outbox()

        for i, f in enumerate(inbox_files):
            if i >= 3:  # limit per cycle to avoid overwhelm
                break
            try:
                data = json.loads(f.read_text())
                task = data.get("task", "")
                agent = data.get("agent", "PULSE-COMMAND")
                if task:
                    print(f"[EXECUTOR] Dispatching: [{agent}] {task[:100]}")
                    f.unlink()
            except Exception as e:
                print(f"[EXECUTOR] Error reading {f.name}: {e}")

        if completed:
            print(f"[EXECUTOR] {len(completed)} tasks completed this cycle")
            for r in completed:
                status = r.get("status", "unknown")
                agent = r.get("agent", "unknown")
                print(f"  [{status}] {agent}: {r.get('summary', '')[:100]}")


if __name__ == "__main__":
    executor = AutonomousExecutor()

    if len(sys.argv) > 2:
        agent = sys.argv[1]
        task = " ".join(sys.argv[2:])
        result = executor.execute(agent, task)
        print(json.dumps(result, indent=2))
    elif len(sys.argv) > 1 and sys.argv[1] == "--cycle":
        executor.run_autonomy_cycle()
    elif len(sys.argv) > 1 and sys.argv[1] == "--daemon":
        print("[EXECUTOR] Daemon mode — processing inbox every 60s")
        while True:
            executor.run_autonomy_cycle()
            time.sleep(60)
    else:
        inbox_count = len(list(INBOX.glob("auto_*.json"))) if INBOX.exists() else 0
        outbox_count = len(list(OUTBOX.glob("*.json"))) if OUTBOX.exists() else 0
        print(f"DevPulse Autonomous Executor Status")
        print(f"  Inbox pending:  {inbox_count}")
        print(f"  Outbox ready:   {outbox_count}")
        print(f"Usage:")
        print(f"  python autonomous_executor.py AGENT_NAME 'task description'")
        print(f"  python autonomous_executor.py --cycle")
        print(f"  python autonomous_executor.py --daemon")
