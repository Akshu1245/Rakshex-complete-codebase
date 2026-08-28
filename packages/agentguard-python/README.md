# rakshex-agentguard (Python)

Runtime SDK for Rakshex. Ships two clients in one package (same shape as
`@rakshex/sdk` on npm). The PyPI name is still `rakshex-agentguard` — it is
not AgentGuard-only.

- **AgentGuardClient** — metadata-first LLM telemetry with privacy modes and fail-open delivery.
- **AgentFirewallClient** — authorize an autonomous agent action before it runs, optionally have Rakshex broker the provider call, and record the outcome.

## Install

```bash
pip install rakshex-agentguard
# from monorepo:
pip install -e packages/agentguard-python
```

## AgentGuard client

```python
from rakshex_agentguard import create_client

guard = create_client(
    "rk_your_workspace_key",  # NOT a provider API key
    gateway_url="https://api.rakshex.com",
    privacy_mode="metadata_only",  # default — no prompt content
    fail_open=True,
)

guard.capture(
    provider="openai",
    model="gpt-4o-mini",
    input_tokens=100,
    output_tokens=40,
    latency_ms=320,
    prompt="user question",  # hashed only in metadata_only
    correlation_id=guard.correlation_id(),
)

guard.flush()
guard.close()
```

## Enforced gateway calls (no employee provider key)

Connect a centrally managed OpenAI or OpenAI-compatible inference credential
in Rakshex, then issue employees a workspace key restricted to
`gateway:invoke`.

```python
result = guard.gateway_chat_completions(
    {
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": "Summarize this incident"}],
    },
    identity_id=42,
    project_id="security-automation",
)
```

Gateway calls are always fail-closed even when `fail_open=True`; that option
only controls telemetry delivery. Kill switches, hard gateway budgets,
invalid credentials, or unavailable enforcement state block before the
provider request.

## Privacy modes

Same contract as the Node SDK: `metadata_only` (default), `redacted_content`, `full_content`, `local_only`, `zero_retention`.

## Providers

`wrap_openai`, `wrap_anthropic`, `wrap_gemini`, `wrap_azure_openai`, `wrap_bedrock`, `wrap_openrouter` — wrappers never receive provider secrets for forwarding.

## Agent Firewall client

Authorize an autonomous action before it runs. This is the Python port of
Node `AgentFirewallClient` (`packages/sdk/src/firewall.ts`): the same tRPC
paths (`agentFirewall.evaluate`, `.credentials.broker`, `.ledger.outcome`,
`.approvals.consume`), the same `x-api-key` header, and the same fail-closed
constructor checks.

An API key scoped to `agent:execute` only is sufficient for every call this
client makes — including `record_outcome`. Do not use a `security:write`
RBAC role as a stand-in; the server authorizes on the key scope.

```python
from rakshex_agentguard import create_firewall_client, FirewallDeniedError

firewall = create_firewall_client(
    api_key="rk_...",                       # workspace key
    workspace_id=1,
    agent_id="agent_123",
    capability_token="rk_cap_...",          # delegated authority
)

# Option A: your process holds the real provider key. RaksHex only decides.
try:
    out = firewall.authorize_and_run(
        {"provider": "stripe", "operation": "financial.refund", "amountMinor": 5000, "currency": "USD"},
        lambda: stripe.Refund.create(charge="ch_..."),
    )
except FirewallDeniedError:
    raise

# Option B: RaksHex holds the provider key and makes the call itself — a DENY
# is enforced by RaksHex, not by whether your code chose to honor it.
brokered = firewall.execute_with_credential(
    {"provider": "stripe", "operation": "financial.refund", "amountMinor": 5000, "currency": "USD"},
    {"credentialId": "cred_...", "targetUrl": "https://api.stripe.com/v1/refunds"},
)
```

Missing workspace key, capability token, or gateway URL raises at
construction. A gateway outage raises rather than running the action.

## Tests

```bash
pip install -e ".[dev]"
pytest
```

