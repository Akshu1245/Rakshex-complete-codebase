# @devpulse/sdk

AI Runtime Telemetry SDK — drop-in wrapper for OpenAI and Anthropic SDKs that captures prompts, responses, tokens, cost, and latency and sends them to the DevPulse monitoring platform.

## Quickstart

```ts
import { DevPulse } from "@devpulse/sdk";
import OpenAI from "openai";

const dp = new DevPulse({
  apiKey: "dp_xxx",
  workspaceId: "ws_xxx",
});

const openai = dp.wrap(new OpenAI());

const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});
// Telemetry automatically captured and sent in batches
```

## Installation

```bash
npm install @devpulse/sdk
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | **required** | DevPulse API key |
| `workspaceId` | `string` | **required** | Workspace to report to |
| `ingestUrl` | `string` | `https://api.devpulse.in/v2/telemetry/events` | Ingest endpoint |
| `sampleRate` | `number` | `1.0` | Fraction of calls to capture (0.0–1.0) |
| `redactPII` | `boolean` | `true` | Strip PII before sending |
| `batchSize` | `number` | `50` | Max events per batch |
| `flushIntervalMs` | `number` | `5000` | Auto-flush interval |
| `maxRetries` | `number` | `3` | Retries with exponential backoff |
| `timeoutMs` | `number` | `10000` | HTTP request timeout |

## Supported Providers

| Provider | Auto-Detect | Wrapper |
|----------|-------------|---------|
| OpenAI | ✅ | `dp.wrap(openai)` or `wrapOpenAI(openai, collector)` |
| Anthropic | ✅ | `dp.wrap(anthropic)` or `wrapAnthropic(anthropic, collector)` |
| AWS Bedrock | Manual capture | `dp.capture(event)` |
| Google Vertex | Manual capture | `dp.capture(event)` |
| Groq / Mistral / DeepSeek | Via OpenAI-compatible API | `dp.wrap(client)` |

## PII Redaction

When `redactPII` is enabled (default), the following patterns are stripped client-side **before any data leaves your environment**:

- Email addresses → `[EMAIL_REDACTED]`
- Phone numbers → `[PHONE_REDACTED]`
- SSN (US) → `[SSN_REDACTED]`
- Credit card numbers → `[CREDIT_CARD_REDACTED]`
- IP addresses → `[IP_REDACTED]`
- API keys (OpenAI, xAI, Google) → `[API_KEY_REDACTED]`
- JWT tokens → `[JWT_REDACTED]`
- AWS access keys → `[AWS_KEY_REDACTED]`
- **Indian PII (DPDP 2023):** Aadhaar, PAN, IFSC, passport numbers

## Manual Capture

For providers without wrappers or custom instrumentation:

```ts
dp.capture({
  provider: "bedrock",
  model: "us.anthropic.claude-3-5-sonnet-20241022",
  inputTokens: 1500,
  outputTokens: 600,
  cachedTokens: 0,
  latencyMs: 2300,
  status: "ok",
  agentId: "my-agent",
  toolCalls: null,
  metadata: { customer_id: "acme" },
});
```

## Shutdown

Call `dp.shutdown()` before process exit to flush remaining events:

```ts
process.on("SIGTERM", async () => {
  await dp.shutdown();
  process.exit(0);
});
```

## License

MIT
