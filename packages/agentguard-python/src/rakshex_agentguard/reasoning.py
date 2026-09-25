"""Reasoning-token cost attribution — Python SDK side.

Salvaged from DevPulse Patent NHCE/DEV/2026/002
(``devpulse-api-insights-main/backend/services/thinking_tokens.py``).

Client-side detection cascade for hidden thinking/reasoning spend:
direct provider field → differential (total − input − output) → latency
signature → none. No hardcoded price table here: the caller supplies the
output rate (reasoning bills at the output rate on every major provider),
or leaves cost unset.
"""

from __future__ import annotations

from typing import Literal, TypedDict

DetectionMethod = Literal["direct", "differential", "timing_estimate", "none"]


class UsagePayload(TypedDict, total=False):
    """Known fields across provider usage payloads (all optional)."""

    completion_tokens_details: dict[str, int]
    reasoning_tokens: int
    thinking_tokens: int
    total_tokens: int
    prompt_tokens: int
    input_tokens: int
    completion_tokens: int
    output_tokens: int


#: Latency per visible output token above which hidden reasoning is suspected.
_MS_PER_TOKEN_SUSPICIOUS = 30.0


class ReasoningDetection(TypedDict):
    """Result of the detection cascade."""

    tokens: int
    method: DetectionMethod


class ReasoningSpendLineItem(TypedDict, total=False):
    """Canonical reasoning-spend line item for receipts and envelopes."""

    kind: str
    model: str
    reasoning_tokens: int
    cost_usd: float | None
    detection_method: DetectionMethod
    confidence: str
    overhead_multiplier: float | None
    is_anomaly: bool
    breakout_of_output_tokens: bool


def differential_reasoning_tokens(
    total_tokens: int | None,
    input_tokens: int | None,
    output_tokens: int | None,
) -> int:
    """Positive residual of total − input − output, else 0."""
    total = max(0, int(total_tokens or 0))
    prompt = max(0, int(input_tokens or 0))
    output = max(0, int(output_tokens or 0))
    if total <= 0 or prompt <= 0 or output <= 0:
        return 0
    return max(0, total - prompt - output)


def detect_reasoning_tokens(
    model: str,
    usage: UsagePayload,
    latency_ms: float = 0.0,
) -> ReasoningDetection:
    """Run the detection cascade over one provider usage payload.

    Returns ``{"tokens": int, "method": DetectionMethod}``. Provider payloads
    differ: OpenAI uses ``completion_tokens_details.reasoning_tokens``,
    Anthropic ``thinking_tokens``; both are tried as the direct source.
    """
    # Method 1: direct provider field.
    details = usage.get("completion_tokens_details") or {}
    reported = int(details.get("reasoning_tokens", 0) or 0)
    if reported <= 0:
        reported = int(usage.get("thinking_tokens", 0) or 0)
    if reported > 0:
        return {"tokens": reported, "method": "direct"}

    # Method 2: differential residual.
    diff = differential_reasoning_tokens(
        usage.get("total_tokens"),
        usage.get("prompt_tokens", usage.get("input_tokens")),
        usage.get("completion_tokens", usage.get("output_tokens")),
    )
    if diff > 0:
        return {"tokens": diff, "method": "differential"}

    # Method 3: latency signature (conservative secondary signal).
    output = max(0, int(usage.get("completion_tokens", usage.get("output_tokens", 0)) or 0))
    if latency_ms > 0 and output > 0 and (latency_ms / output) > _MS_PER_TOKEN_SUSPICIOUS:
        return {"tokens": 0, "method": "timing_estimate"}

    return {"tokens": 0, "method": "none"}


def is_reasoning_anomaly(reasoning_tokens: int, output_tokens: int) -> bool:
    """Reasoning above 3× visible output on one call is anomalous."""
    if output_tokens <= 0:
        return reasoning_tokens > 0
    return reasoning_tokens > output_tokens * 3


def reasoning_spend_line_item(
    model: str,
    usage: UsagePayload,
    latency_ms: float = 0.0,
    output_per_million_usd: float | None = None,
) -> ReasoningSpendLineItem | None:
    """Canonical reasoning-spend line item, or None when undetected.

    The item is a *breakout* of the provider's output count — never new spend.
    """
    detection = detect_reasoning_tokens(model, usage, latency_ms)
    tokens = int(detection["tokens"])
    if tokens <= 0:
        return None
    output = max(0, int(usage.get("completion_tokens", usage.get("output_tokens", 0)) or 0))
    cost_usd: float | None = None
    overhead: float | None = None
    if output_per_million_usd is not None and output_per_million_usd >= 0:
        cost_usd = round((tokens / 1_000_000) * output_per_million_usd, 6)
        if output > 0 and output_per_million_usd > 0:
            output_cost = (output / 1_000_000) * output_per_million_usd
            overhead = round(cost_usd / output_cost, 2)
    method: DetectionMethod = detection["method"]
    confidence = "exact" if method == "direct" else ("estimated" if method != "none" else "unknown")
    return {
        "kind": "reasoning_spend",
        "model": model,
        "reasoning_tokens": tokens,
        "cost_usd": cost_usd,
        "detection_method": method,
        "confidence": confidence,
        "overhead_multiplier": overhead,
        "is_anomaly": is_reasoning_anomaly(tokens, output),
        "breakout_of_output_tokens": True,
    }
