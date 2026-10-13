"""
AI Security Engine — Pillar 1 of the DevPulse v4.0 Platform.

Provides:
- Token / secret leak detection across code & config
- AI agent attack surface scanning (prompt injection, SSRF via agents, etc.)
- OWASP API Top 10 (2023) automated checks
- AI-powered fix suggestions via Groq LLM
- Composite security scoring

Falls back to static analysis when Groq API key is unavailable.
"""
import os
import re
import json
import hashlib
import logging
import time
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ── Groq integration (optional) ────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# ── Token / Secret patterns ─────────────────────────────────────────────────
TOKEN_PATTERNS: List[Dict[str, Any]] = [
    {"id": "TK-001", "name": "OpenAI API Key", "severity": "critical",
     "pattern": r"sk-[a-zA-Z0-9]{20,}T3BlbkFJ[a-zA-Z0-9]{20,}",
     "provider": "openai"},
    {"id": "TK-002", "name": "OpenAI Project Key", "severity": "critical",
     "pattern": r"sk-proj-[a-zA-Z0-9_\-]{40,}",
     "provider": "openai"},
    {"id": "TK-003", "name": "Anthropic API Key", "severity": "critical",
     "pattern": r"sk-ant-api[a-zA-Z0-9\-]{30,}",
     "provider": "anthropic"},
    {"id": "TK-004", "name": "Google AI / Gemini Key", "severity": "critical",
     "pattern": r"AIza[a-zA-Z0-9_\-]{35}",
     "provider": "google"},
    {"id": "TK-005", "name": "AWS Access Key ID", "severity": "critical",
     "pattern": r"AKIA[A-Z0-9]{16}",
     "provider": "aws"},
    {"id": "TK-006", "name": "AWS Secret Key", "severity": "critical",
     "pattern": r"(?:aws_secret_access_key|AWS_SECRET)\s*[=:]\s*['\"]?[A-Za-z0-9/+=]{40}",
     "provider": "aws"},
    {"id": "TK-007", "name": "Stripe Secret Key", "severity": "critical",
     "pattern": r"sk_(?:live|test)_[a-zA-Z0-9]{24,}",
     "provider": "stripe"},
    {"id": "TK-008", "name": "GitHub Token", "severity": "critical",
     "pattern": r"(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}",
     "provider": "github"},
    {"id": "TK-009", "name": "Groq API Key", "severity": "critical",
     "pattern": r"gsk_[a-zA-Z0-9]{20,}",
     "provider": "groq"},
    {"id": "TK-010", "name": "Hugging Face Token", "severity": "high",
     "pattern": r"hf_[a-zA-Z0-9]{30,}",
     "provider": "huggingface"},
    {"id": "TK-011", "name": "Generic Bearer Token", "severity": "high",
     "pattern": r"(?:bearer|Bearer|BEARER)\s+[a-zA-Z0-9_\-.]{20,}",
     "provider": "generic"},
    {"id": "TK-012", "name": "Private Key Block", "severity": "critical",
     "pattern": r"-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----",
     "provider": "generic"},
    {"id": "TK-013", "name": "Hardcoded Password", "severity": "high",
     "pattern": r"(?:password|passwd|pwd|secret)\s*[=:]\s*['\"][^'\"]{8,}['\"]",
     "provider": "generic"},
    {"id": "TK-014", "name": "Connection String", "severity": "critical",
     "pattern": r"(?:postgres|mysql|mongodb(?:\+srv)?|redis)://[^\s'\"]{10,}",
     "provider": "generic"},
]

