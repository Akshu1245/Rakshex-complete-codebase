# rakshex-agentguard (Python)

Runtime SDK for Rakshex AgentGuard — metadata-first LLM telemetry with privacy modes and fail-open delivery.

## Install

```bash
pip install rakshex-agentguard
# from monorepo:
pip install -e packages/agentguard-python
```

## Quick start

```python
from rakshex_agentguard import create_client

guard = create_client(
    "rx_your_workspace_key",  # NOT a provider API key
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

## Tests

```bash
pip install -e ".[dev]"
pytest
```
