"""Rakshex Python SDK — AgentGuard telemetry and Agent Firewall clients.

Ships two clients in one package, matching ``@rakshex/sdk`` on npm. The
PyPI name remains ``rakshex-agentguard`` (same honest-naming issue the Node
package had before it was renamed): AgentGuardClient is telemetry/privacy;
AgentFirewallClient is the Agent Firewall (evaluate / broker / ledger).
"""

from .client import AgentGuardClient, create_client
from .firewall import (
    AgentFirewallClient,
    BrokeredResponse,
    FirewallAction,
    FirewallDecision,
    FirewallDeniedError,
    create_firewall_client,
)
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
    "AgentFirewallClient",
    "BrokeredResponse",
    "FirewallAction",
    "FirewallDecision",
    "FirewallDeniedError",
    "create_client",
    "create_firewall_client",
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
SDK_VERSION = "0.2.0"
