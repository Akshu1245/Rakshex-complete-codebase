"""Rakshex AgentGuard Python SDK."""

from .client import AgentGuardClient, create_client
from .privacy import apply_privacy, looks_like_provider_key, redact_secrets
from .types import PrivacyMode, UsageEvent
from .providers import (
    wrap_openai,
    wrap_anthropic,
    wrap_gemini,
    wrap_azure_openai,
    wrap_bedrock,
    wrap_openrouter,
)

__all__ = [
    "AgentGuardClient",
    "create_client",
    "PrivacyMode",
    "UsageEvent",
    "apply_privacy",
    "looks_like_provider_key",
    "redact_secrets",
    "wrap_openai",
    "wrap_anthropic",
    "wrap_gemini",
    "wrap_azure_openai",
    "wrap_bedrock",
    "wrap_openrouter",
    "SDK_NAME",
    "SDK_VERSION",
]

SDK_NAME = "rakshex-agentguard"
SDK_VERSION = "0.1.0"
