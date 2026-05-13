"""
DevPulse Integration Recipe Library — Reusable prompts and workflows for common integrations.
Extracted from rashi-ide's 70+ competitor prompts and ecosystem patterns.
"""
import json
from pathlib import Path

RECIPES_DIR = Path(__file__).resolve().parent.parent / "hermes" / "recipes"
RECIPES_DIR.mkdir(parents=True, exist_ok=True)

RECIPES = {
    "stripe_integration": {
        "title": "Stripe Payment Integration",
        "description": "Add Stripe checkout, webhooks, and subscription management",
        "agents": ["DEV-BACKEND", "DEV-FRONTEND", "DEV-SECURITY"],
        "pipeline": "code_review_flow",
        "prompt": """Implement Stripe payment integration:
1. Create checkout session endpoint (server/api/stripe/)
2. Add Stripe webhook handler with signature verification
3. Create subscription management page (devpulse-frontend/app/billing/)
4. Implement pricing tiers from PRODUCT_ROADMAP.md
5. Add PCI compliance checks
6. Write webhook tests with mock Stripe service""",
        "handoff_required": True,
        "handoff_operations": ["stripe_config", "package_change"],
    },
    "auth_flow": {
        "title": "OAuth/SSO Authentication Flow",
        "description": "Add OAuth provider, JWT management, and session handling",
        "agents": ["DEV-BACKEND", "DEV-SECURITY", "DEV-DATABASE"],
        "pipeline": "security_audit",
        "prompt": """Implement authentication flow:
1. Add JWT middleware with refresh token rotation
2. Create OAuth provider integration (Google/GitHub)
3. Add session management with Redis
4. Implement RBAC guard middleware
5. Add rate limiting on auth endpoints
6. Write auth integration tests covering all flows""",
        "handoff_required": True,
        "handoff_operations": ["security_rule", "package_change"],
    },
    "ai_api_integration": {
        "title": "AI Provider API Integration",
        "description": "Integrate OpenAI/Anthropic/Google AI APIs with guardrails",
        "agents": ["DEV-BACKEND", "DEV-API", "DEV-SECURITY"],
        "pipeline": "code_review_flow",
        "prompt": """Integrate AI provider APIs:
1. Create unified AI client abstraction (server/services/ai/)
2. Add OpenAI/Anthropic/Google provider implementations
3. Implement prompt guardrails and content safety
4. Add cost tracking per provider
5. Create tRPC router for AI endpoints
6. Write provider mock tests""",
    },
    "database_migration": {
        "title": "Database Migration Runner",
        "description": "Safe database migrations with backup and rollback",
        "agents": ["DEV-DATABASE", "DEV-DEVOPS", "REVIEWER"],
        "prompt": """Run database migration safely:
1. Create backup snapshot
2. Generate migration via Drizzle
3. Run migration on staging first
4. Verify data integrity
5. Promote to production after 15min monitoring
6. Document migration in changelog""",
        "handoff_required": True,
        "handoff_operations": ["db_migration", "deployment"],
    },
    "security_audit_full": {
        "title": "Full Security Audit",
        "description": "Complete OWASP Top 10 audit with remediation",
        "agents": ["DEV-SECURITY", "DEPENDENCY-GUARDIAN", "PERFORMANCE-AUDITOR"],
        "pipeline": "security_audit",
        "prompt": """Run complete security audit:
1. npm audit + Snyk scan for dependency vulns
2. SAST scan on all TypeScript files
3. CSP and security header audit
4. Rate limiting and brute-force protection check
5. SQL injection and XSS scan
6. Secret detection (hardcoded keys, tokens)
7. Generate remediation report with priority levels""",
    },
    "performance_tune": {
        "title": "Performance Tuning Sprint",
        "description": "Identify and fix performance bottlenecks",
        "agents": ["PERFORMANCE-AUDITOR", "DEV-BACKEND", "DEV-DATABASE"],
        "prompt": """Run performance tuning:
1. Profile server endpoint latencies
2. Find N+1 queries (database query analysis)
3. Check bundle sizes (frontend chunk analysis)
4. Audit cache hit rates
5. Load test top 5 endpoints
6. Document before/after metrics""",
    },
    "dependency_upgrade": {
        "title": "Dependency Version Upgrade",
        "description": "Safe major version upgrades with compatibility checks",
        "agents": ["DEPENDENCY-GUARDIAN", "QA-TESTER", "DEV-DEVOPS"],
        "pipeline": "code_review_flow",
        "prompt": """Upgrade dependencies safely:
1. npm outdated — list all outdated packages
2. Group upgrades by semver (patch/minor/major)
3. Upgrade patch + minor together, test
4. Upgrade major one at a time, test each
5. Run full test suite after each upgrade
6. Check for breaking API changes
7. Auto-merge if all tests pass""",
    },
    "competitor_analysis": {
        "title": "Competitor Analysis Deep Dive",
        "description": "Multi-platform competitor scan with differentiation analysis",
        "agents": ["COMPETITIVE-WATCH", "CEO-STRATEGY", "RESEARCH-ORCHESTRATOR"],
        "pipeline": "competitor_brief",
        "prompt": """Run competitor analysis:
1. Scan Helicone, Lakera, Portkey, LangSmith, Datadog, AWS Bedrock
2. Compare pricing, features, API design
3. Analyze market positioning and recent changes
4. Identify gaps in our offering vs competitors
5. Generate differentiation recommendations
6. Create executive brief with action items""",
    },
    "codebase_onboarding": {
        "title": "Project Onboarding Scan",
        "description": "Complete new project analysis for agent context",
        "agents": ["RESEARCH-ORCHESTRATOR", "DEPENDENCY-GUARDIAN", "DOCS-WRITER"],
        "pipeline": "onboarding_scan",
        "prompt": """Onboard a new project:
1. Generate DEVPULSE.md with stack detection
2. Scan dependencies and audit for vulns
3. Calculate test coverage baseline
4. Find documentation gaps
5. Map codebase structure
6. Generate onboarding guide for new agents""",
    },
    "release_prep": {
        "title": "Release Preparation Checklist",
        "description": "Complete pre-release validation workflow",
        "agents": ["QA-TESTER", "REVIEWER", "OPS-RELEASE", "OPS-MONITOR"],
        "pipeline": "release_pipeline",
        "prompt": """Prepare release:
1. Run full test suite (unit + integration + E2E)
2. Check all PRs are merged or closed
3. Generate changelog from merged PRs
4. Bump version following semver
5. Create release branch
6. Deploy to staging, run smoke tests
7. Monitor staging for 15 minutes
8. Promote to production (requires handoff approval)""",
        "handoff_required": True,
        "handoff_operations": ["deployment"],
    },
    "docs_refresh": {
        "title": "Documentation Refresh",
        "description": "Regenerate all project documentation from code",
        "agents": ["DOCS-WRITER", "DEV-API"],
        "prompt": """Refresh documentation:
1. Generate API docs from tRPC routers
2. Update README with latest features
3. Generate architecture diagrams
4. Update changelog with recent changes
5. Regenerate CODE_OF_CONDUCT, CONTRIBUTING, LICENSE
6. Verify all links are valid""",
    },
    "test_coverage_sprint": {
        "title": "Test Coverage Sprint",
        "description": "Identify and fill test coverage gaps",
        "agents": ["QA-TESTER", "QA-LEAD"],
        "prompt": """Improve test coverage:
1. Find .ts files without .test.ts counterparts
2. Identify low-coverage modules (< 60%)
3. Generate tests for untested code paths
4. Add edge case tests for critical paths
5. Run existing tests to verify no regressions
6. Report final coverage numbers""",
    },
}


def save_recipes():
    recipes_path = RECIPES_DIR / "integration_recipes.json"
    recipes_path.write_text(json.dumps(RECIPES, indent=2))
    return recipes_path


def list_recipes() -> list[str]:
    return [
        f"  {key:<25} {RECIPES[key]['title']}"
        for key in sorted(RECIPES.keys())
    ]


def get_recipe(name: str) -> dict | None:
    return RECIPES.get(name)


if __name__ == "__main__":
    path = save_recipes()
    print(f"Saved {len(RECIPES)} integration recipes to {path}")
    print("\nAvailable recipes:")
    for line in list_recipes():
        print(line)
