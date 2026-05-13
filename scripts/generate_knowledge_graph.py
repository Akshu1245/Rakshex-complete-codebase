"""
DevPulse Knowledge Graph Generator — Adds ## TL;DR + ## Related sections to all agent .md files.
Builds cross-links between agents so PULSE-COMMAND can route tasks in milliseconds.
"""
import re
from pathlib import Path

DEVPULSE_ROOT = Path(__file__).resolve().parent.parent
AGENTS_DIR = DEVPULSE_ROOT / "agents"

AGENT_META = {
    "00-master-orchestrator.md": {
        "tldr": "Autonomous master orchestrator. Self-starts on boot. Discovers work across all projects, prioritizes via RICE, dispatches to 28 agents, learns continuously. Never waits to be told.",
        "related": ["01-ceo-strategy", "02-cto-architect", "22-agent-factory", "23-research-orchestrator", "24-error-recovery"],
        "layer": "command",
    },
    "01-ceo-strategy.md": {
        "tldr": "Vision, roadmap, competitive positioning. Owns product strategy, market analysis, OKRs, pricing. Does not write code — makes decisions about what to build and why.",
        "related": ["00-master-orchestrator", "02-cto-architect", "03-cpo-product", "27-competitive-watch"],
        "layer": "leadership",
    },
    "02-cto-architect.md": {
        "tldr": "Technical decisions, architecture, tech debt. Owns system design, technology selection, code quality standards. Reviews all architectural changes.",
        "related": ["00-master-orchestrator", "01-ceo-strategy", "04-vp-engineering", "07-dev-backend", "25-dependency-guardian"],
        "layer": "leadership",
    },
    "03-cpo-product.md": {
        "tldr": "Feature design, user stories, UX. Owns product requirements, user research, feature prioritization. Translates vision into buildable specs.",
        "related": ["00-master-orchestrator", "01-ceo-strategy", "04-vp-engineering", "08-dev-frontend", "11-dev-api"],
        "layer": "leadership",
    },
    "04-vp-engineering.md": {
        "tldr": "Sprint planning, velocity, resource allocation. Owns engineering execution, team capacity, delivery timelines. Translates roadmap into sprint plans.",
        "related": ["00-master-orchestrator", "02-cto-architect", "05-em-delivery", "06-qa-lead"],
        "layer": "leadership",
    },
    "05-em-delivery.md": {
        "tldr": "Daily task coordination, PR flow, blockers. Owns execution pipeline — assigns work, tracks progress, resolves blockers, reports status.",
        "related": ["00-master-orchestrator", "04-vp-engineering", "07-dev-backend", "08-dev-frontend", "17-reviewer"],
        "layer": "management",
    },
    "06-qa-lead.md": {
        "tldr": "Test strategy, quality gates, coverage. Owns testing infrastructure, QA processes, quality metrics. Ensures nothing ships broken.",
        "related": ["00-master-orchestrator", "04-vp-engineering", "15-qa-tester", "17-reviewer", "18-bug-hunter"],
        "layer": "management",
    },
    "07-dev-backend.md": {
        "tldr": "server/ Express, tRPC, services. Owns backend implementation, API logic, middleware, database access layer. Primary backend developer.",
        "related": ["02-cto-architect", "05-em-delivery", "10-dev-database", "11-dev-api", "13-dev-devops"],
        "layer": "development",
    },
    "08-dev-frontend.md": {
        "tldr": "devpulse-frontend/ Next.js, React, Tailwind. Owns frontend implementation, UI components, client-side state. Primary frontend developer.",
        "related": ["03-cpo-product", "05-em-delivery", "11-dev-api", "14-dev-fullstack", "16-docs-writer"],
        "layer": "development",
    },
    "09-dev-vscode.md": {
        "tldr": "devpulse-vscode/ Extension, webviews. Owns VSCode extension development, editor integration, tree views, diagnostics panel.",
        "related": ["05-em-delivery", "07-dev-backend", "08-dev-frontend", "14-dev-fullstack"],
        "layer": "development",
    },
    "10-dev-database.md": {
        "tldr": "drizzle/ Schema, migrations, MySQL. Owns database design, ORM layer, query optimization, migration safety.",
        "related": ["02-cto-architect", "07-dev-backend", "13-dev-devops", "28-performance-auditor"],
        "layer": "development",
    },
    "11-dev-api.md": {
        "tldr": "server/api/ tRPC routers, contracts. Owns API design, endpoint contracts, input validation, OpenAPI specs.",
        "related": ["02-cto-architect", "07-dev-backend", "08-dev-frontend", "26-api-steward"],
        "layer": "development",
    },
    "12-dev-security.md": {
        "tldr": "Scanners, injection prevention, secrets. Owns security infrastructure — SAST, CSP, rate limiting, authentication, secret rotation.",
        "related": ["02-cto-architect", "07-dev-backend", "25-dependency-guardian", "26-api-steward"],
        "layer": "development",
    },
    "13-dev-devops.md": {
        "tldr": "Docker, CI/CD, deployment, infra. Owns infrastructure — containers, pipelines, cloud config, monitoring setup.",
        "related": ["02-cto-architect", "07-dev-backend", "19-ops-release", "20-ops-monitor"],
        "layer": "development",
    },
    "14-dev-fullstack.md": {
        "tldr": "Cross-layer features, integration. Owns features spanning frontend+backend+DB. Bridges gaps between specialized dev agents.",
        "related": ["05-em-delivery", "07-dev-backend", "08-dev-frontend", "10-dev-database", "11-dev-api"],
        "layer": "development",
    },
    "15-qa-tester.md": {
        "tldr": "Unit tests (Vitest), E2E (Playwright). Owns test coverage, regression suite, flaky test detection, test generation for untested code.",
        "related": ["06-qa-lead", "07-dev-backend", "08-dev-frontend", "18-bug-hunter"],
        "layer": "specialized",
    },
    "16-docs-writer.md": {
        "tldr": "README, API docs, architecture, wiki. Owns all documentation — generates from code, maintains freshness, writes onboarding guides.",
        "related": ["05-em-delivery", "07-dev-backend", "08-dev-frontend", "11-dev-api"],
        "layer": "specialized",
    },
    "17-reviewer.md": {
        "tldr": "PR reviews, code quality, standards. Owns code review process — reviews all PRs, enforces style guides, catches bugs pre-merge.",
        "related": ["05-em-delivery", "06-qa-lead", "07-dev-backend", "08-dev-frontend"],
        "layer": "specialized",
    },
    "18-bug-hunter.md": {
        "tldr": "Bug finding, root cause, regression tests. Owns bug detection and fixing — traces errors, writes reproduction steps, adds prevention.",
        "related": ["06-qa-lead", "15-qa-tester", "20-ops-monitor", "24-error-recovery"],
        "layer": "specialized",
    },
    "19-ops-release.md": {
        "tldr": "Versioning, changelogs, release management. Owns release pipeline — semantic versioning, release notes, deployment coordination.",
        "related": ["13-dev-devops", "20-ops-monitor", "04-vp-engineering"],
        "layer": "operations",
    },
    "20-ops-monitor.md": {
        "tldr": "Sentry, Prometheus, health, incidents. Owns observability — monitors all services, detects anomalies, triggers incident response.",
        "related": ["13-dev-devops", "19-ops-release", "18-bug-hunter", "24-error-recovery"],
        "layer": "operations",
    },
    "22-agent-factory.md": {
        "tldr": "Spawns, clones, splits, retires agents. Owns team scaling — creates specialized agents on demand, splits overloaded domains, retires stale agents.",
        "related": ["00-master-orchestrator", "02-cto-architect", "23-research-orchestrator", "24-error-recovery"],
        "layer": "autonomy",
    },
    "23-research-orchestrator.md": {
        "tldr": "Gap analysis, discovery, competitive intel. Owns work discovery — scans all 7 sources continuously, feeds backlog to PULSE-COMMAND.",
        "related": ["00-master-orchestrator", "01-ceo-strategy", "22-agent-factory", "27-competitive-watch"],
        "layer": "autonomy",
    },
    "24-error-recovery.md": {
        "tldr": "Error tracking, root cause, auto-retry. Owns failure recovery — traces errors, maps blast radius, auto-retries, escalates if stuck.",
        "related": ["00-master-orchestrator", "18-bug-hunter", "20-ops-monitor", "22-agent-factory"],
        "layer": "autonomy",
    },
    "25-dependency-guardian.md": {
        "tldr": "Supply chain security, version alignment, vuln audits. Owns dependency safety — monitors CVEs, aligns versions, audits licenses.",
        "related": ["12-dev-security", "02-cto-architect", "13-dev-devops", "28-performance-auditor"],
        "layer": "guardians",
    },
    "26-api-steward.md": {
        "tldr": "tRPC/OpenAPI contract stability, breaking change detection. Owns API contracts — monitors for breaking changes, validates schemas, enforces compatibility.",
        "related": ["11-dev-api", "12-dev-security", "02-cto-architect", "07-dev-backend"],
        "layer": "guardians",
    },
    "27-competitive-watch.md": {
        "tldr": "Continuous competitor monitoring, weekly briefs. Owns competitive intelligence — tracks Helicone/Lakera/Portkey/LangSmith/Datadog/AWS.",
        "related": ["01-ceo-strategy", "03-cpo-product", "23-research-orchestrator"],
        "layer": "guardians",
    },
    "28-performance-auditor.md": {
        "tldr": "Gateway latency, N+1 queries, load testing, regression gates. Owns performance — profiles bottlenecks, runs load tests, sets regression baselines.",
        "related": ["10-dev-database", "07-dev-backend", "13-dev-devops", "20-ops-monitor"],
        "layer": "guardians",
    },
}


