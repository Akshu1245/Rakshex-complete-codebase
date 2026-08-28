"""Unit tests for AgentFirewallClient. No live network."""

from __future__ import annotations

import json
import urllib.error
from io import BytesIO

import pytest

from rakshex_agentguard import (
    AgentFirewallClient,
    FirewallDeniedError,
    create_firewall_client,
)
from rakshex_agentguard.firewall import DEFAULT_GATEWAY


class FakeResponse:
    def __init__(self, payload: dict, status: int = 200) -> None:
        self._raw = json.dumps(payload).encode()
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return self._raw


def _trpc(data: dict) -> dict:
    return {"result": {"data": {"json": data}}}


def _allow(*, ledger_id: str = "act_1") -> dict:
    return _trpc(
        {
            "ledgerId": ledger_id,
            "traceId": "trace_1",
            "mode": "enforce",
            "decision": "ALLOW",
            "effectiveDecision": "ALLOW",
            "reasons": [],
            "replayed": False,
            "normalizedAction": {"name": "financial.refund", "parameters": {}},
        }
    )


def _deny() -> dict:
    return _trpc(
        {
            "ledgerId": "act_deny",
            "traceId": "trace_d",
            "mode": "enforce",
            "decision": "DENY",
            "effectiveDecision": "DENY",
            "reasons": ["authority does not cover financial.refund"],
            "replayed": False,
            "normalizedAction": {"name": "financial.refund", "parameters": {}},
        }
    )


def _client(urlopen, **overrides):
    defaults = dict(
        api_key="rk_live_workspace",
        workspace_id=7,
        agent_id="agent_123",
        capability_token="rk_cap_delegated_token_value",
        gateway_url="https://api.rakshex.test",
        urlopen=urlopen,
    )
    defaults.update(overrides)
    return create_firewall_client(**defaults)


def test_rejects_missing_workspace_key():
    with pytest.raises(ValueError, match="workspace API key"):
        AgentFirewallClient(
            api_key="",
            workspace_id=1,
            agent_id="a",
            capability_token="rk_cap_token",
        )
    with pytest.raises(ValueError, match="workspace API key"):
        AgentFirewallClient(
            api_key="sk-openai-not-a-workspace-key",
            workspace_id=1,
            agent_id="a",
            capability_token="rk_cap_token",
        )


def test_rejects_missing_capability_token():
    with pytest.raises(ValueError, match="capability token"):
        AgentFirewallClient(
            api_key="rk_live",
            workspace_id=1,
            agent_id="a",
            capability_token="",
        )
    with pytest.raises(ValueError, match="capability token"):
        AgentFirewallClient(
            api_key="rk_live",
            workspace_id=1,
            agent_id="a",
            capability_token="rk_not_a_cap_token",
        )


def test_rejects_empty_gateway_url():
    with pytest.raises(ValueError, match="gateway URL"):
        AgentFirewallClient(
            api_key="rk_live",
            workspace_id=1,
            agent_id="a",
            capability_token="rk_cap_token",
            gateway_url="   ",
        )


def test_default_gateway_matches_node_firewall_client():
    client = AgentFirewallClient(
        api_key="rk_live",
        workspace_id=1,
        agent_id="a",
        capability_token="rk_cap_token",
    )
    assert client.gateway_url == DEFAULT_GATEWAY
    assert DEFAULT_GATEWAY == "https://api.rakshex.in"


def test_evaluate_posts_trpc_contract():
    captured = {}

    def urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["method"] = request.get_method()
        captured["content_type"] = request.get_header("Content-type")
        captured["api_key"] = request.get_header("X-api-key")
        captured["authorization"] = request.get_header("Authorization")
        captured["timeout"] = timeout
        captured["body"] = json.loads(request.data.decode())
        return FakeResponse(_allow())

    client = _client(urlopen)
    decision = client.evaluate(
        {
            "provider": "stripe",
            "operation": "financial.refund",
            "amountMinor": 5000,
            "currency": "USD",
            "idempotencyKey": "idem-evaluate-0001",
        }
    )

    assert decision["ledgerId"] == "act_1"
    assert decision["effectiveDecision"] == "ALLOW"
    assert captured["url"] == "https://api.rakshex.test/api/trpc/agentFirewall.evaluate"
    assert captured["method"] == "POST"
    assert captured["content_type"] == "application/json"
    assert captured["api_key"] == "rk_live_workspace"
    assert captured["authorization"] is None
    payload = captured["body"]["json"]
    assert payload["workspaceId"] == 7
    assert payload["agentId"] == "agent_123"
    assert payload["capabilityToken"] == "rk_cap_delegated_token_value"
    assert payload["provider"] == "stripe"
    assert payload["operation"] == "financial.refund"
    assert payload["amountMinor"] == 5000
    assert payload["currency"] == "USD"
    assert payload["idempotencyKey"] == "idem-evaluate-0001"


