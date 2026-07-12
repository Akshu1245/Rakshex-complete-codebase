from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

PrivacyMode = Literal[
    "metadata_only",
    "redacted_content",
    "full_content",
    "local_only",
    "zero_retention",
]

EventStatus = Literal["ok", "error", "timeout", "blocked", "retry"]


@dataclass
class ToolCallRecord:
    name: str
    arg_keys: list[str] | None = None
    latency_ms: float | None = None
    error: str | None = None


@dataclass
class AgentStepRecord:
    step: int
    kind: str
    name: str | None = None
    latency_ms: float | None = None


@dataclass
class UsageEvent:
    event_id: str
    correlation_id: str
    provider: str
    model: str
    request_timestamp: str
    latency_ms: float
    input_tokens: int
    output_tokens: int
    cached_tokens: int
    cost_usd: float
    cost_kind: str
    status: EventStatus
    retry_count: int
    tool_calls: list[ToolCallRecord]
    agent_steps: list[AgentStepRecord]
    redaction_count: int
    metadata: dict[str, Any]
    sdk_version: str
    workspace_id: str | None = None
    project_id: str | None = None
    agent_id: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    prompt_hash: str | None = None
    response_hash: str | None = None
    prompt_content: str | None = None
    response_content: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "eventId": self.event_id,
            "correlationId": self.correlation_id,
            "provider": self.provider,
            "model": self.model,
            "requestTimestamp": self.request_timestamp,
            "latencyMs": int(self.latency_ms),
            "inputTokens": self.input_tokens,
            "outputTokens": self.output_tokens,
            "cachedTokens": self.cached_tokens,
            "costUsd": self.cost_usd,
            "status": self.status,
            "retryCount": self.retry_count,
            "toolCalls": [
                {
                    "name": t.name,
                    "argKeys": t.arg_keys,
                    "latencyMs": t.latency_ms,
                    "error": t.error,
                }
                for t in self.tool_calls
            ],
            "agentSteps": [
                {
                    "step": s.step,
                    "kind": s.kind,
                    "name": s.name,
                    "latencyMs": s.latency_ms,
                }
                for s in self.agent_steps
            ],
            "redactionCount": self.redaction_count,
            "metadata": self.metadata,
            "sdkVersion": self.sdk_version,
            "promptHash": self.prompt_hash,
            "responseHash": self.response_hash,
        }
        if self.workspace_id:
            d["workspaceId"] = self.workspace_id
        if self.agent_id:
            d["agentId"] = self.agent_id
        if self.prompt_content is not None:
            d["promptContent"] = self.prompt_content
        if self.response_content is not None:
            d["responseContent"] = self.response_content
        if self.error_message:
            d["errorMessage"] = self.error_message
        return d
