"""Agent Firewall client — Python port of packages/sdk/src/firewall.ts.

Hits the same tRPC mutations as the Node AgentFirewallClient
(``agentFirewall.evaluate``, ``.credentials.broker``, ``.ledger.outcome``,
``.approvals.consume``). Auth is the workspace API key on ``x-api-key``;
runtime authorization on the server is ``agent:execute`` for every call this
client makes, including ``ledger.outcome``. Fail-closed: a missing key,
capability token, or gateway URL, or a gateway outage, raises rather than
letting the action proceed.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
import uuid
from typing import Any, Callable, Literal, Mapping, TypedDict, TypeVar

DEFAULT_GATEWAY = "https://api.rakshex.in"

Decision = Literal[
    "ALLOW",
    "DENY",
    "APPROVAL_REQUIRED",
    "LIMIT",
    "REDACT",
    "SANDBOX",
    "PAUSE",
    "FREEZE",
]
EffectiveDecision = Literal["ALLOW", "DENY", "PENDING_APPROVAL"]
OutcomeStatus = Literal["succeeded", "failed", "reversed", "not_executed"]
HttpMethod = Literal["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]

T = TypeVar("T")

# Python kwargs / dict keys → tRPC input names (firewall.ts / agentFirewall.ts).
_WIRE_KEYS = {
    "tool_name": "toolName",
    "request_id": "requestId",
    "amount_minor": "amountMinor",
    "project_id": "projectId",
    "trace_id": "traceId",
    "idempotency_key": "idempotencyKey",
    "credential_id": "credentialId",
    "target_url": "targetUrl",
    "ledger_id": "ledgerId",
    "workspace_id": "workspaceId",
    "agent_id": "agentId",
    "capability_token": "capabilityToken",
    "approval_id": "approvalId",
}


class FirewallAction(TypedDict, total=False):
    provider: str
    operation: str
    toolName: str
    requestId: str
    parameters: dict[str, Any]
    resource: str
    environment: str
    amountMinor: int
    currency: str
    projectId: str
    traceId: str
    idempotencyKey: str
    # snake_case aliases accepted at the Python boundary and rewritten on the wire
    tool_name: str
    request_id: str
    amount_minor: int
    project_id: str
    trace_id: str
    idempotency_key: str


class FirewallDecision(TypedDict, total=False):
    ledgerId: str
    traceId: str
    approvalId: str
    mode: Literal["shadow", "enforce"]
    decision: Decision
    effectiveDecision: EffectiveDecision
    reasons: list[str]
    replayed: bool
    normalizedAction: dict[str, Any]


class BrokeredResponse(TypedDict, total=False):
    status: int
    headers: dict[str, str]
    body: Any
    durationMs: int
    egressId: str


class BrokerRequest(TypedDict, total=False):
    credentialId: str
    targetUrl: str
    method: HttpMethod
    headers: dict[str, str]
    body: Any
    credential_id: str
    target_url: str


class FirewallDeniedError(RuntimeError):
    """Raised when evaluate() did not ALLOW — the action must not run."""

    def __init__(self, result: FirewallDecision) -> None:
        action = result.get("normalizedAction") or {}
        name = action.get("name", "action") if isinstance(action, dict) else "action"
        reasons = result.get("reasons") or []
        super().__init__(f"RaksHex blocked {name}: {'; '.join(str(r) for r in reasons)}")
        self.result = result
        self.name = "FirewallDeniedError"


def _wire_keys(payload: Mapping[str, Any]) -> dict[str, Any]:
    return {_WIRE_KEYS.get(key, key): value for key, value in payload.items()}


def _omit_none(payload: Mapping[str, Any]) -> dict[str, Any]:
    # zod optional() accepts undefined, not null — drop None so it is omitted.
    return {key: value for key, value in payload.items() if value is not None}


def _result_data(payload: Any) -> Any:
    """Unwrap a tRPC HTTP response. Same shape as firewall.ts resultData()."""
    if not isinstance(payload, dict):
        raise RuntimeError("RaksHex returned an invalid response")
    error = payload.get("error")
    if error:
        message = "RaksHex request failed"
        if isinstance(error, dict):
            nested = error.get("json") if isinstance(error.get("json"), dict) else {}
            message = nested.get("message") or error.get("message") or message
        raise RuntimeError(message)
    result = payload.get("result")
    if not isinstance(result, dict):
        raise RuntimeError("RaksHex returned an invalid response")
    data = result.get("data")
    if data is None:
        raise RuntimeError("RaksHex returned an invalid response")
    if isinstance(data, dict) and "json" in data:
        return data["json"]
    return data


def _error_message_from_body(raw: str, status: int) -> str:
    fallback = f"RaksHex request failed with HTTP {status}"
    if not raw:
        return fallback
    try:
        body = json.loads(raw)
    except json.JSONDecodeError:
        return fallback
    if not isinstance(body, dict):
        return fallback
    error = body.get("error")
    if isinstance(error, dict):
        nested = error.get("json") if isinstance(error.get("json"), dict) else {}
        return nested.get("message") or error.get("message") or fallback
    return fallback


class AgentFirewallClient:
    """Authorize an autonomous action before it runs.

    Matches Node ``AgentFirewallClient``: evaluate, authorize_and_run,
    execute_with_credential, record_outcome, consume_approval. An API key
    scoped to ``agent:execute`` is sufficient for every method — including
    ``record_outcome`` (``agentFirewall.ledger.outcome``). Do not require
    ``security:write`` on the client; the server authorizes on the key scope.
    """

    def __init__(
        self,
        *,
        api_key: str,
        workspace_id: int,
        agent_id: str,
        capability_token: str,
        gateway_url: str | None = None,
        urlopen: Callable[..., Any] | None = None,
        timeout: float = 60.0,
    ) -> None:
        if not api_key or not str(api_key).startswith("rk_"):
            raise ValueError("A RaksHex workspace API key is required")
        if not capability_token or not str(capability_token).startswith("rk_cap_"):
            raise ValueError("A RaksHex agent capability token is required")
        if not agent_id:
            raise ValueError("agent_id is required")
        if not isinstance(workspace_id, int) or isinstance(workspace_id, bool):
            raise ValueError("workspace_id must be an int")
        resolved = DEFAULT_GATEWAY if gateway_url is None else str(gateway_url).strip()
        if not resolved:
            raise ValueError("A RaksHex gateway URL is required")
        self.api_key = api_key
        self.workspace_id = workspace_id
        self.agent_id = agent_id
        self.capability_token = capability_token
        self.gateway_url = resolved.rstrip("/")
        self._urlopen = urlopen
        self.timeout = timeout

    def _opener(self) -> Callable[..., Any]:
        return self._urlopen or urllib.request.urlopen

    def _mutation(self, path: str, payload: Mapping[str, Any]) -> Any:
        url = f"{self.gateway_url}/api/trpc/{path}"
        body = json.dumps({"json": _omit_none(dict(payload))}).encode("utf-8")
        request = urllib.request.Request(
            url,
            data=body,
            method="POST",
            headers={
                "content-type": "application/json",
                "x-api-key": self.api_key,
            },
        )
        try:
            with self._opener()(request, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8")
                status = getattr(response, "status", 200)
        except urllib.error.HTTPError as exc:
            raw = ""
            try:
                raw = exc.read().decode("utf-8")
            except Exception:
                raw = ""
            raise RuntimeError(_error_message_from_body(raw, exc.code)) from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(
                f"RaksHex enforcement gateway unavailable: {exc.reason}"
            ) from exc

        try:
            parsed = json.loads(raw) if raw else None
        except json.JSONDecodeError as exc:
            raise RuntimeError("RaksHex returned an invalid response") from exc
        if status < 200 or status >= 300:
            raise RuntimeError(_error_message_from_body(raw, status))
        return _result_data(parsed)

    def evaluate(self, action: Mapping[str, Any]) -> FirewallDecision:
        wire = _wire_keys(action)
        if not wire.get("provider") or not wire.get("operation"):
            raise ValueError("action.provider and action.operation are required")
        return self._mutation(
            "agentFirewall.evaluate",
            {
                **wire,
                "workspaceId": self.workspace_id,
                "agentId": self.agent_id,
                "capabilityToken": self.capability_token,
                "idempotencyKey": wire.get("idempotencyKey") or str(uuid.uuid4()),
            },
        )

    def authorize_and_run(
        self,
        action: Mapping[str, Any],
        execute: Callable[[], T],
    ) -> dict[str, Any]:
        decision = self.evaluate(action)
        if decision.get("effectiveDecision") != "ALLOW":
            raise FirewallDeniedError(decision)
        try:
            result = execute()
            self.record_outcome(decision["ledgerId"], "succeeded")
            return {"decision": decision, "result": result}
        except FirewallDeniedError:
            raise
        except Exception as error:
            try:
                self.record_outcome(
                    decision["ledgerId"],
                    "failed",
                    {"errorType": type(error).__name__},
                )
            except Exception:
                pass
            raise

    def consume_approval(self, approval_id: str) -> dict[str, Any]:
        return self._mutation(
            "agentFirewall.approvals.consume",
            {
                "workspaceId": self.workspace_id,
                "approvalId": approval_id,
            },
        )

    def execute_with_credential(
        self,
        action: Mapping[str, Any],
        request: Mapping[str, Any],
    ) -> dict[str, Any]:
        """Authorize then have RaksHex make the provider call.

        Prefer this over ``authorize_and_run`` when the process must not hold
        the real provider key. One ALLOW buys exactly one brokered call.
        """
        decision = self.evaluate(action)
        if decision.get("effectiveDecision") != "ALLOW":
            raise FirewallDeniedError(decision)
        wire = _wire_keys(request)
        credential_id = wire.get("credentialId")
        target_url = wire.get("targetUrl")
        if not credential_id or not target_url:
            raise ValueError("request.credentialId and request.targetUrl are required")
        response = self._mutation(
            "agentFirewall.credentials.broker",
            {
                "workspaceId": self.workspace_id,
                "credentialId": credential_id,
                "ledgerId": decision["ledgerId"],
                "targetUrl": target_url,
                "method": wire.get("method") or "POST",
                "headers": wire.get("headers"),
                "body": wire.get("body"),
            },
        )
        status = response.get("status") if isinstance(response, dict) else None
        outcome_status: OutcomeStatus = (
            "succeeded" if isinstance(status, int) and 200 <= status < 300 else "failed"
        )
        try:
            self.record_outcome(
                decision["ledgerId"],
                outcome_status,
                {"status": status} if status is not None else None,
            )
        except Exception:
            pass
        return {"decision": decision, "response": response}

    def record_outcome(
        self,
        ledger_id: str,
        status: OutcomeStatus,
        outcome: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Close the ledger row. Same ``agent:execute`` key as ``evaluate``."""
        if status not in ("succeeded", "failed", "reversed", "not_executed"):
            raise ValueError(f"invalid outcome status: {status}")
        payload: dict[str, Any] = {
            "workspaceId": self.workspace_id,
            "ledgerId": ledger_id,
            "status": status,
        }
        if outcome is not None:
            payload["outcome"] = dict(outcome)
        return self._mutation("agentFirewall.ledger.outcome", payload)


def create_firewall_client(
    *,
    api_key: str,
    workspace_id: int,
    agent_id: str,
    capability_token: str,
    gateway_url: str | None = None,
    urlopen: Callable[..., Any] | None = None,
    timeout: float = 60.0,
) -> AgentFirewallClient:
    return AgentFirewallClient(
        api_key=api_key,
        workspace_id=workspace_id,
        agent_id=agent_id,
        capability_token=capability_token,
        gateway_url=gateway_url,
        urlopen=urlopen,
        timeout=timeout,
    )
