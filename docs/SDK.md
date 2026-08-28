# Rakshex SDKs

## Node — `@rakshex/sdk`

Source package: `@rakshex/sdk` (`packages/sdk`). It contains two clients:

```ts
import { createAgentGuardClient, createAgentFirewallClient } from "@rakshex/sdk";

const guard = createAgentGuardClient({
  apiKey: process.env.RAKSHEX_API_KEY!,
  privacyMode: "metadata_only",
  failOpen: true,
});

const firewall = createAgentFirewallClient({
  apiKey: process.env.RAKSHEX_API_KEY!,
  workspaceId: 1,
  agentId: "agent_123",
  capabilityToken: process.env.RAKSHEX_CAPABILITY_TOKEN!,
});
```

AgentGuard covers telemetry/privacy/provider wrappers. Agent Firewall authorizes autonomous actions before execution.

> Public package availability must be verified before advertising an npm install command. The repository source is canonical during private beta.

## Python — `rakshex-agentguard`

Source package: `packages/agentguard-python`. It now contains both:

- `AgentGuardClient` / `create_client` — telemetry, privacy modes, provider wrappers and fail-open telemetry ingest.
- `AgentFirewallClient` / `create_firewall_client` — action evaluation, credential brokering, approval consumption and ledger outcome recording.

`AgentFirewallClient` uses the workspace key on `x-api-key`, requires delegated capability input, and fails closed when authorization cannot be obtained.

> `rakshex-agentguard` is **not published on PyPI yet**. Use the source checkout during private beta.

```bash
git clone https://github.com/Akshu1245/Rakshex-complete-codebase.git
cd Rakshex-complete-codebase
pip install -e packages/agentguard-python
pytest packages/agentguard-python/tests
```

For private-beta integrations, configure the gateway URL supplied for the deployment; do not assume a public API hostname until it is operational.

## Guarantees covered by tests

- Default no prompt-content capture in metadata-only telemetry mode
- Fail-open telemetry queue when the telemetry gateway is unavailable
- Provider keys are not forwarded in telemetry bodies
- Agent Firewall authorization is fail-closed
- A DENY does not execute or broker a provider call
- `record_outcome` uses `agentFirewall.ledger.outcome` with the same workspace-key authorization path as evaluation