def test_evaluate_rewrites_snake_case_and_generates_idempotency_key():
    captured = {}

    def urlopen(request, timeout):
        captured["body"] = json.loads(request.data.decode())
        return FakeResponse(_allow())

    client = _client(urlopen)
    client.evaluate(
        {
            "provider": "stripe",
            "operation": "financial.refund",
            "amount_minor": 2500,
            "tool_name": "stripe.refunds.create",
        }
    )
    payload = captured["body"]["json"]
    assert payload["amountMinor"] == 2500
    assert payload["toolName"] == "stripe.refunds.create"
    assert "amount_minor" not in payload
    assert len(payload["idempotencyKey"]) >= 8


def test_record_outcome_uses_agent_execute_endpoint_not_security_write():
    captured = {}

    def urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["api_key"] = request.get_header("X-api-key")
        captured["body"] = json.loads(request.data.decode())
        return FakeResponse(_trpc({"success": True}))

    client = _client(urlopen)
    result = client.record_outcome("act_1", "succeeded", {"status": 200})

    assert result == {"success": True}
    assert captured["url"] == (
        "https://api.rakshex.test/api/trpc/agentFirewall.ledger.outcome"
    )
    assert captured["api_key"] == "rk_live_workspace"
    payload = captured["body"]["json"]
    assert payload == {
        "workspaceId": 7,
        "ledgerId": "act_1",
        "status": "succeeded",
        "outcome": {"status": 200},
    }
    # Client must not invent an RBAC permission field; the server authorizes
    # this mutation with assertRuntimeApiKeyScope(..., "agent:execute").
    assert "permission" not in payload
    assert "security:write" not in json.dumps(payload)


def test_authorize_and_run_records_success():
    calls = []

    def urlopen(request, timeout):
        path = request.full_url.rsplit("/", 1)[-1]
        body = json.loads(request.data.decode())
        calls.append({"path": path, "json": body["json"]})
        if path == "agentFirewall.evaluate":
            return FakeResponse(_allow(ledger_id="act_run"))
        if path == "agentFirewall.ledger.outcome":
            return FakeResponse(_trpc({"success": True}))
        raise AssertionError(path)

    ran = {"n": 0}

    def execute():
        ran["n"] += 1
        return {"refundId": "re_1"}

    client = _client(urlopen)
    out = client.authorize_and_run(
        {"provider": "stripe", "operation": "financial.refund"},
        execute,
    )
    assert ran["n"] == 1
    assert out["result"] == {"refundId": "re_1"}
    assert out["decision"]["ledgerId"] == "act_run"
    assert [c["path"] for c in calls] == [
        "agentFirewall.evaluate",
        "agentFirewall.ledger.outcome",
    ]
    assert calls[1]["json"]["status"] == "succeeded"
    assert calls[1]["json"]["ledgerId"] == "act_run"


def test_authorize_and_run_deny_does_not_execute():
    calls = []

    def urlopen(request, timeout):
        calls.append(request.full_url)
        return FakeResponse(_deny())

    def execute():
        raise AssertionError("denied actions must not run")

    client = _client(urlopen)
    with pytest.raises(FirewallDeniedError) as exc:
        client.authorize_and_run(
            {"provider": "stripe", "operation": "financial.refund"},
            execute,
        )
    assert "financial.refund" in str(exc.value)
    assert exc.value.result["effectiveDecision"] == "DENY"
    assert len(calls) == 1
    assert calls[0].endswith("agentFirewall.evaluate")


def test_authorize_and_run_failed_execute_records_failed_then_reraises():
    calls = []

    def urlopen(request, timeout):
        path = request.full_url.rsplit("/", 1)[-1]
        body = json.loads(request.data.decode())
        calls.append({"path": path, "json": body["json"]})
        if path == "agentFirewall.evaluate":
            return FakeResponse(_allow(ledger_id="act_fail"))
        return FakeResponse(_trpc({"success": True}))

    def execute():
        raise RuntimeError("stripe down")

    client = _client(urlopen)
    with pytest.raises(RuntimeError, match="stripe down"):
        client.authorize_and_run(
            {"provider": "stripe", "operation": "financial.refund"},
            execute,
        )
    assert [c["path"] for c in calls] == [
        "agentFirewall.evaluate",
        "agentFirewall.ledger.outcome",
    ]
    assert calls[1]["json"]["status"] == "failed"
    assert calls[1]["json"]["outcome"] == {"errorType": "RuntimeError"}


