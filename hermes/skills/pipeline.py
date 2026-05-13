"""
Hermes Skill Pipeline — Chain skills together in versioned workflows.
Example: web_search → web_scrape → summarize → store_memory
"""
import json
import time
from datetime import datetime
from pathlib import Path

SKILLS_DIR = Path(__file__).resolve().parent
MANIFEST_FILE = SKILLS_DIR / "pipeline_manifest.json"

DEFAULT_PIPELINES = {
    "research_web": {
        "version": 1,
        "steps": ["web_search", "web_scrape", "summarize"],
        "description": "Search web → scrape top results → synthesize summary",
        "success_rate": 0.0,
        "usage_count": 0,
        "created": "2026-05-13",
    },
    "competitor_brief": {
        "version": 1,
        "steps": ["competitor_scan", "web_scrape", "analyze_diff", "summarize"],
        "description": "Scan 6 competitors → scrape details → diff analysis → brief",
        "success_rate": 0.0,
        "usage_count": 0,
        "created": "2026-05-13",
    },
    "security_audit": {
        "version": 1,
        "steps": ["dep_scan", "vuln_check", "code_analyze", "summarize"],
        "description": "Dependency scan → vulnerability check → code analysis → report",
        "success_rate": 0.0,
        "usage_count": 0,
        "created": "2026-05-13",
    },
    "code_review_flow": {
        "version": 1,
        "steps": ["lint_check", "type_check", "test_run", "review_merge"],
        "description": "Lint → type check → run tests → review and auto-merge if green",
        "success_rate": 0.0,
        "usage_count": 0,
        "created": "2026-05-13",
    },
    "release_pipeline": {
        "version": 1,
        "steps": ["version_bump", "changelog", "build", "deploy_staging", "smoke_test", "deploy_prod"],
        "description": "Full CI/CD release pipeline: bump → changelog → build → stage → smoke → prod",
        "success_rate": 0.0,
        "usage_count": 0,
        "created": "2026-05-13",
    },
    "onboarding_scan": {
        "version": 1,
        "steps": ["repo_scan", "dep_audit", "test_coverage", "doc_gaps", "summarize"],
        "description": "New project scan: repo structure → deps → test coverage → doc gaps → report",
        "success_rate": 0.0,
        "usage_count": 0,
        "created": "2026-05-13",
    },
}


def load_manifest() -> dict:
    if MANIFEST_FILE.exists():
        return json.loads(MANIFEST_FILE.read_text())
    return DEFAULT_PIPELINES


def save_manifest(data: dict):
    MANIFEST_FILE.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_FILE.write_text(json.dumps(data, indent=2))


def register_pipeline(name: str, steps: list[str], description: str = "") -> dict:
    manifest = load_manifest()
    manifest[name] = {
        "version": manifest.get(name, {}).get("version", 0) + 1,
        "steps": steps,
        "description": description,
        "success_rate": manifest.get(name, {}).get("success_rate", 0.0),
        "usage_count": manifest.get(name, {}).get("usage_count", 0),
        "created": str(datetime.now().date()),
    }
    save_manifest(manifest)
    return manifest[name]


def record_pipeline_result(name: str, success: bool):
    manifest = load_manifest()
    if name not in manifest:
        return
    p = manifest[name]
    p["usage_count"] = p.get("usage_count", 0) + 1
    old_rate = p.get("success_rate", 0.0)
    old_count = max(p.get("usage_count", 1) - 1, 1)
    p["success_rate"] = round((old_rate * old_count + (1.0 if success else 0.0)) / (old_count + 1), 3)
    save_manifest(manifest)


def retire_pipeline(name: str):
    """Move low-success pipelines to retired list."""
    manifest = load_manifest()
    if name in manifest:
        retired = manifest.setdefault("_retired", {})
        retired[name] = manifest.pop(name)
        retired[name]["retired_at"] = str(datetime.now().date())
        save_manifest(manifest)


def list_pipelines(active_only: bool = True) -> list[dict]:
    manifest = load_manifest()
    result = []
    for name, p in manifest.items():
        if name.startswith("_"):
            continue
        if p.get("success_rate", 0.0) < 0.3 and p.get("usage_count", 0) > 5:
            if active_only:
                continue
        result.append({"name": name, **p})
    return sorted(result, key=lambda x: x.get("success_rate", 0.0), reverse=True)


def chunk_pipeline_metadata() -> str:
    """Return concise pipeline metadata for agent context injection."""
    manifest = load_manifest()
    lines = ["## Available Skill Pipelines"]
    for name, p in manifest.items():
        if name.startswith("_"):
            continue
        lines.append(f"- **{name}** (v{p.get('version', 1)}, {p.get('success_rate', 0):.0%} success): "
                      f"{' → '.join(p.get('steps', []))}")
    return "\n".join(lines)


# Initialize manifest on import
if not MANIFEST_FILE.exists():
    save_manifest(DEFAULT_PIPELINES)
