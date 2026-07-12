from __future__ import annotations

import re
from typing import Any

from .types import PrivacyMode, UsageEvent

_SECRET_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bsk-[a-zA-Z0-9]{20,}\b"), "[REDACTED_API_KEY]"),
    (re.compile(r"\bsk-ant-[a-zA-Z0-9\-_]{20,}\b"), "[REDACTED_API_KEY]"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "[REDACTED_AWS_KEY]"),
    (re.compile(r"\bBearer\s+[A-Za-z0-9\-._~+/]+=*", re.I), "Bearer [REDACTED]"),
    (re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I), "[REDACTED_EMAIL]"),
]

_FORBIDDEN_META = {
    "apikey",
    "api_key",
    "authorization",
    "password",
    "secret",
    "token",
    "access_token",
    "openai_api_key",
    "anthropic_api_key",
}


def redact_secrets(text: str) -> tuple[str, int]:
    count = 0
    value = text
    for pattern, repl in _SECRET_PATTERNS:
        value, n = pattern.subn(repl, value)
        count += n
    return value, count


def looks_like_provider_key(value: str) -> bool:
    if len(value) < 20:
        return False
    if value.startswith("sk-") or value.startswith("sk-ant-"):
        return True
    if re.match(r"^AKIA[0-9A-Z]{16}$", value):
        return True
    if value.startswith("AIza") and len(value) > 30:
        return True
    return False


def scrub_metadata(meta: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in meta.items():
        lower = k.lower().replace("-", "_")
        if lower in _FORBIDDEN_META or "api_key" in lower or lower.endswith("_secret"):
            out[k] = "[REDACTED]"
        elif isinstance(v, str) and looks_like_provider_key(v):
            out[k] = "[REDACTED]"
        else:
            out[k] = v
    return out


def apply_privacy(event: UsageEvent, mode: PrivacyMode) -> UsageEvent:
    event.metadata = scrub_metadata(event.metadata)
    if mode in ("metadata_only", "zero_retention", "local_only"):
        event.prompt_content = None
        event.response_content = None
        for t in event.tool_calls:
            # keep names/arg_keys only
            pass
        if mode == "zero_retention":
            event.prompt_hash = None
            event.response_hash = None
        return event
    if mode in ("redacted_content", "full_content"):
        if event.prompt_content:
            event.prompt_content, n = redact_secrets(event.prompt_content)
            event.redaction_count += n
        if event.response_content:
            event.response_content, n = redact_secrets(event.response_content)
            event.redaction_count += n
    return event
