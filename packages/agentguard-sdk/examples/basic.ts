/**
 * Example: basic AgentGuard capture with metadata_only privacy.
 * Run after install: node --import tsx examples/basic.ts
 */
import { createAgentGuardClient } from "../src/index.js";

const guard = createAgentGuardClient({
  apiKey: process.env.RAKSHEX_API_KEY ?? "rx_dev_example",
  gatewayUrl: process.env.RAKSHEX_GATEWAY_URL ?? "http://localhost:3001",
  privacyMode: "metadata_only",
  agentId: "example-agent",
  failOpen: true,
});

const correlationId = guard.correlationId();

guard.capture({
  provider: "openai",
  model: "gpt-4o-mini",
  correlationId,
  inputTokens: 100,
  outputTokens: 50,
  latencyMs: 420,
  costUsd: 0.0002,
  costKind: "estimate",
  toolCalls: [{ name: "web_search", argKeys: ["query"], latencyMs: 80 }],
  agentSteps: [
    { step: 1, kind: "planner", name: "plan" },
    { step: 2, kind: "llm", name: "complete" },
  ],
  // Prompt is hashed only in metadata_only — never sent raw
  prompt: "user private question",
});

await guard.flush();
await guard.close();
console.log("flushed (or queued offline if gateway unavailable)");
