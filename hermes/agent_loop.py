"""
Hermes Agent — Personal AI Agent Framework integrated with DevPulse.
Runs alongside CommandCode, not replacing it.
Provides: self-improving skills, SQLite FTS5 memory, Honcho user modeling,
          Telegram/Slack gateways, and 28 DevPulse agent profiles.
"""
import asyncio
import json
import os
import signal
import sqlite3
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

DEVPULSE_ROOT = Path(__file__).resolve().parent.parent
HERMES_ROOT = DEVPULSE_ROOT / "hermes"
MEMORY_DB = HERMES_ROOT / "memory" / "hermes_memory.db"
PROFILES_DIR = HERMES_ROOT / "profiles"
SKILLS_DIR = HERMES_ROOT / "skills"
GATEWAYS_DIR = HERMES_ROOT / "gateways"
HONCHO_DB = HERMES_ROOT / "honcho" / "honcho_user.db"
AGENTS_DIR = DEVPULSE_ROOT / "agents"


# ── Event System ──────────────────────────────────────────────────────

@dataclass
class GatewayEvent:
    source: Literal["telegram", "slack", "system", "timer", "devpulse", "cli", "kilo", "mcp", "rashi"]
    event_type: str  # "message", "command", "timer", "skill_ready", "task", "handoff", "approve", "reject", "error"
    user_id: str = "devpulse-user"
    chat_id: str = "cli"
    content: str = ""
    agent_target: str | None = None  # which DevPulse agent to route to
    priority: int = 5  # 1-10, 1 = highest
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    handoff_id: str | None = None
    subtasks: list[dict] | None = None  # for parallel sub-agent dispatch


@dataclass
class HandoffRequest:
    """A request that blocks agent execution until human approval is received."""
    id: str
    operation: str  # "db_migration", "deployment", "package_change", "security_rule"
    description: str
    agent: str
    file_paths: list[str] = field(default_factory=list)
    risk_level: str = "medium"
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    approved: bool | None = None
    approved_at: datetime | None = None
    approved_by: str | None = None
    timeout_seconds: int = 3600


# ── Memory System ──────────────────────────────────────────────────────

