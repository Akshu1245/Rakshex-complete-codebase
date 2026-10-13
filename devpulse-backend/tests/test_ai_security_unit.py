"""
Tests for AI Security Engine service (unit tests).
Tests the pure functions without HTTP layer.
"""
import pytest
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.ai_security_engine import (
    scan_token_leaks,
    scan_agent_attacks,
    scan_owasp_api,
    full_security_scan,
    get_threat_feed,
    scan_api_inventory,
)


class TestScanTokenLeaks:
    """Unit tests for token leak scanning.
    scan_token_leaks() returns: {scan_type, findings: list, total, providers_affected, critical_count}
    """

    def test_detects_openai_key(self):
        result = scan_token_leaks('key = "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890AABBCCDD"')
        assert result["total"] >= 1
        assert any("OpenAI" in f["name"] for f in result["findings"])

    def test_detects_multiple_keys(self):
        code = '''
openai_key = "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890AABBCCDD"
aws_key = "AKIAIOSFODNN7EXAMPLE"
'''
        result = scan_token_leaks(code)
        assert result["total"] >= 2

    def test_no_false_positives(self):
        result = scan_token_leaks("x = 42\ny = 'hello'")
        assert result["total"] == 0
        assert result["findings"] == []

    def test_detects_github_token(self):
        # Build fake token dynamically to avoid GitHub push protection
        fake_ghp = "ghp_" + "A" * 36
        result = scan_token_leaks(f'token = "{fake_ghp}"')
        assert result["total"] >= 1
        assert any("GitHub" in f["name"] for f in result["findings"])

    def test_detects_stripe_key(self):
        # Use a fake key pattern that our scanner detects but won't trigger GitHub push protection
        fake_key = "sk_" + "live_" + "x" * 24
        result = scan_token_leaks(f'stripe_key = "{fake_key}"')
        assert result["total"] >= 1


class TestScanAgentAttacks:
    """Unit tests for AI agent attack detection.
    scan_agent_attacks() returns: {scan_type, findings: list, total, critical_count, high_count}
    """

    def test_detects_prompt_injection(self):
        code = 'message = user_input + " additional context"'
        result = scan_agent_attacks(code)
        assert result["total"] >= 1

    def test_clean_code_no_attacks(self):
        result = scan_agent_attacks("def add(a, b): return a + b")
        assert result["total"] == 0
        assert result["findings"] == []


class TestScanOwaspApi:
    """Unit tests for OWASP API Security scanning.
    scan_owasp_api() returns: {scan_type, findings: list, total, categories_hit, coverage}
    """

    def test_returns_dict(self):
        result = scan_owasp_api("some code here")
        assert isinstance(result, dict)
        assert "scan_type" in result
        assert "findings" in result
        assert isinstance(result["findings"], list)


class TestFullSecurityScan:
    """Unit tests for composite security scan.
    full_security_scan() returns: {score, grade, total_threats, critical_count, high_count,
        medium_count, low_count, token_leaks, agent_attacks, owasp_api, all_findings, ...}
    """

    def test_returns_all_fields(self):
        result = full_security_scan("x = 1")
        assert "score" in result
        assert "grade" in result
        assert "token_leaks" in result
        assert "agent_attacks" in result
        assert "owasp_api" in result
        assert "total_threats" in result
        assert "scan_duration_ms" in result

    def test_score_range(self):
        result = full_security_scan("clean code")
        assert 0 <= result["score"] <= 100

    def test_grade_values(self):
        result = full_security_scan("clean code")
        assert result["grade"] in ["A+", "A", "B", "C", "D", "F"]

    def test_vulnerable_code_lower_score(self):
        vulnerable = 'key = "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890AABBCCDD"'
        safe = "x = 1 + 1"
        vuln_result = full_security_scan(vulnerable)
        safe_result = full_security_scan(safe)
        assert vuln_result["score"] < safe_result["score"]


class TestThreatFeed:
    """Unit tests for threat intelligence feed.
    get_threat_feed() returns: list of threat dicts (NOT a dict wrapper)
    """

    def test_returns_threats(self):
        feed = get_threat_feed()
        assert isinstance(feed, list)
        assert len(feed) > 0

    def test_threat_has_fields(self):
        feed = get_threat_feed()
        threat = feed[0]
        assert "id" in threat
        assert "title" in threat
        assert "severity" in threat


class TestApiInventory:
    """Unit tests for API inventory scanning.
    scan_api_inventory() returns: {total_providers, ai_providers, other_providers, inventory: list}
    """

    def test_detects_openai_import(self):
        code = "import openai\nclient = openai.OpenAI()"
        result = scan_api_inventory(code)
        assert result["total_providers"] >= 1
        assert any("openai" in p["provider"].lower() for p in result["inventory"])

    def test_detects_multiple_providers(self):
        code = '''
import openai
import anthropic
import stripe
'''
        result = scan_api_inventory(code)
        assert result["total_providers"] >= 2

    def test_no_providers_in_clean_code(self):
        result = scan_api_inventory("x = 1 + 1")
        assert result["total_providers"] == 0
        assert result["inventory"] == []
