# Rakshex SDKs

## Node — `@rakshex/sdk`

Package: `@rakshex/sdk` (`packages/sdk`, renamed 2026-08-09 from
`@rakshex/agentguard-sdk` — it ships two distinct clients and shouldn't be
named after only one of them; see `packages/sdk/src/index.ts` header and
`CLAUDE.md` for why).

Two clients, one package:

```ts
// AgentGuard: LLM telemetry, PII/secret redaction, provider wrappers.
import { createAgentGuardClient, wrapOpenAI } from "@rakshex/sdk";

const guard = createAgentGuardClient({
  apiKey: process.env.RAKSHEX_API_KEY!,
  privacyMode: "metadata_only",
  failOpen: true,
});

// Agent Firewall: authorize an autonomous action before it runs.
import { createAgentFirewallClient } from "@rakshex/sdk";

const firewall = createAgentFirewallClient({
  apiKey: process.env.RAKSHEX_API_KEY!,
  workspaceId: 1,
  agentId: "agent_123",
  capabilityToken: process.env.RAKSHEX_CAPABILITY_TOKEN!,
});
```

Providers (AgentGuard side): OpenAI, Anthropic, Gemini, Azure OpenAI, Bedrock, OpenRouter wrappers.

See package `README.md` and `examples/`.

## Python — `rakshex-agentguard`

Package: `rakshex-agentguard` (`packages/agentguard-python`). The PyPI name
is still AgentGuard-shaped — same honest-naming issue the Node package had
before it became `@rakshex/sdk`. It now ships both clients:

- `AgentGuardClient` / `create_client` — telemetry, privacy modes, provider wrappers, fail-open ingest.
- `AgentFirewallClient` / `create_firewall_client` — Python port of Node
  `packages/sdk/src/firewall.ts`. Same tRPC mutations
  (`agentFirewall.evaluate`, `.credentials.broker`, `.ledger.outcome`,
  `.approvals.consume`), same `x-api-key` header, same fail-closed
  constructor (workspace key must start with `rk_`, capability token with
  `rk_cap_`, empty gateway URL is rejected). `ledger.outcome` is called with
  the same key as `evaluate`; the server authorizes it with
  `agent:execute`, not `security:write`.

```python
from rakshex_agentguard import create_client, create_firewall_client

guard = create_client(api_key, privacy_mode="metadata_only", fail_open=True)

firewall = create_firewall_client(
    api_key=api_key,            # rk_... workspace key, agent:execute is enough
    workspace_id=1,
    agent_id="agent_123",
    capability_token=cap_token, # rk_cap_...
)
decision = firewall.evaluate({"provider": "stripe", "operation": "financial.refund"})
firewall.record_outcome(decision["ledgerId"], "succeeded")
```

```bash
pip install -e packages/agentguard-python
pytest packages/agentguard-python/tests
```

## Guarantees (tested)

- Default no prompt content capture
- Fail-open offline queue when gateway down
- Provider keys not forwarded in telemetry bodies
- Agent Firewall client is fail-closed (missing `rk_` key / `rk_cap_` token / gateway URL, or a gateway outage, never runs the action)
- Python `record_outcome` hits `agentFirewall.ledger.outcome` with the same workspace key as `evaluate` (server scope: `agent:execute`)
