# @rakshex/agentguard-sdk

Runtime SDK for Rakshex AgentGuard — capture LLM usage metadata, enforce privacy modes, and ship telemetry safely.

## Install

```bash
pnpm add @rakshex/agentguard-sdk
# or: npm install @rakshex/agentguard-sdk
```

## Quick start

```ts
import { createAgentGuardClient, wrapOpenAI } from "@rakshex/agentguard-sdk";

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

## Examples

See [`examples/`](./examples/).

## Contract tests

```bash
pnpm test
pnpm typecheck
pnpm build
```