# ── AI Agent attack patterns ────────────────────────────────────────────────
AGENT_ATTACK_PATTERNS: List[Dict[str, Any]] = [
    {"id": "AG-001", "name": "Prompt Injection via User Input",
     "severity": "critical",
     "pattern": r"(?:user_input|user_message|prompt)\s*(?:\+|\.format|%|f['\"])",
     "description": "User input directly concatenated into LLM prompt — vulnerable to prompt injection.",
     "fix": "Use a prompt template with input sanitization and output validation."},
    {"id": "AG-002", "name": "Unrestricted Tool Use",
     "severity": "high",
     "pattern": r"(?:tools?\s*=\s*\[.*?\]|functions?\s*=\s*\[.*?\])",
     "description": "LLM agent has access to tools without access control.",
     "fix": "Implement allowlists and user-scoped permissions for tool calls."},
    {"id": "AG-003", "name": "Agent SSRF / Unvalidated Fetch",
     "severity": "critical",
     "pattern": r"(?:agent|tool|function).*(?:requests\.get|httpx\.get|fetch|urlopen)\s*\(",
     "description": "AI agent can make arbitrary HTTP requests — potential SSRF.",
     "fix": "Restrict agent HTTP calls to an allowlisted set of domains."},
    {"id": "AG-004", "name": "Agent Code Execution",
     "severity": "critical",
     "pattern": r"(?:exec|eval|compile)\s*\(.*(?:response|output|result|agent)",
     "description": "LLM output is passed to exec/eval — remote code execution risk.",
     "fix": "Never execute LLM output directly. Use sandboxed interpreters."},
    {"id": "AG-005", "name": "Missing Output Validation",
     "severity": "high",
     "pattern": r"return\s+(?:response|completion|result)\.(?:text|content|choices)",
     "description": "LLM output returned without validation or sanitization.",
     "fix": "Validate LLM output against expected schema before returning."},
    {"id": "AG-006", "name": "Excessive Token Budget",
     "severity": "medium",
     "pattern": r"max_tokens\s*[=:]\s*(?:\d{5,}|None|null)",
     "description": "Very large or unlimited token budget may cause cost explosion.",
     "fix": "Set reasonable max_tokens limits per request and per user."},
    {"id": "AG-007", "name": "No Rate Limiting on AI Calls",
     "severity": "high",
     "pattern": r"(?:openai|anthropic|groq|gemini).*(?:create|complete|generate)\s*\(",
     "description": "AI API calls without visible rate limiting.",
     "fix": "Add per-user rate limiting and cost budgets for AI API calls."},
]

# ── OWASP API Security Top 10 (2023) ───────────────────────────────────────
OWASP_API_2023: List[Dict[str, Any]] = [
    {"id": "OWASP-01", "category": "API1:2023", "name": "Broken Object Level Authorization",
     "pattern": r"(?:GET|DELETE|PUT|PATCH)\s+.*\{(?:id|user_id|account_id)\}",
     "description": "Object IDs in URL without authorization check."},
    {"id": "OWASP-02", "category": "API2:2023", "name": "Broken Authentication",
     "pattern": r"(?:verify|authenticate)\s*=\s*(?:False|false|None|null)",
     "description": "Authentication disabled or bypassed."},
    {"id": "OWASP-03", "category": "API3:2023", "name": "Broken Object Property Level Authorization",
     "pattern": r"\*\*(?:request|body|data)\.(?:dict|model_dump)\(\)",
     "description": "Mass assignment — all request fields passed to model."},
    {"id": "OWASP-04", "category": "API4:2023", "name": "Unrestricted Resource Consumption",
     "pattern": r"(?:limit|page_size|batch)\s*[=:]\s*(?:int\(|request\.)",
     "description": "User-controlled pagination/batch size without bounds."},
    {"id": "OWASP-05", "category": "API5:2023", "name": "Broken Function Level Authorization",
     "pattern": r"@app\.(?:delete|put)\s*\(.*admin",
     "description": "Admin endpoints without role checks."},
    {"id": "OWASP-06", "category": "API6:2023", "name": "Unrestricted Access to Sensitive Business Flows",
     "pattern": r"(?:transfer|withdraw|purchase|refund).*(?:amount|quantity)\s*=",
     "description": "Sensitive business operation without rate/fraud controls."},
    {"id": "OWASP-07", "category": "API7:2023", "name": "Server-Side Request Forgery (SSRF)",
     "pattern": r"(?:get|post|fetch|request)\s*\(\s*(?:url|uri|target|endpoint)\s*\)",
     "description": "Request to user-supplied URL without validation."},
    {"id": "OWASP-08", "category": "API8:2023", "name": "Security Misconfiguration",
     "pattern": r"(?:CORS|cors).*\*|(?:DEBUG|debug)\s*=\s*(?:True|true)",
     "description": "Wildcard CORS or debug mode in production."},
    {"id": "OWASP-09", "category": "API9:2023", "name": "Improper Inventory Management",
     "pattern": r"/api/v[0-9]+/.*(?:deprecated|old|legacy|internal)",
     "description": "Deprecated or shadow API endpoints still accessible."},
    {"id": "OWASP-10", "category": "API10:2023", "name": "Unsafe Consumption of APIs",
     "pattern": r"(?:json|data)\s*=\s*(?:response|r)\.json\(\)\s*$",
     "description": "External API response consumed without validation."},
]