def strip_existing_tldr(content: str) -> str:
    """Remove existing ## TL;DR and ## Related sections if they exist."""
    content = re.sub(r'\n## TL;DR\n.*?(?=\n## )', '', content, flags=re.DOTALL)
    content = re.sub(r'\n## Related\n.*?(?=\n## |$)', '', content, flags=re.DOTALL)
    return content.strip()


def add_sections(filepath: Path, meta: dict) -> bool:
    content = filepath.read_text(encoding="utf-8")
    content = strip_existing_tldr(content)

    tldr_section = f"\n\n## TL;DR\n\n{meta['tldr']}"
    related_links = "\n".join(f"- `{r}` — {AGENT_META.get(r.replace('-', '.md'), {}).get('tldr', '').split('.')[0] if r in [f.replace('.md', '') for f in AGENT_META] else 'see file'}"
                              for r in meta["related"])
    related_section = f"\n\n## Related\n\n{related_links}"

    # Find insertion point — after ## Identity or ## Role section, before next ## heading
    content += tldr_section + related_section + "\n"

    ## Wait, we need to be smarter. Let me append at end.
    content = strip_existing_tldr(content)
    content += tldr_section + related_section + "\n"

    filepath.write_text(content, encoding="utf-8")
    return True


def generate_knowledge_graph() -> dict:
    """Generate the full knowledge graph as JSON."""
    graph = {"nodes": {}, "edges": []}
    for filename, meta in AGENT_META.items():
        agent_id = filename.replace(".md", "")
        graph["nodes"][agent_id] = {
            "layer": meta["layer"],
            "tldr": meta["tldr"].split(".")[0],
        }
        for related in meta["related"]:
            graph["edges"].append({"from": agent_id, "to": related})
    return graph


def main():
    graph = generate_knowledge_graph()
    graph_path = DEVPULSE_ROOT / "agents" / "KNOWLEDGE_GRAPH.json"
    graph_path.write_text(json.dumps(graph, indent=2))
    print(f"Knowledge graph written: {graph_path} ({len(graph['nodes'])} nodes, {len(graph['edges'])} edges)")

    count = 0
    for filename, meta in AGENT_META.items():
        filepath = AGENTS_DIR / filename
        if filepath.exists():
            content = filepath.read_text(encoding="utf-8")
            if "## TL;DR" in content and "## Related" in content:
                continue
            content = strip_existing_tldr(content)
            content += f"\n\n## TL;DR\n\n{meta['tldr']}"
            related_links = "\n".join(f"- `{r}`"
                                      for r in meta["related"])
            content += f"\n\n## Related\n\n{related_links}\n"
            filepath.write_text(content, encoding="utf-8")
            count += 1
            print(f"  Updated: {filename}")
        else:
            print(f"  SKIP (not found): {filename}")

    print(f"\nDone. Updated {count} agent files with TL;DR + Related sections.")


import json
if __name__ == "__main__":
    main()
