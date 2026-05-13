"""
DevPulse Cross-Project Skill Sharing — Skills learned in one project auto-propagate to others.
Stores a global skill DB at ~/.devpulse/shared_skills/ that all projects read from.
"""
import json
import shutil
import time
from datetime import datetime
from pathlib import Path


DEV_HOME = Path.home() / ".devpulse"
SHARED_SKILLS = DEV_HOME / "shared_skills"
SHARED_DB = SHARED_SKILLS / "shared_skills.json"
SHARED_SKILLS.mkdir(parents=True, exist_ok=True)


def init_shared_db():
    if not SHARED_DB.exists():
        SHARED_DB.write_text(json.dumps({
            "version": 1,
            "created": datetime.now().isoformat(),
            "skills": {},
            "projects": [],
        }, indent=2))


def register_project(project_path: str):
    db = json.loads(SHARED_DB.read_text())
    if project_path not in db["projects"]:
        db["projects"].append(project_path)
        db["projects"].sort()
    SHARED_DB.write_text(json.dumps(db, indent=2))


def share_skill(skill_name: str, skill_file: Path, source_project: str,
                pattern: str = "", category: str = "general"):
    """Share a skill from one project to the global skill DB."""
    init_shared_db()
    db = json.loads(SHARED_DB.read_text())

    # Copy skill file
    dest = SHARED_SKILLS / skill_file.name
    shutil.copy2(skill_file, dest)

    db["skills"][skill_name] = {
        "file": str(dest.relative_to(SHARED_SKILLS)),
        "source_project": source_project,
        "pattern": pattern,
        "category": category,
        "shared_at": datetime.now().isoformat(),
        "version": db["skills"].get(skill_name, {}).get("version", 0) + 1,
        "usage_count": db["skills"].get(skill_name, {}).get("usage_count", 0),
    }
    SHARED_DB.write_text(json.dumps(db, indent=2))
    register_project(source_project)
    return dest


def import_shared_skills(target_project: str, target_skills_dir: Path) -> int:
    """Import all shared skills into a project's skills directory."""
    init_shared_db()
    db = json.loads(SHARED_DB.read_text())
    count = 0

    for skill_name, meta in db["skills"].items():
        source = SHARED_SKILLS / meta["file"]
        if not source.exists():
            continue
        dest = target_skills_dir / meta["file"]
        if not dest.exists():
            shutil.copy2(source, dest)
            count += 1

    register_project(target_project)
    return count


def list_shared_skills() -> list[dict]:
    init_shared_db()
    db = json.loads(SHARED_DB.read_text())
    return [
        {"name": name, **meta}
        for name, meta in sorted(db["skills"].items(),
                                 key=lambda x: x[1].get("usage_count", 0), reverse=True)
    ]


def record_shared_skill_usage(skill_name: str, success: bool):
    init_shared_db()
    db = json.loads(SHARED_DB.read_text())
    if skill_name in db["skills"]:
        db["skills"][skill_name]["usage_count"] = db["skills"][skill_name].get("usage_count", 0) + 1
        if not success:
            db["skills"][skill_name]["last_failure"] = datetime.now().isoformat()
        SHARED_DB.write_text(json.dumps(db, indent=2))


def get_migration_summary() -> str:
    init_shared_db()
    db = json.loads(SHARED_DB.read_text())
    projects = db.get("projects", [])
    skills = db.get("skills", {})
    total_usage = sum(s.get("usage_count", 0) for s in skills.values())

    lines = [
        "## Cross-Project Skill Sharing",
        f"**Projects**: {len(projects)}",
        f"**Shared Skills**: {len(skills)}",
        f"**Total Usages**: {total_usage}",
        "",
        "### Top Skills",
    ]
    for s in list_shared_skills()[:5]:
        lines.append(f"- **{s['name']}** ({s.get('usage_count', 0)} uses, from {s.get('source_project', 'unknown')})")

    if projects:
        lines.append("\n### Connected Projects")
        for p in projects:
            lines.append(f"- `{p}`")

    return "\n".join(lines)


if __name__ == "__main__":
    init_shared_db()
    print(get_migration_summary())