# ═══════════════════════════════════════════════════════════════════════════════
# SCANNING ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

def _run_patterns(code: str, patterns: List[Dict[str, Any]], category: str) -> List[Dict[str, Any]]:
    """Run a list of regex patterns against code, return findings."""
    findings: List[Dict[str, Any]] = []
    lines = code.split("\n")
    for rule in patterns:
        pat = re.compile(rule["pattern"], re.IGNORECASE)
        for lineno, line in enumerate(lines, 1):
            for match in pat.finditer(line):
                findings.append({
                    "rule_id": rule["id"],
                    "name": rule["name"],
                    "category": category,
                    "severity": rule.get("severity", "medium"),
                    "line": lineno,
                    "column": match.start() + 1,
                    "matched_text": match.group()[:120],
                    "description": rule.get("description", ""),
                    "fix": rule.get("fix", rule.get("description", "")),
                })
    return findings


def scan_token_leaks(code: str) -> Dict[str, Any]:
    """Scan code for leaked tokens, secrets, and credentials."""
    findings = _run_patterns(code, TOKEN_PATTERNS, "token_leak")
    providers_affected = list({f.get("provider", "unknown") for f in
                               [{"provider": p.get("provider")} for p in TOKEN_PATTERNS
                                for f2 in findings if f2["rule_id"] == p["id"]]
                               if f.get("provider")})
    # Simpler approach
    provider_set = set()
    for f in findings:
        for p in TOKEN_PATTERNS:
            if f["rule_id"] == p["id"]:
                provider_set.add(p["provider"])
    return {
        "scan_type": "token_leak",
        "findings": findings,
        "total": len(findings),
        "providers_affected": sorted(provider_set),
        "critical_count": sum(1 for f in findings if f["severity"] == "critical"),
    }


def scan_agent_attacks(code: str) -> Dict[str, Any]:
    """Scan for AI agent-specific attack vectors."""
    findings = _run_patterns(code, AGENT_ATTACK_PATTERNS, "agent_attack")
    return {
        "scan_type": "agent_attack",
        "findings": findings,
        "total": len(findings),
        "critical_count": sum(1 for f in findings if f["severity"] == "critical"),
        "high_count": sum(1 for f in findings if f["severity"] == "high"),
    }


def scan_owasp_api(code: str) -> Dict[str, Any]:
    """Scan for OWASP API Security Top 10 (2023) issues."""
    findings = _run_patterns(code, OWASP_API_2023, "owasp_api_2023")
    categories_hit = list({f["rule_id"] for f in findings})
    return {
        "scan_type": "owasp_api_2023",
        "findings": findings,
        "total": len(findings),
        "categories_hit": categories_hit,
        "coverage": f"{10 - len(categories_hit)}/10 clean",
    }


