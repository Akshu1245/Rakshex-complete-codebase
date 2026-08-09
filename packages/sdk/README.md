# @rakshex/sdk

The Rakshex runtime SDK. Ships two clients:

- **AgentGuardClient** — capture LLM usage metadata, enforce privacy modes, and ship telemetry safely. Documented below.
- **AgentFirewallClient** — authorize an autonomous agent action before it runs, optionally have Rakshex broker the provider call itself, and record the outcome. See [Agent Firewall client](#agent-firewall-client) below, and `docs/SDK.md` / `CLAUDE.md` for why both live in one package (renamed from `@rakshex/agentguard-sdk` on 2026-08-09).

## Install

```bash
pnpm add @rakshex/sdk
# or: npm install @rakshex/sdk
```

## AgentGuard client

### Quick start

```ts
import { createAgentGuardClient, wrapOpenAI } from "@rakshex/sdk";

const guard = createAgentGuardClient({
  apiKey: process.env.RAKSHEX_API_KEY!, // workspace key — NOT an OpenAI key
  gatewayUrl: process.env.RAKSHEX_GATEWAY_URL,
  privacyMode: "metadata_only", // default — no prompt content
  failOpen: true, // app continues if telemetry is down
});

// Manual capture
guard.capture({
  provider: "openai",
  model: "gpt-4o-mini",
  inputTokens: 120,
  outputTokens: 40,
  latencyMs: 350,
  correlationId: guard.correlationId(),
});

// Provider wrapper (OpenAI client keeps its own key)
const openaiWrap = wrapOpenAI(guard);
// await openaiWrap.chatCompletionsCreate(openaiClient, { model, messages });

await guard.flush();
await guard.close();
```

## Enforced gateway calls (no employee provider key)

Create a workspace API key with the `gateway:invoke` scope and connect an
`api_key` or `inference_api_key` credential to an OpenAI/OpenAI-compatible
provider account in the Rakshex control plane. Employees receive only the
Rakshex workspace key.

```ts
const result = await guard.gatewayChatCompletions({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Summarize this incident" }],
});
```

This method is always fail-closed. Active workspace/project/identity/agent
kill switches, hard gateway budgets, authentication failures, and governance
store outages block before the provider call. The `failOpen` option applies
only to telemetry delivery.

Existing OpenAI-compatible clients can use
`https://api.rakshex.com/v1/chat/completions` as their base endpoint to retain
streaming support. Send optional `X-Rakshex-Project-Id`,
`X-Rakshex-Agent-Id`, and `X-Rakshex-Identity-Id` headers for scoped controls
and attribution.

## Privacy modes

| Mode                      | Prompt/response content | Network |
| ------------------------- | ----------------------- | ------- |
| `metadata_only` (default) | Hashes only             | Yes     |
| `redacted_content`        | Secrets redacted        | Yes     |
| `full_content`            | Secrets redacted        | Yes     |
| `local_only`              | Offline queue only      | No      |
| `zero_retention`          | Nothing stored          | No      |

**Never** capture prompt content by default. Provider API keys must never be passed as `apiKey` or in metadata.

## Providers

- OpenAI — `wrapOpenAI`
- Anthropic — `wrapAnthropic`
- Gemini — `wrapGemini`
- Azure OpenAI — `wrapAzureOpenAI`
- AWS Bedrock — `wrapBedrock`
- OpenRouter — `wrapOpenRouter`

## Resilience

- **Fail-open telemetry** (default): telemetry failures queue offline.
- **Fail-closed enforcement**: gateway model calls never bypass policy or fall back to direct provider traffic.
- **Batching**: `batchSize` + `flushIntervalMs`.
- **Retry** with exponential backoff on 5xx / network errors.
- **Offline queue**: memory and optional `offlineQueuePath` JSONL file.

## Captured fields

Tokens, latency, cost (estimate/exact), errors, retries, tool calls (names + arg keys), agent steps, correlation IDs. Not prompt bodies in `metadata_only`.

## Security

- SDK never logs or forwards provider API keys to the gateway.
- Metadata keys matching `api_key`, `authorization`, `secret`, etc. are redacted.
- Authorization header uses only the Rakshex workspace key.

## Agent Firewall client

Authorize an autonomous action before it runs. This is the client for
Rakshex's headline feature — semantic actions, delegated authority, a
hash-chained Action Ledger, and (optionally) credential mediation so a DENY
is enforceable rather than advisory.

```ts
import { createAgentFirewallClient } from "@rakshex/sdk";

const firewall = createAgentFirewallClient({
  apiKey: process.env.RAKSHEX_API_KEY!, // rk_... workspace key
  workspaceId: 1,
  agentId: "agent_123",
  capabilityToken: process.env.RAKSHEX_CAPABILITY_TOKEN!, // rk_cap_... delegated authority
});

// Option A: your process holds the real provider key. RaksHex only decides.
const { decision, result } = await firewall.authorizeAndRun(
  { provider: "stripe", operation: "financial.refund", amountMinor: 5000, currency: "USD" },
  async () => stripe.refunds.create({ /* ... */ }),
);

// Option B: RaksHex holds the provider key and makes the call itself — a DENY
// is enforced by RaksHex, not by whether your code chose to honor it.
const { decision: d2, response } = await firewall.executeWithCredential(
  { provider: "stripe", operation: "financial.refund", amountMinor: 5000, currency: "USD" },
  { credentialId: "cred_...", targetUrl: "https://api.stripe.com/v1/refunds" },
);
```

An API key scoped to `agent:execute` only (the recommended least-privilege
deployment shape) is sufficient for every call this client makes —
`evaluate`, `credentials.broker`, `ledger.outcome`, and
`approvals.consume` all authorize on that scope, not on the calling user's
full workspace RBAC role.

## Examples

See [`examples/`](./examples/).

## Contract tests

```bash
pnpm test
pnpm typecheck
pnpm build
```
