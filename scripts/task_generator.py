"""
DevPulse Global Task Generator — Works on ANY project, not just DevPulse.
Run from any repo root. Auto-discovers work using 7 autonomous scanners.
Usage: python task_generator.py [--path /path/to/repo] [--once]
"""
import os
import sys
import json
import glob
import subprocess
import argparse
from datetime import datetime, timezone
from pathlib import Path

GLOBAL_CONFIG = Path.home() / ".devpulse" / "projects.json"


def load_projects() -> list[str]:
    """Load all monitored project paths from global config."""
    if GLOBAL_CONFIG.exists():
        data = json.loads(GLOBAL_CONFIG.read_text(encoding="utf-8-sig"))
        return data.get("projects", [])
    return [os.getcwd()]


def save_projects(projects: list[str]):
    """Save monitored project paths to global config."""
    GLOBAL_CONFIG.parent.mkdir(parents=True, exist_ok=True)
    GLOBAL_CONFIG.write_text(json.dumps({"projects": list(set(projects)), "updated": datetime.now(timezone.utc).isoformat()}, indent=2))


def discover_projects() -> list[str]:
    """Auto-discover all git repos in common dev directories."""
    projects = set()
    search_roots = [
        Path.home() / "dev",
        Path.home() / "projects",
        Path.home() / "Downloads",
        Path.home() / "Documents",
    ]
    for root in search_roots:
        if not root.exists():
            continue
        for item in root.rglob(".git"):
            if item.is_dir() and "node_modules" not in str(item):
                projects.add(str(item.parent))
    return sorted(projects)


def scan_repo(repo_path: str) -> list[dict]:
    """Run all 7 scanners on a single repo."""
    tasks = []
    rp = Path(repo_path)

    # Source 1: Uncommitted changes
    try:
        r = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True, cwd=repo_path, timeout=10)
        if r.stdout.strip():
            files = [l[3:].strip() for l in r.stdout.strip().split("\n") if l.strip()]
            tasks.append({"source": "git", "task": f"Commit {len(files)} changed files in {rp.name}", "priority": "HIGH", "project": rp.name})
    except: pass

    # Source 2: Open PRs
    try:
        r = subprocess.run(["gh", "pr", "list", "--state", "open", "--limit", "5", "--json", "title,number"], capture_output=True, text=True, cwd=repo_path, timeout=10)
        if r.stdout.strip() and r.stdout.strip() != "[]":
            prs = json.loads(r.stdout)
            for pr in prs:
                tasks.append({"source": "github", "task": f"Review PR #{pr['number']}: {pr['title']}", "priority": "HIGH", "project": rp.name})
    except: pass

    # Source 3: TODOs in code
    try:
        for pattern in ["**/*.py", "**/*.ts", "**/*.tsx", "**/*.js", "**/*.md"]:
            for file in rp.glob(pattern):
                if "node_modules" in str(file) or ".git" in str(file) or "__pycache__" in str(file):
                    continue
                try:
                    content = file.read_text(encoding="utf-8", errors="ignore")
                    if "TODO" in content or "FIXME" in content or "HACK" in content:
                        tasks.append({"source": "todo", "task": f"Resolve TODOs in {file.relative_to(rp)}", "priority": "MED", "project": rp.name})
                        break
                except: pass
    except: pass

    # Source 4: Untested code
    try:
        for file in rp.glob("**/*.ts"):
            if "node_modules" in str(file) or ".test." in file.name or ".spec." in file.name:
                continue
            test_name = file.stem
            test_dir = file.parent / "__tests__"
            if not (test_dir / f"{test_name}.test.ts").exists() and not (file.parent / f"{test_name}.test.ts").exists():
                tasks.append({"source": "untested", "task": f"Write tests for {file.relative_to(rp)}", "priority": "LOW", "project": rp.name})
                break
    except: pass

    # Source 5: Dependency issues
    for lockfile in ["package.json", "requirements.txt", "pyproject.toml", "Cargo.toml", "go.mod"]:
        lf = rp / lockfile
        if not lf.exists():
            continue
        try:
            if lockfile == "package.json":
                r = subprocess.run(["npm", "outdated", "--json"], capture_output=True, text=True, cwd=repo_path, timeout=30)
                if r.stdout.strip() and r.stdout.strip() != "{}":
                    outdated = json.loads(r.stdout)
                    tasks.append({"source": "deps", "task": f"Update {len(outdated)} outdated npm packages in {rp.name}", "priority": "MED", "project": rp.name})
                r2 = subprocess.run(["npm", "audit", "--json"], capture_output=True, text=True, cwd=repo_path, timeout=30)
                if r2.stdout.strip():
                    audit = json.loads(r2.stdout)
                    vulns = audit.get("vulnerabilities", {})
                    high = {k: v for k, v in vulns.items() if v.get("severity") in ("high", "critical")}
                    if high:
                        tasks.append({"source": "security", "task": f"Fix {len(high)} high/critical vulns in {rp.name}", "priority": "HIGH", "project": rp.name})
            break
        except: pass

    # Source 6: Documentation gaps
    try:
        code_files = list(rp.glob("**/*.ts")) + list(rp.glob("**/*.py")) + list(rp.glob("**/*.rs"))
        readme = rp / "README.md"
        if readme.exists() and len(code_files) > 10:
            readme_size = readme.stat().st_size
            if readme_size < 500:
                tasks.append({"source": "docs", "task": f"Expand README.md in {rp.name} (currently {readme_size} bytes)", "priority": "LOW", "project": rp.name})
    except: pass

    # Source 7: Agent queue depth (DevPulse inbox)
    try:
        inbox = rp / ".team" / "inbox"
        if inbox.exists():
            pending = list(inbox.glob("auto_*.json"))
            if len(pending) > 5:
                tasks.append({"source": "queue", "task": f"Process {len(pending)} queued tasks in {rp.name}", "priority": "HIGH", "project": rp.name})
    except: pass

    return tasks