def full_security_scan(code: str, language: str = "python") -> Dict[str, Any]:
    """Run all scans and compute composite score + grade."""
    start = time.time()
    token_result = scan_token_leaks(code)
    agent_result = scan_agent_attacks(code)
    owasp_result = scan_owasp_api(code)

    all_findings = (
        token_result["findings"]
        + agent_result["findings"]
        + owasp_result["findings"]
    )

    # Compute score (100 = perfect, deduct per severity)
    severity_weights = {"critical": 25, "high": 15, "medium": 8, "low": 3}
    penalty = sum(severity_weights.get(f["severity"], 5) for f in all_findings)
    score = max(0, 100 - penalty)

    grade = (
        "A+" if score >= 97 else
        "A"  if score >= 90 else
        "B"  if score >= 75 else
        "C"  if score >= 60 else
        "D"  if score >= 40 else
        "F"
    )

    return {
        "score": score,
        "grade": grade,
        "total_threats": len(all_findings),
        "critical_count": sum(1 for f in all_findings if f["severity"] == "critical"),
        "high_count": sum(1 for f in all_findings if f["severity"] == "high"),
        "medium_count": sum(1 for f in all_findings if f["severity"] == "medium"),
        "low_count": sum(1 for f in all_findings if f["severity"] == "low"),
        "token_leaks": token_result,
        "agent_attacks": agent_result,
        "owasp_api": owasp_result,
        "all_findings": all_findings,
        "language": language,
        "scan_duration_ms": round((time.time() - start) * 1000, 2),
        "scanned_at": datetime.now(timezone.utc).isoformat(),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# AI FIX SUGGESTIONS (via Groq LLM, with static fallback)
# ═══════════════════════════════════════════════════════════════════════════════

async def generate_fix_suggestions(findings: List[Dict[str, Any]], code: str) -> List[Dict[str, Any]]:
    """
    Generate AI-powered fix suggestions for security findings.
    Falls back to static suggestions when Groq key is not available.
    """
    if not findings:
        return []

    # Static fallback suggestions
    suggestions: List[Dict[str, Any]] = []
    for f in findings[:10]:  # Cap at 10
        suggestions.append({
            "rule_id": f["rule_id"],
            "severity": f["severity"],
            "title": f.get("name", f.get("rule_id")),
            "description": f.get("description", ""),
            "fix_recommendation": f.get("fix", "Review and remediate this finding."),
            "line": f.get("line"),
            "ai_generated": False,
        })

    # Try Groq-powered suggestions
    if GROQ_API_KEY and len(GROQ_API_KEY) > 10:
        try:
            import httpx
            top_critical = [f for f in findings if f["severity"] in ("critical", "high")][:5]
            if not top_critical:
                top_critical = findings[:3]

            prompt = (
                "You are a senior API security engineer. For each finding below, "
                "provide a specific, actionable fix with a corrected code snippet.\n\n"
                "Findings:\n"
                + json.dumps(top_critical, indent=2)
                + "\n\nOriginal code (first 2000 chars):\n"
                + code[:2000]
                + "\n\nRespond in JSON array format: "
                '[{"rule_id": "...", "fix_code": "...", "explanation": "..."}]'
            )

            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                    json={
                        "model": "llama-3.3-70b-versatile",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.2,
                        "max_tokens": 2000,
                    },
                )
                if resp.status_code == 200:
                    content = resp.json()["choices"][0]["message"]["content"]
                    # Extract JSON from response
                    json_match = re.search(r"\[.*\]", content, re.DOTALL)
                    if json_match:
                        ai_fixes = json.loads(json_match.group())
                        for afix in ai_fixes:
                            for s in suggestions:
                                if s["rule_id"] == afix.get("rule_id"):
                                    s["fix_code"] = afix.get("fix_code", "")
                                    s["explanation"] = afix.get("explanation", "")
                                    s["ai_generated"] = True
        except Exception as exc:
            logger.warning(f"Groq AI fix generation failed: {exc}")

    return suggestions


# ═══════════════════════════════════════════════════════════════════════════════
# THREAT FEED (simulated real-time intelligence)
# ═══════════════════════════════════════════════════════════════════════════════

