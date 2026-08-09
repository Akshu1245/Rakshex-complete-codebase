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

Package: `rakshex-agentguard` (`packages/agentguard-python`). This is
**AgentGuard only** — there is no Python `AgentFirewallClient` yet. A Python
integrator who wants to call the Agent Firewall today has to call the tRPC
HTTP endpoints directly (`agentFirewall.evaluate`, `.credentials.broker`,
`.ledger.outcome`, `.approvals.consume`); porting the TS `firewall.ts`
client to Python is real, tracked, unbuilt work, not a documentation gap.

```bash
pip install -e packages/agentguard-python
pytest packages/agentguard-python/tests
```

## Guarantees (tested)

- Default no prompt content capture
- Fail-open offline queue when gateway down
- Provider keys not forwarded in telemetry bodies
