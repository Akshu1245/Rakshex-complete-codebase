"""
Security Scanner Service - OWASP-based vulnerability detection.

Scans code for common vulnerabilities (OWASP Top 10) with pattern matching.
Also scans API configurations for security issues.
Results are persisted to DB.
"""
import re
import json
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# OWASP Top 10 vulnerability rules
VULNERABILITY_RULES = [
    # A01: Broken Access Control
    {"id": "A01-001", "owasp": "A01:2021", "severity": "critical", "title": "Hardcoded API Key",
     "pattern": r'(?:api[_-]?key|apikey|secret[_-]?key)\s*[=:]\s*["\'][a-zA-Z0-9_\-]{16,}["\']',
     "description": "Hardcoded API key detected", "recommendation": "Use environment variables for secrets"},
    {"id": "A01-002", "owasp": "A01:2021", "severity": "critical", "title": "Hardcoded Password",
     "pattern": r'(?:password|passwd|pwd)\s*[=:]\s*["\'][^"\']{4,}["\']',
     "description": "Hardcoded password detected", "recommendation": "Use a secrets manager or env vars"},
    {"id": "A01-003", "owasp": "A01:2021", "severity": "high", "title": "Path Traversal Risk",
     "pattern": r'(?:open|read|write|load)\s*\([^)]*\.\./',
     "description": "Potential path traversal", "recommendation": "Validate and sanitize file paths"},
    # A02: Cryptographic Failures
    {"id": "A02-001", "owasp": "A02:2021", "severity": "high", "title": "HTTP URL (No TLS)",
     "pattern": r'http://(?!localhost|127\.0\.0\.1|0\.0\.0\.0)',
     "description": "Non-TLS HTTP URL detected", "recommendation": "Use HTTPS for all external endpoints"},
    {"id": "A02-002", "owasp": "A02:2021", "severity": "high", "title": "Weak Hash Algorithm",
     "pattern": r'(?:md5|sha1)\s*\(', "description": "Weak hash algorithm (MD5/SHA1) used",
     "recommendation": "Use SHA-256+ or bcrypt for passwords"},
    {"id": "A02-003", "owasp": "A02:2021", "severity": "medium", "title": "SSL Verify Disabled",
     "pattern": r'verify\s*=\s*False|SSL_VERIFY\s*=\s*False|rejectUnauthorized\s*:\s*false',
     "description": "SSL verification disabled", "recommendation": "Enable SSL certificate verification"},
    # A03: Injection
    {"id": "A03-001", "owasp": "A03:2021", "severity": "critical", "title": "SQL Injection Risk",
     "pattern": r'(?:execute|query|raw)\s*\(\s*(?:f["\']|["\'].*%s|["\'].*\+\s*\w)',
     "description": "Potential SQL injection via string formatting",
     "recommendation": "Use parameterized queries / prepared statements"},
    {"id": "A03-002", "owasp": "A03:2021", "severity": "critical", "title": "Command Injection Risk",
     "pattern": r'(?:os\.system|subprocess\.call|exec|eval)\s*\([^)]*(?:input|request|params|args)',
     "description": "Potential command injection", "recommendation": "Use subprocess with shell=False and validate inputs"},
    {"id": "A03-003", "owasp": "A03:2021", "severity": "high", "title": "XSS Risk",
     "pattern": r'(?:innerHTML|outerHTML|document\.write|v-html)\s*[=]',
     "description": "Potential XSS via unsafe HTML insertion",
     "recommendation": "Use textContent or sanitize HTML with DOMPurify"},
    # A04: Insecure Design
    {"id": "A04-001", "owasp": "A04:2021", "severity": "medium", "title": "No Error Handling",
     "pattern": r'except\s*:\s*(?:pass|\.\.\.)|catch\s*\(\s*\)\s*\{?\s*\}',
     "description": "Silent exception swallowing detected",
     "recommendation": "Log errors and handle them gracefully"},
    # A05: Security Misconfiguration
    {"id": "A05-001", "owasp": "A05:2021", "severity": "high", "title": "Debug Mode Enabled",
     "pattern": r'(?:DEBUG|debug)\s*[=:]\s*(?:True|true|1|"true")',
     "description": "Debug mode enabled", "recommendation": "Disable debug mode in production"},
    {"id": "A05-002", "owasp": "A05:2021", "severity": "medium", "title": "Wildcard CORS",
     "pattern": r'(?:Access-Control-Allow-Origin|cors_origins?)\s*[=:]\s*["\']?\*',
     "description": "Wildcard CORS origin", "recommendation": "Restrict CORS to specific trusted domains"},
    # A07: Auth Failures
    {"id": "A07-001", "owasp": "A07:2021", "severity": "high", "title": "JWT Secret Hardcoded",
     "pattern": r'(?:jwt|JWT).*(?:secret|SECRET)\s*[=:]\s*["\'][^"\']{4,}["\']',
     "description": "Hardcoded JWT secret", "recommendation": "Load JWT secrets from environment"},
    # A08: Software Integrity
    {"id": "A08-001", "owasp": "A08:2021", "severity": "high", "title": "Unsafe Deserialization",
     "pattern": r'(?:pickle\.loads?|yaml\.load\s*\((?!.*Loader)|marshal\.loads?)\s*\(',
     "description": "Unsafe deserialization", "recommendation": "Use safe loaders (yaml.safe_load, json)"},
    # A10: SSRF
    {"id": "A10-001", "owasp": "A10:2021", "severity": "high", "title": "SSRF Risk",
     "pattern": r'(?:requests\.get|httpx\.get|fetch|urllib\.request\.urlopen)\s*\(\s*(?:input|request|params|user)',
     "description": "Potential SSRF with user-controlled URL",
     "recommendation": "Validate and whitelist URLs before fetching"},
]