def get_threat_feed() -> List[Dict[str, Any]]:
    """
    Return recent AI/API threat intelligence.
    In production this would pull from CVE feeds, GitHub advisories, etc.
    """
    return [
        {
            "id": "THREAT-2025-001",
            "title": "OpenAI API key exposure in npm packages",
            "severity": "critical",
            "source": "GitHub Advisory",
            "date": "2025-01-15",
            "affected_providers": ["openai"],
            "description": "Multiple npm packages found leaking OpenAI API keys via environment variable logging.",
            "mitigation": "Audit dependencies for env logging. Rotate affected keys immediately.",
        },
        {
            "id": "THREAT-2025-002",
            "title": "Prompt injection via RAG context poisoning",
            "severity": "high",
            "source": "OWASP LLM Top 10",
            "date": "2025-01-12",
            "affected_providers": ["openai", "anthropic", "google"],
            "description": "Attackers injecting malicious instructions into documents ingested by RAG pipelines.",
            "mitigation": "Implement input sanitization on RAG document ingestion and output validation.",
        },
        {
            "id": "THREAT-2025-003",
            "title": "Claude API token leaked via CI logs",
            "severity": "critical",
            "source": "Internal Detection",
            "date": "2025-01-10",
            "affected_providers": ["anthropic"],
            "description": "CI/CD pipeline printing API tokens in build output when verbose logging is enabled.",
            "mitigation": "Mask secrets in CI output. Use vault-based secret injection.",
        },
        {
            "id": "THREAT-2025-004",
            "title": "LLM agent SSRF via tool-use search function",
            "severity": "high",
            "source": "Bug Bounty Report",
            "date": "2025-01-08",
            "affected_providers": ["openai", "anthropic"],
            "description": "AI agents with web search tools can be tricked into accessing internal network endpoints.",
            "mitigation": "Implement URL allowlisting for all agent tool HTTP calls.",
        },
        {
            "id": "THREAT-2025-005",
            "title": "Gemini API cost explosion via recursive agent loops",
            "severity": "medium",
            "source": "Community Report",
            "date": "2025-01-05",
            "affected_providers": ["google"],
            "description": "Agent loops causing unbounded API calls and unexpected billing spikes.",
            "mitigation": "Set max iteration limits and per-session cost caps for AI agents.",
        },
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# API INVENTORY SCANNER
# ═══════════════════════════════════════════════════════════════════════════════

def scan_api_inventory(code: str) -> Dict[str, Any]:
    """
    Discover AI/API provider usage in code.
    Returns a list of detected providers with usage patterns.
    """
    provider_patterns = [
        {"provider": "OpenAI", "pattern": r"(?:openai|OpenAI|OPENAI)", "type": "ai"},
        {"provider": "Anthropic", "pattern": r"(?:anthropic|Anthropic|claude)", "type": "ai"},
        {"provider": "Google AI", "pattern": r"(?:google\.generativeai|gemini|palm)", "type": "ai"},
        {"provider": "Groq", "pattern": r"(?:groq|Groq|GROQ)", "type": "ai"},
        {"provider": "Hugging Face", "pattern": r"(?:huggingface|transformers|HfApi)", "type": "ai"},
        {"provider": "Cohere", "pattern": r"(?:cohere|Cohere)", "type": "ai"},
        {"provider": "AWS Bedrock", "pattern": r"(?:bedrock|boto3.*bedrock)", "type": "ai"},
        {"provider": "Azure OpenAI", "pattern": r"(?:azure\..*openai|AzureOpenAI)", "type": "ai"},
        {"provider": "Stripe", "pattern": r"(?:stripe|Stripe)", "type": "payment"},
        {"provider": "Twilio", "pattern": r"(?:twilio|Twilio)", "type": "communication"},
        {"provider": "SendGrid", "pattern": r"(?:sendgrid|SendGrid)", "type": "email"},
        {"provider": "Firebase", "pattern": r"(?:firebase|Firebase)", "type": "cloud"},
        {"provider": "Supabase", "pattern": r"(?:supabase|Supabase)", "type": "cloud"},
    ]

    inventory: List[Dict[str, Any]] = []
    lines = code.split("\n")

    for pp in provider_patterns:
        pat = re.compile(pp["pattern"])
        usages = []
        for lineno, line in enumerate(lines, 1):
            if pat.search(line):
                usages.append({"line": lineno, "snippet": line.strip()[:100]})
        if usages:
            inventory.append({
                "provider": pp["provider"],
                "type": pp["type"],
                "usage_count": len(usages),
                "locations": usages[:5],  # cap at 5
            })

    return {
        "total_providers": len(inventory),
        "ai_providers": sum(1 for i in inventory if i["type"] == "ai"),
        "other_providers": sum(1 for i in inventory if i["type"] != "ai"),
        "inventory": inventory,
    }
