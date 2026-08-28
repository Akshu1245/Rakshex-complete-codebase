# rakshex-agentguard (Python)

Python SDK source for Rakshex. It contains two clients:

- **AgentGuardClient** — metadata-first LLM telemetry with privacy modes and fail-open telemetry delivery.
- **AgentFirewallClient** — authorize an autonomous action before it runs, optionally broker the provider call through Rakshex, and record the outcome.

> **Private beta:** `rakshex-agentguard` is not published on PyPI yet. Do not advertise `pip install rakshex-agentguard` as a public install path. Use the source checkout below until a release is published.

## Install from this repository

```bash
git clone https://github.com/Akshu1245/Rakshex-complete-codebase.git
cd Rakshex-complete-codebase
pip install -e packages/agentguard-python
```

During private beta, set `RAKSHEX_GATEWAY_URL` to the gateway supplied for your deployment rather than assuming a public API endpoint.

## AgentGuard client

```python
import os
from rakshex_agentguard import create_client

guard = create_client(
    "rk_your_workspace_key",  # Rakshex workspace key, not a provider key
    gateway_url=os.environ["RAKSHEX_GATEWAY_URL"],
    privacy_mode="metadata_only",
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

## Enforced gateway calls

Connect a centrally managed provider credential in Rakshex, then issue a workspace key restricted to `gateway:invoke`.

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

Gateway calls are fail-closed even when `fail_open=True`; that option only controls telemetry delivery. Kill switches, hard gateway budgets, invalid credentials, or unavailable enforcement state block before the provider request.

## Agent Firewall client

```python
import os
from rakshex_agentguard import create_firewall_client, FirewallDeniedError

firewall = create_firewall_client(
    api_key="rk_...",
    workspace_id=1,
    agent_id="agent_123",
    capability_token="rk_cap_...",
    gateway_url=os.environ["RAKSHEX_GATEWAY_URL"],
)

try:
    out = firewall.authorize_and_run(
        {"provider": "stripe", "operation": "financial.refund", "amountMinor": 5000, "currency": "USD"},
        lambda: stripe.Refund.create(charge="ch_..."),
    )
except FirewallDeniedError:
    raise

brokered = firewall.execute_with_credential(
    {"provider": "stripe", "operation": "financial.refund", "amountMinor": 5000, "currency": "USD"},
    {"credentialId": "cred_...", "targetUrl": "https://api.stripe.com/v1/refunds"},
)
```

`AgentFirewallClient` is fail-closed: missing authorization inputs or an unavailable enforcement gateway raises rather than running the action.

## Privacy modes

Same contract as the Node SDK: `metadata_only` (default), `redacted_content`, `full_content`, `local_only`, `zero_retention`.

## Providers

`wrap_openai`, `wrap_anthropic`, `wrap_gemini`, `wrap_azure_openai`, `wrap_bedrock`, `wrap_openrouter` — wrappers never receive provider secrets for forwarding.

## Tests

```bash
pip install -e "packages/agentguard-python[dev]"
pytest packages/agentguard-python/tests
```