def scan_all_projects(projects: list[str]) -> list[dict]:
    """Scan all monitored projects and collect tasks."""
    all_tasks = []
    for proj in projects:
        if not os.path.exists(proj):
            continue
        tasks = scan_repo(proj)
        all_tasks.extend(tasks)
    return all_tasks


def write_tasks(tasks: list[dict], target_project: str = None):
    """Write discovered tasks to inbox for the target project or DevPulse."""
    project_path = target_project or str(Path.home() / ".devpulse")
    inbox = Path(project_path) / ".team" / "inbox"
    inbox.mkdir(parents=True, exist_ok=True)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    for i, task in enumerate(tasks[:20]):
        task["timestamp"] = datetime.now(timezone.utc).isoformat()
        fpath = inbox / f"auto_{ts}_{i}.json"
        fpath.write_text(json.dumps(task, indent=2))


def main():
    parser = argparse.ArgumentParser(description="DevPulse Universal Task Generator")
    parser.add_argument("--path", help="Scan a specific project path")
    parser.add_argument("--once", action="store_true", help="Run once instead of continuous")
    parser.add_argument("--watch", help="Add a project to monitored list")
    parser.add_argument("--discover", action="store_true", help="Auto-discover all git repos")
    parser.add_argument("--list", action="store_true", help="List monitored projects")
    args = parser.parse_args()

    # --- Command: watch ---
    if args.watch:
        watch_path = os.path.abspath(args.watch)
        projects = load_projects()
        if watch_path not in projects:
            projects.append(watch_path)
            save_projects(projects)
            print(f"Now watching: {watch_path}")
        else:
            print(f"Already watching: {watch_path}")
        return

    # --- Command: discover ---
    if args.discover:
        found = discover_projects()
        projects = load_projects()
        new_count = 0
        for p in found:
            if p not in projects:
                projects.append(p)
                new_count += 1
        save_projects(projects)
        print(f"Discovered {len(found)} repos, added {new_count} new")
        for p in projects:
            print(f"  {p}")
        return

    # --- Command: list ---
    if args.list:
        projects = load_projects()
        print(f"Monitored projects ({len(projects)}):")
        for p in projects:
            exists = "EXISTS" if os.path.exists(p) else "MISSING"
            print(f"  [{exists}] {p}")
        return

    # --- Default: scan ---
    projects = [args.path] if args.path else load_projects()
    tasks = scan_all_projects(projects)

    if tasks:
        write_tasks(tasks, target_project=projects[0] if len(projects) == 1 else None)
        print(f"Discovered {len(tasks)} tasks across {len(projects)} project(s):")
        for t in tasks:
            print(f"  [{t['priority']:4s}] [{t['project']:20s}] {t['source']:10s} -> {t['task'][:100]}")
    else:
        print(f"No tasks found across {len(projects)} project(s).")

    if args.once:
        return

    # Continuous mode
    import time
    print("\nContinuous mode — scanning every 5 minutes (Ctrl+C to stop)")
    while True:
        time.sleep(300)
        tasks = scan_all_projects(load_projects())
        if tasks:
            write_tasks(tasks)
            print(f"[{datetime.now().strftime('%H:%M:%S')}] {len(tasks)} new tasks discovered")


if __name__ == "__main__":
    main()