class HermesMemory:
    """SQLite FTS5 memory with .team/ bridge for DevPulse compatibility."""

    def __init__(self, db_path: Path = MEMORY_DB):
        self.db_path = db_path
        self.conn = sqlite3.connect(str(db_path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self):
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY,
                timestamp TEXT DEFAULT (datetime('now')),
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                tool_name TEXT,
                tool_result TEXT,
                agent_profile TEXT,
                iteration_id INTEGER
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS conversations_fts USING fts5(
                content, role, agent_profile,
                content='conversations',
                content_rowid='id'
            );

            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY,
                key TEXT UNIQUE,
                value TEXT,
                category TEXT,
                importance REAL DEFAULT 0.5,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
                key, value, category,
                content='memories',
                content_rowid='id'
            );

            CREATE TABLE IF NOT EXISTS agent_state (
                id INTEGER PRIMARY KEY,
                state_json TEXT,
                updated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS skills_registry (
                id INTEGER PRIMARY KEY,
                skill_name TEXT UNIQUE,
                skill_file TEXT,
                version INTEGER DEFAULT 1,
                usage_count INTEGER DEFAULT 0,
                success_rate REAL DEFAULT 0.0,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY,
                source TEXT,
                event_type TEXT,
                content TEXT,
                agent_target TEXT,
                priority INTEGER DEFAULT 5,
                received_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS learning_log (
                id INTEGER PRIMARY KEY,
                pattern TEXT,
                observation TEXT,
                action_taken TEXT,
                result TEXT,
                recorded_at TEXT DEFAULT (datetime('now'))
            );
        """)
        self.conn.commit()

    def store_conversation(self, role: str, content: str, agent: str = None):
        self.conn.execute(
            "INSERT INTO conversations (role, content, agent_profile) VALUES (?, ?, ?)",
            (role, content, agent)
        )
        self.conn.commit()

    def search(self, query: str, limit: int = 5) -> list[dict]:
        try:
            rows = self.conn.execute(
                "SELECT content, role, agent_profile FROM conversations_fts WHERE content MATCH ? ORDER BY rank LIMIT ?",
                (query, limit)
            ).fetchall()
        except sqlite3.OperationalError:
            rows = self.conn.execute(
                "SELECT content, role, agent_profile FROM conversations WHERE content LIKE ? LIMIT ?",
                (f"%{query}%", limit)
            ).fetchall()
        return [dict(r) for r in rows]

    def store_memory(self, key: str, value: str, category: str = "general", importance: float = 0.5):
        self.conn.execute(
            """INSERT INTO memories (key, value, category, importance, updated_at)
               VALUES (?, ?, ?, ?, datetime('now'))
               ON CONFLICT(key) DO UPDATE SET value=excluded.value, importance=excluded.importance, updated_at=datetime('now')""",
            (key, value, category, importance)
        )
        self.conn.commit()

    def get_memory(self, key: str) -> str | None:
        row = self.conn.execute("SELECT value FROM memories WHERE key=?", (key,)).fetchone()
        return row["value"] if row else None

    def recall_relevant(self, query: str, limit: int = 5) -> list[dict]:
        return self.search(query, limit)

    def register_skill(self, name: str, filepath: str):
        self.conn.execute(
            "INSERT OR IGNORE INTO skills_registry (skill_name, skill_file) VALUES (?, ?)",
            (name, str(filepath))
        )
        self.conn.commit()

    def record_skill_usage(self, name: str, success: bool):
        self.conn.execute(
            "UPDATE skills_registry SET usage_count = usage_count + 1, updated_at = datetime('now') WHERE skill_name = ?",
            (name,)
        )
        if success:
            self.conn.execute(
                "UPDATE skills_registry SET success_rate = (success_rate * (usage_count - 1) + 1.0) / usage_count WHERE skill_name = ?",
                (name,)
            )
        self.conn.commit()

    def log_learning(self, pattern: str, observation: str, action: str, result: str):
        self.conn.execute(
            "INSERT INTO learning_log (pattern, observation, action_taken, result) VALUES (?, ?, ?, ?)",
            (pattern, observation, action, result)
        )
        self.conn.commit()

    def close(self):
        self.conn.close()


# ── Honcho User Modeling ───────────────────────────────────────────────

class HonchoUserModel:
    """Learns user preferences from interactions. Decaying, self-reinforcing."""

    def __init__(self, db_path: Path = HONCHO_DB):
        self.db_path = db_path
        self.conn = sqlite3.connect(str(db_path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self):
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS user_identity (
                id INTEGER PRIMARY KEY,
                key TEXT UNIQUE,
                value TEXT,
                source TEXT,  -- 'explicit' or 'inferred'
                confidence REAL DEFAULT 1.0,
                updated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY,
                pref_key TEXT UNIQUE,
                pref_value TEXT,
                weight REAL DEFAULT 0.5,
                occurrences INTEGER DEFAULT 1,
                last_reinforced TEXT DEFAULT (datetime('now')),
                decay_rate REAL DEFAULT 0.05
            );

            CREATE TABLE IF NOT EXISTS interaction_patterns (
                id INTEGER PRIMARY KEY,
                pattern_type TEXT,
                details TEXT,
                frequency INTEGER DEFAULT 1,
                last_seen TEXT DEFAULT (datetime('now'))
            );
        """)
        self.conn.commit()
        self._seed_defaults()

    def _seed_defaults(self):
        defaults = {
            "name": "DevPulse User",
            "preferred_language": "TypeScript",
            "response_style": "concise",
            "timezone": "America/Los_Angeles",
            "working_hours": "9am-6pm",
            "code_editor": "VSCode",
            "prefers_bullet_points": "true",
            "project": "DevPulse AI Governance Platform"
        }
        for k, v in defaults.items():
            self.conn.execute(
                "INSERT OR IGNORE INTO user_identity (key, value, source, confidence) VALUES (?, ?, 'default', 0.5)",
                (k, v)
            )
        self.conn.commit()

    # ── Graduated Trust Scoring ───────────────────────────────────────

    def get_trust_score(self, operation_type: str) -> float:
        """Return 0.0–1.0 trust for autonomous decisions on this operation type."""
        row = self.conn.execute(
            "SELECT occurrences, success_rate FROM skills_registry WHERE skill_name LIKE ?",
            (f"op_{operation_type}%",)
        ).fetchone()
        if not row:
            return 0.3  # no history → low trust
        occ = row["occurrences"] or 1
        rate = row["success_rate"] or 0.5
        return min(1.0, rate * (1.0 - 0.95 ** occ))

    def record_decision(self, operation_type: str, success: bool, agent: str = "HERMES"):
        """Record an autonomous decision outcome for trust scoring."""
        skill_key = f"op_{operation_type}_autonomous"
        self.conn.execute(
            "INSERT INTO skills_registry (skill_name, skill_file, usage_count, success_rate) "
            "VALUES (?, 'auto', 1, ?) "
            "ON CONFLICT(skill_name) DO UPDATE SET "
            "usage_count = usage_count + 1, "
            "success_rate = (success_rate * (usage_count - 1) + ?) / usage_count, "
            "updated_at = datetime('now')",
            (skill_key, 1.0 if success else 0.0, 1.0 if success else 0.0)
        )
        self.conn.commit()

    def should_auto_approve(self, operation_type: str) -> bool:
        """Graduated trust: auto-approve if trust > 0.8 and we have enough history."""
        trust = self.get_trust_score(operation_type)
        row = self.conn.execute(
            "SELECT usage_count FROM skills_registry WHERE skill_name = ?",
            (f"op_{operation_type}_autonomous",)
        ).fetchone()
        occurrences = row["usage_count"] if row else 0
        return trust > 0.8 and occurrences >= 5

    def set_preference(self, key: str, value: str, source: str = "explicit", confidence: float = 1.0):
        if source == "explicit":
            self.conn.execute(
                "INSERT OR REPLACE INTO user_identity (key, value, source, confidence, updated_at) VALUES (?, ?, ?, ?, datetime('now'))",
                (key, value, source, confidence)
            )
        elif source == "inferred":
            existing = self.conn.execute(
                "SELECT occurrences, weight FROM user_preferences WHERE pref_key = ?", (key,)
            ).fetchone()
            if existing:
                new_weight = min(1.0, existing["weight"] + 0.1)
                self.conn.execute(
                    "UPDATE user_preferences SET pref_value=?, weight=?, occurrences=occurrences+1, last_reinforced=datetime('now') WHERE pref_key=?",
                    (value, new_weight, key)
                )
            else:
                self.conn.execute(
                    "INSERT INTO user_preferences (pref_key, pref_value, weight) VALUES (?, ?, 0.3)",
                    (key, value)
                )
        self.conn.commit()

    def get_model(self) -> dict:
        identity = {r["key"]: r["value"] for r in self.conn.execute("SELECT key, value FROM user_identity").fetchall()}
        prefs = {r["pref_key"]: {"value": r["pref_value"], "weight": r["weight"]}
                 for r in self.conn.execute("SELECT pref_key, pref_value, weight FROM user_preferences WHERE weight > 0.3").fetchall()}
        return {"identity": identity, "preferences": prefs}

    def get_context_prompt(self) -> str:
        model = self.get_model()
        lines = ["## User Context (Honcho Model)"]
        for k, v in model["identity"].items():
            lines.append(f"- {k}: {v}")
        if model["preferences"]:
            lines.append("- Preferences:")
            for k, v in model["preferences"].items():
                lines.append(f"  - {k}: {v['value']} (confidence: {v['weight']:.1%})")
        return "\n".join(lines)


# ── Agent Profile Loader ───────────────────────────────────────────────

class AgentProfileLoader:
    """Loads DevPulse agent profiles into Hermes-compatible roles."""

    AGENT_REGISTRY = {
        "00": ("PULSE-COMMAND", "master_orchestrator"),
        "01": ("CEO-STRATEGY", "leadership"),
        "02": ("CTO-ARCHITECT", "leadership"),
        "03": ("CPO-PRODUCT", "leadership"),
        "04": ("VP-ENGINEERING", "leadership"),
        "05": ("EM-DELIVERY", "management"),
        "06": ("QA-LEAD", "management"),
        "07": ("DEV-BACKEND", "development"),
        "08": ("DEV-FRONTEND", "development"),
        "09": ("DEV-VSCODE", "development"),
        "10": ("DEV-DATABASE", "development"),
        "11": ("DEV-API", "development"),
        "12": ("DEV-SECURITY", "development"),
        "13": ("DEV-DEVOPS", "development"),
        "14": ("DEV-FULLSTACK", "development"),
        "15": ("QA-TESTER", "specialized"),
        "16": ("DOCS-WRITER", "specialized"),
        "17": ("REVIEWER", "specialized"),
        "18": ("BUG-HUNTER", "specialized"),
        "19": ("OPS-RELEASE", "operations"),
        "20": ("OPS-MONITOR", "operations"),
        "22": ("AGENT-FACTORY", "autonomy"),
        "23": ("RESEARCH-ORCHESTRATOR", "autonomy"),
        "24": ("ERROR-RECOVERY", "autonomy"),
        "25": ("DEPENDENCY-GUARDIAN", "guardians"),
        "26": ("API-STEWARD", "guardians"),
        "27": ("COMPETITIVE-WATCH", "guardians"),
        "28": ("PERFORMANCE-AUDITOR", "guardians"),
    }

    @classmethod
    def get_all_profiles(cls) -> list[dict]:
        profiles = []
        for num, (name, category) in cls.AGENT_REGISTRY.items():
            profile_file = PROFILES_DIR / f"hermes_{num}-{name.lower().replace('-', '_')}.json"
            profiles.append({
                "number": num,
                "name": name,
                "category": category,
                "profile_file": profile_file,
                "prompt": cls._build_system_prompt(name, category),
            })
        return profiles

    @classmethod
    def _build_system_prompt(cls, name: str, category: str) -> str:
        return f"""You are {name}, a {category} agent in the DevPulse autonomous swarm.
You operate through the Hermes Agent Framework with self-improving skills.
You have access to SQLite FTS5 memory, Honcho user modeling, and Telegram/Slack gateways.
Execute your role autonomously. Generate new skills when you encounter novel tasks.
Report through the Hermes agent loop back to PULSE-COMMAND."""


# ── Skill Generation Engine ────────────────────────────────────────────

class SkillGenerator:
    """Dynamically generates executable Python skills from task patterns."""

    SKILL_TEMPLATE = '''"""
Hermes Auto-Generated Skill: {skill_name}
Generated: {timestamp}
Pattern: {pattern}
Category: {category}
"""

import json
from datetime import datetime
from pathlib import Path


def execute(
    task_description: str,
    context: dict | None = None,
    memory: object = None,
    **kwargs
) -> dict:
    """{docstring}

    Args:
        task_description: What to do
        context: Additional context dictionary
        memory: Hermes memory instance (for recall)
        **kwargs: Additional arguments

    Returns:
        dict with status, result, and metadata
    """
    start_time = datetime.now()

    try:
        # --- Skill Implementation ---
        # Generated based on observed pattern: {pattern}
        result = _core_logic(task_description, context, memory, **kwargs)
        # --- End Implementation ---

        elapsed = (datetime.now() - start_time).total_seconds()
        return {{
            "status": "success",
            "result": result,
            "skill": "{skill_name}",
            "elapsed_seconds": elapsed,
            "timestamp": datetime.now().isoformat()
        }}
    except Exception as e:
        return {{
            "status": "error",
            "error": str(e),
            "skill": "{skill_name}",
            "elapsed_seconds": (datetime.now() - start_time).total_seconds(),
            "timestamp": datetime.now().isoformat()
        }}


def _core_logic(
    task_description: str,
    context: dict | None,
    memory: object | None,
    **kwargs
) -> str:
    """Core implementation — replace this with actual logic."""
    # Auto-generated placeholder — will be refined through usage
    if memory:
        relevant = memory.recall_relevant(task_description, limit=3)
        if relevant:
            return f"Found relevant memories: {{len(relevant)}} items. Task: {{task_description}}"

    return f"Skill '{skill_name}' executed for: {{task_description}}"


# Skill metadata for registration
SKILL_META = {{
    "name": "{skill_name}",
    "pattern": "{pattern}",
    "category": "{category}",
    "version": 1,
    "generated": "{timestamp}",
    "signature": "execute(task_description: str, context: dict, memory: object, **kwargs) -> dict"
}}
'''

    def __init__(self, memory: HermesMemory):
        self.memory = memory
        self.patterns: dict[str, int] = {}

    def detect_pattern(self, task_description: str) -> str | None:
        keywords = {
            "web_search": ["search", "find", "lookup", "google", "web"],
            "file_operation": ["file", "read", "write", "create", "delete", "move", "copy"],
            "code_generation": ["code", "implement", "build", "create function", "write class"],
            "data_transform": ["convert", "transform", "parse", "extract", "format"],
            "api_interaction": ["api", "endpoint", "fetch", "request", "http", "curl"],
            "git_operation": ["git", "commit", "push", "pull", "branch", "merge", "pr"],
            "notification": ["notify", "alert", "remind", "send message", "message"],
            "analysis": ["analyze", "analysis", "audit", "review", "assess", "evaluate"],
            "documentation": ["document", "docs", "readme", "wiki", "guide"],
            "testing": ["test", "assert", "validate", "verify", "check"],
        }
        for pattern, kws in keywords.items():
            if any(kw in task_description.lower() for kw in kws):
                self.patterns[pattern] = self.patterns.get(pattern, 0) + 1
                return pattern
        return None

    def generate_skill(self, task_description: str, pattern: str, agent_name: str) -> Path:
        skill_name = f"{pattern}_{int(time.time())}"
        safe_name = skill_name.replace("-", "_").replace(" ", "_").lower()
        content = self.SKILL_TEMPLATE.format(
            skill_name=safe_name,
            timestamp=datetime.now().isoformat(),
            pattern=pattern,
            category=self._pattern_category(pattern),
            docstring=f"Auto-generated skill for: {task_description[:100]}",
        )
        filepath = SKILLS_DIR / f"{safe_name}.py"
        filepath.write_text(content, encoding="utf-8")

        self.memory.register_skill(safe_name, str(filepath))
        self.memory.store_memory(
            f"skill:{safe_name}",
            json.dumps({"file": str(filepath), "pattern": pattern, "trigger": task_description}),
            category="skill_registry",
            importance=0.7,
        )
        self.memory.log_learning(
            pattern=pattern,
            observation=f"Generated skill for: {task_description[:100]}",
            action=f"Created {filepath.name}",
            result=f"Skill registered as {safe_name}",
        )
        return filepath

    def _pattern_category(self, pattern: str) -> str:
        categories = {
            "web_search": "research",
            "file_operation": "filesystem",
            "code_generation": "development",
            "data_transform": "data",
            "api_interaction": "integration",
            "git_operation": "devops",
            "notification": "communication",
            "analysis": "analytics",
            "documentation": "docs",
            "testing": "quality",
        }
        return categories.get(pattern, "general")


# ── Main Agent Loop ────────────────────────────────────────────────────

class HermesAgent:
    """Core Hermes agent running the Sense → Think → Act loop."""

    def __init__(self):
        self.memory = HermesMemory()
        self.honcho = HonchoUserModel()
        self.profiles = AgentProfileLoader.get_all_profiles()
        self.skill_gen = SkillGenerator(self.memory)
        self.event_queue: asyncio.Queue[GatewayEvent] = asyncio.Queue()
        self.running = True
        self.iteration = 0
        self._pending_handoffs: dict[str, HandoffRequest] = {}
        self._hook_config: dict = {}
        self._sub_agent_tasks: dict[str, asyncio.Task] = {}
        self._pipeline_registry: dict[str, list[str]] = {}

        # Register SIGTERM handler
        signal.signal(signal.SIGINT, self._handle_shutdown)
        signal.signal(signal.SIGTERM, self._handle_shutdown)

    def _handle_shutdown(self, signum, frame):
        self.running = False
        self.memory.close()
        self.honcho.conn.close()

    async def start(self):
        """Start the Hermes agent loop and all gateways."""
        print("HERMES AGENT starting — Sense → Think → Act loop...")
        print(f"  Memory:   SQLite FTS5 @ {MEMORY_DB}")
        print(f"  Honcho:   User model @ {HONCHO_DB}")
        print(f"  Profiles: {len(self.profiles)} DevPulse agents loaded")
        print(f"  Skills:   {SKILLS_DIR} (auto-generated)")

        # Start gateways in background
        asyncio.create_task(self._gateway_telegram())
        asyncio.create_task(self._gateway_system_timers())
        asyncio.create_task(self._gateway_devpulse_bridge())
        asyncio.create_task(self._gateway_mcp())

        # Main loop
        while self.running:
            await self._tick()

    async def _tick(self):
        """One iteration of Sense → Think → Act."""
        self.iteration += 1

        try:
            event = await asyncio.wait_for(self.event_queue.get(), timeout=60.0)
        except asyncio.TimeoutError:
            return  # idle tick

        # Run pre-task hooks
        await self.run_hooks("pre_task", event)

        # SENSE: Record event
        self.memory.store_conversation(
            role="user" if event.source in ("telegram", "slack", "cli") else "system",
            content=event.content,
            agent=event.agent_target,
        )
        self.memory.conn.execute(
            "INSERT INTO events (source, event_type, content, agent_target, priority) VALUES (?,?,?,?,?)",
            (event.source, event.event_type, event.content, event.agent_target, event.priority),
        )
        self.memory.conn.commit()

        # Infer user preference
        self.honcho.set_preference(
            f"last_interaction_{event.source}",
            event.content[:100] if event.content else "",
            source="inferred",
        )

        # HANDLE: Handoff approval/rejection
        if event.event_type == "approve" and event.handoff_id:
            await self.approve_handoff(event.handoff_id, event.user_id)
            self.event_queue.task_done()
            return
        if event.event_type == "reject" and event.handoff_id:
            await self.reject_handoff(event.handoff_id, event.content)
            self.event_queue.task_done()
            return

        # HANDLE: PARL parallel sub-agent dispatch
        if event.subtasks and len(event.subtasks) > 1:
            results = await self.dispatch_sub_agents(event.subtasks, event)
            response_content = f"[Hermes/PARL] Dispatched {len(event.subtasks)} sub-agents in parallel."
            for r in results:
                response_content += f"\n  - {r.get('agent')}: {r.get('status')}"
            self.memory.store_conversation(role="assistant", content=response_content, agent="HERMES")
            self.memory.conn.commit()
            await self.run_hooks("post_task", event)
            self.event_queue.task_done()
            return

        # THINK: Detect pattern and route
        pattern = self.skill_gen.detect_pattern(event.content)
        existing = []
        if pattern:
            existing = self.memory.conn.execute(
                "SELECT skill_name FROM skills_registry WHERE skill_name LIKE ?", (f"{pattern}%",)
            ).fetchall()

        # ACT: Execute via LLM or generate skill
        if event.agent_target and event.event_type in ("task", "message"):
            llm_response = await asyncio.to_thread(
                self.execute_with_llm, event.agent_target, event.content
            )
            response_content = f"[Hermes/{event.agent_target}] {llm_response[:500]}"
            self.memory.store_conversation(role="assistant", content=llm_response, agent=event.agent_target)
            self.memory.conn.commit()
            self.event_queue.task_done()
            await self.run_hooks("post_task", event)
            return

        response_content = f"[Hermes] Iteration #{self.iteration}: Processed '{event.content[:80]}...'"
        if event.agent_target:
            response_content += f" → Routed to {event.agent_target}"

        if pattern and not existing:
            new_skill = self.skill_gen.generate_skill(event.content, pattern, event.agent_target or "PULSE-COMMAND")
            response_content += f"\n→ Generated new skill: {new_skill.name}"
            self.memory.record_skill_usage(new_skill.stem, True)
        elif pattern:
            skill_name = existing[0]["skill_name"]
            self.memory.record_skill_usage(skill_name, True)
            response_content += f"\n→ Used existing skill: {skill_name}"

        self.memory.store_conversation(role="assistant", content=response_content, agent="HERMES")
        self.memory.conn.commit()

        await self.run_hooks("post_task", event)
        self.event_queue.task_done()

    async def execute_with_llm(self, agent_name: str, task: str, context: str = "") -> str:
        """Execute a task using the LLM gateway with the agent's full system prompt."""
        try:
            from hermes.llm_gateway import invoke_llm
        except ImportError:
            return f"[LLM NOT AVAILABLE] Task queued for {agent_name}: {task[:120]}"

        system_prompt = self._load_agent_prompt(agent_name)

        if not system_prompt:
            system_prompt = AgentProfileLoader._build_system_prompt(agent_name, "development")

        user_prompt = f"TASK: {task}\n\nCONTEXT: {context}\n\nExecute this task now. Provide the exact code changes needed."

        response = invoke_llm(system_prompt, user_prompt, max_tokens=4096)

        self.memory.store_conversation(role="assistant", content=response, agent=agent_name)
        self.memory.conn.commit()

        return response

    def _load_agent_prompt(self, agent_name: str) -> str | None:
        """Load system prompt from agent markdown file."""
        for f in AGENTS_DIR.glob("*.md"):
            content = f.read_text(encoding="utf-8", errors="ignore")
            if agent_name.upper() in content.upper():
                lines = []
                capture = False
                for line in content.split("\n"):
                    if "## Identity" in line or "**Role**" in line:
                        capture = True
                    if capture:
                        lines.append(line)
                        if len("\n".join(lines)) > 3000:
                            break
                return "\n".join(lines)
        return None

    # ── Parallel Sub-Agent Dispatcher ────────────────────────────────

    async def dispatch_sub_agents(self, subtasks: list[dict], parent_event: GatewayEvent) -> list[dict]:
        """Spawn N sub-agents in parallel for PARL-style execution across independent subtasks."""
        results: list[dict] = []
        tasks: list[asyncio.Task] = []

        async def _run_sub_agent(task_def: dict) -> dict:
            agent_name = task_def.get("agent", "PULSE-COMMAND")
            prompt = task_def.get("prompt", "")
            task_id = task_def.get("id", f"sub_{int(time.time())}")

            sub_event = GatewayEvent(
                source=parent_event.source,
                event_type="task",
                content=prompt,
                agent_target=agent_name,
                priority=parent_event.priority,
            )
            self.memory.store_conversation(
                role="system",
                content=f"[PARL:{task_id}] {agent_name} ← {prompt[:120]}",
                agent=agent_name,
            )
            await self.event_queue.put(sub_event)
            return {
                "id": task_id,
                "agent": agent_name,
                "status": "dispatched",
                "prompt": prompt[:120],
            }

        for st in subtasks:
            tasks.append(asyncio.create_task(_run_sub_agent(st)))

        results = await asyncio.gather(*tasks, return_exceptions=True)
        return [r if not isinstance(r, Exception) else {"status": "error", "error": str(r)} for r in results]

    # ── Human Handoff with Blocking ───────────────────────────────────

    async def request_handoff(self, operation: str, description: str, agent: str,
                                file_paths: list[str] | None = None,
                                risk_level: str = "medium") -> HandoffRequest:
        """Request human approval for protected operations. Blocks the agent until approved/rejected."""
        h = HandoffRequest(
            id=f"handoff_{int(time.time())}",
            operation=operation,
            description=description,
            agent=agent,
            file_paths=file_paths or [],
            risk_level=risk_level,
        )

        if self.honcho.should_auto_approve(operation):
            h.approved = True
            h.approved_at = datetime.now(timezone.utc)
            h.approved_by = "auto-graduated-trust"
            self.honcho.record_decision(operation, True, agent)
            self.memory.store_memory(
                f"handoff:{h.id}", json.dumps({"operation": operation, "auto_approved": True}),
                category="handoffs", importance=0.9,
            )
            return h

        self._pending_handoffs[h.id] = h
        await self.event_queue.put(GatewayEvent(
            source="system",
            event_type="handoff",
            content=json.dumps({
                "handoff_id": h.id,
                "operation": operation,
                "description": description,
                "agent": agent,
                "files": h.file_paths,
                "risk": risk_level,
            }),
            priority=1,
            agent_target="PULSE-COMMAND",
            handoff_id=h.id,
        ))

        deadline = time.time() + h.timeout_seconds
        while h.approved is None and time.time() < deadline:
            await asyncio.sleep(2)

        if h.approved is None:
            h.approved = False
            self.memory.store_memory(f"handoff:{h.id}:timeout", operation, category="handoffs")

        self.honcho.record_decision(operation, h.approved, agent)
        self.memory.store_memory(
            f"handoff:{h.id}",
            json.dumps({"operation": operation, "approved": h.approved, "by": h.approved_by}),
            category="handoffs", importance=0.9,
        )
        return h

    async def approve_handoff(self, handoff_id: str, approved_by: str = "user"):
        if handoff_id in self._pending_handoffs:
            h = self._pending_handoffs[handoff_id]
            h.approved = True
            h.approved_at = datetime.now(timezone.utc)
            h.approved_by = approved_by

    async def reject_handoff(self, handoff_id: str, reason: str = ""):
        if handoff_id in self._pending_handoffs:
            h = self._pending_handoffs[handoff_id]
            h.approved = False
            h.approved_at = datetime.now(timezone.utc)
            h.approved_by = "user"
            self.memory.store_memory(f"handoff:{handoff_id}:rejected", reason, category="handoffs")

    # ── Event Hooks System ────────────────────────────────────────────

    def register_hook(self, trigger: str, callback: callable):
        """Register pre/post hooks for events. trigger: 'pre_task', 'post_task', 'on_error'."""
        self._hook_config.setdefault(trigger, []).append(callback)

    async def run_hooks(self, trigger: str, event: GatewayEvent):
        for cb in self._hook_config.get(trigger, []):
            try:
                if asyncio.iscoroutinefunction(cb):
                    await cb(event)
                else:
                    cb(event)
            except Exception:
                pass

    # ── Skill Pipeline ────────────────────────────────────────────────

    def load_pipeline(self, name: str, skill_sequence: list[str]):
        """Register a skill chain: web_search → scrape → synthesize."""
        self._pipeline_registry[name] = skill_sequence
        self.memory.store_memory(f"pipeline:{name}", json.dumps(skill_sequence), category="pipelines")

    async def run_pipeline(self, name: str, task_input: str, context: dict | None = None) -> dict:
        """Execute a registered skill chain, passing output of each as input to next."""
        sequence = self._pipeline_registry.get(name, [])
        if not sequence:
            return {"status": "error", "error": f"Pipeline '{name}' not found"}

        result = {"input": task_input}
        for skill_name in sequence:
            skill_file = SKILLS_DIR / f"{skill_name}.py"
            if not skill_file.exists():
                result = {"status": "error", "error": f"Skill '{skill_name}' not found", "pipeline": name}
                break

            ns = {}
            exec(skill_file.read_text(), ns)
            if "execute" in ns:
                step_result = ns["execute"](
                    task_description=result.get("result", task_input),
                    context=context,
                    memory=self.memory,
                )
                result = {"step": skill_name, "result": step_result.get("result", str(step_result))}
                self.memory.record_skill_usage(skill_name, step_result.get("status") == "success")
            else:
                result = {"status": "error", "error": f"Skill '{skill_name}' has no execute()", "pipeline": name}
                break

        return {"status": "success", "pipeline": name, "final_result": result, "steps_completed": len(sequence)}

    # ── Gateways ───────────────────────────────────────────────────────

    async def _gateway_telegram(self):
        """Telegram gateway stub — reads from hermes/gateways/telegram_gateway.py."""
        gateway_path = GATEWAYS_DIR / "telegram_gateway.py"
        if not gateway_path.exists():
            return
        # In full deployment, this would start python-telegram-bot polling
        # and push events into self.event_queue

    async def _gateway_system_timers(self):
        """System timer — periodic self-checks."""
        while self.running:
            await asyncio.sleep(300)  # every 5 minutes
            await self.event_queue.put(GatewayEvent(
                source="system",
                event_type="timer",
                content="heartbeat: check inbox, scan repos, verify agent health",
                priority=8,
            ))

    async def _gateway_devpulse_bridge(self):
        """Bridge between Hermes and DevPulse's .team/ system."""
        while self.running:
            await asyncio.sleep(60)
            inbox = DEVPULSE_ROOT / ".team" / "inbox"
            if inbox.exists():
                for f in sorted(inbox.glob("auto_*.json")):
                    try:
                        data = json.loads(f.read_text())
                        task = data.get("task", "")
                        if task:
                            await self.event_queue.put(GatewayEvent(
                                source="devpulse",
                                event_type="task",
                                content=task,
                                priority=data.get("priority", "MED") == "HIGH" and 3 or 6,
                            ))
                        f.unlink()
                    except Exception:
                        pass

    async def _gateway_mcp(self):
        """MCP (Model Context Protocol) server — expose Hermes tools to CommandCode."""
        mcp_config_path = DEVPULSE_ROOT / ".commandcode" / "mcp_config.json"
        if not mcp_config_path.exists():
            return
        try:
            config = json.loads(mcp_config_path.read_text())
        except Exception:
            return

        if not config.get("enabled", False):
            return

        print(f"[Hermes/MCP] MCP server mode active on port {config.get('port', 9400)}")
        tools = {
            "hermes_search": {
                "description": "Search Hermes FTS5 memory for past conversations and decisions.",
                "parameters": {"query": "string"},
            },
            "hermes_dispatch": {
                "description": "Dispatch a task to a DevPulse agent via Hermes.",
                "parameters": {"agent": "string", "task": "string"},
            },
            "hermes_handoff": {
                "description": "Check pending handoff requests needing human approval.",
                "parameters": {},
            },
            "hermes_approve": {
                "description": "Approve a pending handoff by ID.",
                "parameters": {"handoff_id": "string"},
            },
            "hermes_pipeline": {
                "description": "Run a registered skill pipeline by name.",
                "parameters": {"name": "string", "input": "string"},
            },
        }
        tools_json = json.dumps(tools, indent=2)
        mcp_config_path.write_text(json.dumps({**config, "tools": tools}, indent=2), encoding="utf-8")

        host = config.get("host", "127.0.0.1")
        port = config.get("port", 9400)

        async def handle_mcp(reader, writer):
            try:
                data = await asyncio.wait_for(reader.read(4096), timeout=10)
                request = json.loads(data.decode())
                method = request.get("method", "")
                params = request.get("params", {})

                if method == "tools/list":
                    response = {"tools": list(tools.values())}
                elif method == "tools/call":
                    tool_name = params.get("name", "")
                    if tool_name == "hermes_search":
                        results = self.memory.recall_relevant(params.get("query", ""), limit=5)
                        response = {"result": results}
                    elif tool_name == "hermes_dispatch":
                        await self.submit_task(params.get("task", ""), params.get("agent"))
                        response = {"result": "dispatched"}
                    elif tool_name == "hermes_handoff":
                        pending = {
                            hid: {"operation": h.operation, "description": h.description, "agent": h.agent}
                            for hid, h in self._pending_handoffs.items() if h.approved is None
                        }
                        response = {"result": pending}
                    elif tool_name == "hermes_approve":
                        hid = params.get("handoff_id", "")
                        if hid in self._pending_handoffs:
                            await self.approve_handoff(hid, "mcp")
                            response = {"result": f"Handoff {hid} approved"}
                        else:
                            response = {"error": f"Handoff {hid} not found"}
                    elif tool_name == "hermes_pipeline":
                        result = await self.run_pipeline(params.get("name", ""), params.get("input", ""))
                        response = {"result": result}
                    else:
                        response = {"error": f"Unknown tool: {tool_name}"}
                else:
                    response = {"error": f"Unknown method: {method}"}

                writer.write(json.dumps(response).encode())
                await writer.drain()
            except Exception as e:
                try:
                    writer.write(json.dumps({"error": str(e)}).encode())
                    await writer.drain()
                except Exception:
                    pass
            finally:
                writer.close()

        server = await asyncio.start_server(handle_mcp, host, port)
        async with server:
            await server.serve_forever()

    # ── Public API ──────────────────────────────────────────────────────

    async def submit_task(self, content: str, agent_target: str | None = None, source: str = "cli"):
        """Submit a task to the Hermes loop."""
        event = GatewayEvent(
            source=source,
            event_type="task",
            content=content,
            agent_target=agent_target,
        )
        await self.event_queue.put(event)

    async def submit_command(self, command: str, agent_target: str | None = None):
        """Submit a slash command."""
        event = GatewayEvent(
            source="cli",
            event_type="command",
            content=command,
            agent_target=agent_target,
            priority=2,  # high priority for commands
        )
        await self.event_queue.put(event)


# ── Entry Point ────────────────────────────────────────────────────────

async def main():
    agent = HermesAgent()
    await agent.start()


if __name__ == "__main__":
    asyncio.run(main())