def scan_code(code: str, language: str = "python") -> Dict[str, Any]:
    """Scan code for security vulnerabilities."""
    vulnerabilities: List[Dict[str, Any]] = []
    lines = code.split("\n")

    for rule in VULNERABILITY_RULES:
        pattern = re.compile(rule["pattern"], re.IGNORECASE)
        for i, line in enumerate(lines):
            matches = pattern.finditer(line)
            for match in matches:
                vulnerabilities.append({
                    "rule_id": rule["id"],
                    "owasp_category": rule["owasp"],
                    "severity": rule["severity"],
                    "title": rule["title"],
                    "description": rule["description"],
                    "line_number": i + 1,
                    "matched_text": match.group()[:100],
                    "recommendation": rule["recommendation"],
                })

    # Compute score
    severity_weights = {"critical": 25, "high": 15, "medium": 8, "low": 3}
    penalty = sum(severity_weights.get(v["severity"], 5) for v in vulnerabilities)
    score = max(0, min(100, 100 - penalty))
    grade = "A" if score >= 90 else "B" if score >= 75 else "C" if score >= 60 else "D" if score >= 40 else "F"

    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for v in vulnerabilities:
        counts[v["severity"]] = counts.get(v["severity"], 0) + 1

    # Unique recommendations
    recommendations = list(dict.fromkeys(v["recommendation"] for v in vulnerabilities))

    return {
        "status": "success", "score": score, "grade": grade,
        "total_issues": len(vulnerabilities), **counts,
        "vulnerabilities": vulnerabilities,
        "recommendations": recommendations[:10],
        "language": language,
    }


def scan_api_config(url: str, headers: Dict[str, str] = None) -> Dict[str, Any]:
    """Scan an API configuration for security issues."""
    issues = []

    if url.startswith("http://") and not any(x in url for x in ("localhost", "127.0.0.1", "0.0.0.0")):
        issues.append({"severity": "high", "issue": "API endpoint uses HTTP instead of HTTPS",
                        "fix": "Use HTTPS for all API endpoints"})

    if headers:
        auth_header = headers.get("Authorization", "")
        if auth_header and not auth_header.startswith("Bearer "):
            issues.append({"severity": "medium", "issue": "Non-standard authorization header format",
                            "fix": "Use Bearer token authentication"})
        for key, val in headers.items():
            if any(s in key.lower() for s in ("key", "secret", "token", "password")):
                if len(val) < 16:
                    issues.append({"severity": "high", "issue": f"Short credential in header '{key}'",
                                    "fix": "Use strong, randomly generated credentials (32+ chars)"})

    score = max(0, 100 - len(issues) * 20)
    return {
        "status": "success", "is_secure": len(issues) == 0,
        "score": score, "issues": issues,
        "scanned_url": url,
    }
