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

## Privacy modes

Same contract as the Node SDK: `metadata_only` (default), `redacted_content`, `full_content`, `local_only`, `zero_retention`.

## Providers

`wrap_openai`, `wrap_anthropic`, `wrap_gemini`, `wrap_azure_openai`, `wrap_bedrock`, `wrap_openrouter` — wrappers never receive provider secrets for forwarding.

## Tests

```bash
pip install -e ".[dev]"
pytest
```