def test_execute_with_credential_brokers_then_records_outcome():
    calls = []

    def urlopen(request, timeout):
        path = request.full_url.rsplit("/", 1)[-1]
        body = json.loads(request.data.decode())
        calls.append({"path": path, "json": body["json"], "key": request.get_header("X-api-key")})
        if path == "agentFirewall.evaluate":
            return FakeResponse(_allow(ledger_id="act_broker"))
        if path == "agentFirewall.credentials.broker":
            return FakeResponse(
                _trpc(
                    {
                        "status": 200,
                        "headers": {"content-type": "application/json"},
                        "body": {"id": "re_9"},
                        "durationMs": 12,
                        "egressId": "egr_1",
                    }
                )
            )
        if path == "agentFirewall.ledger.outcome":
            return FakeResponse(_trpc({"success": True}))
        raise AssertionError(path)

    client = _client(urlopen)
    out = client.execute_with_credential(
        {"provider": "stripe", "operation": "financial.refund", "amountMinor": 5000},
        {
            "credential_id": "cred_1",
            "target_url": "https://api.stripe.com/v1/refunds",
            "body": {"amount": 5000},
        },
    )
    assert out["response"]["egressId"] == "egr_1"
    assert [c["path"] for c in calls] == [
        "agentFirewall.evaluate",
        "agentFirewall.credentials.broker",
        "agentFirewall.ledger.outcome",
    ]
    broker = calls[1]["json"]
    assert broker["credentialId"] == "cred_1"
    assert broker["ledgerId"] == "act_broker"
    assert broker["targetUrl"] == "https://api.stripe.com/v1/refunds"
    assert broker["method"] == "POST"
    assert broker["workspaceId"] == 7
    assert calls[2]["json"]["status"] == "succeeded"
    assert all(c["key"] == "rk_live_workspace" for c in calls)


def test_execute_with_credential_deny_does_not_broker():
    calls = []

    def urlopen(request, timeout):
        calls.append(request.full_url.rsplit("/", 1)[-1])
        return FakeResponse(_deny())

    client = _client(urlopen)
    with pytest.raises(FirewallDeniedError):
        client.execute_with_credential(
            {"provider": "stripe", "operation": "financial.refund"},
            {"credentialId": "cred_1", "targetUrl": "https://api.stripe.com/v1/refunds"},
        )
    assert calls == ["agentFirewall.evaluate"]


def test_consume_approval_contract():
    captured = {}

    def urlopen(request, timeout):
        captured["url"] = request.full_url
        captured["body"] = json.loads(request.data.decode())
        return FakeResponse(
            _trpc(
                {
                    "approvalId": "apr_1",
                    "ledgerId": "act_1",
                    "semanticAction": "financial.refund",
                    "effectiveDecision": "ALLOW",
                    "consumed": True,
                }
            )
        )

    client = _client(urlopen)
    out = client.consume_approval("apr_1")
    assert out["consumed"] is True
    assert captured["url"].endswith("agentFirewall.approvals.consume")
    assert captured["body"]["json"] == {"workspaceId": 7, "approvalId": "apr_1"}


def test_http_error_fails_closed():
    def urlopen(request, timeout):
        raise urllib.error.HTTPError(
            request.full_url,
            403,
            "Forbidden",
            {},
            BytesIO(
                json.dumps(
                    {
                        "error": {
                            "json": {"message": "Missing agent:execute scope"}
                        }
                    }
                ).encode()
            ),
        )

    client = _client(urlopen)
    with pytest.raises(RuntimeError, match="Missing agent:execute scope"):
        client.evaluate({"provider": "stripe", "operation": "financial.refund"})


def test_network_error_fails_closed_does_not_execute():
    def urlopen(request, timeout):
        raise urllib.error.URLError("connection refused")

    ran = {"n": 0}

    def execute():
        ran["n"] += 1

    client = _client(urlopen)
    with pytest.raises(RuntimeError, match="gateway unavailable"):
        client.authorize_and_run(
            {"provider": "stripe", "operation": "financial.refund"},
            execute,
        )
    assert ran["n"] == 0


def test_trpc_error_envelope_fails_closed():
    def urlopen(request, timeout):
        return FakeResponse({"error": {"message": "Ledger record not found"}})

    client = _client(urlopen)
    with pytest.raises(RuntimeError, match="Ledger record not found"):
        client.record_outcome("act_missing", "succeeded")


def test_evaluate_requires_provider_and_operation():
    def urlopen(*_a, **_k):
        raise AssertionError("must not call network")

    client = _client(urlopen)
    with pytest.raises(ValueError, match="provider"):
        client.evaluate({"operation": "financial.refund"})
