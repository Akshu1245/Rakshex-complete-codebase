import { describe, expect, it, vi } from "vitest";
import {
  applyPrivacy,
  createAgentGuardClient,
  looksLikeProviderKey,
  OfflineQueue,
  redactSecrets,
  scrubMetadataKeys,
  wrapOpenAI,
} from "./index.js";
import type { UsageEvent } from "./types.js";

function baseEvent(overrides: Partial<UsageEvent> = {}): UsageEvent {
  return {
    eventId: "e1",
    correlationId: "c1",
    provider: "openai",
    model: "gpt-4o-mini",
    requestTimestamp: new Date().toISOString(),
    latencyMs: 10,
    inputTokens: 5,
    outputTokens: 7,
    cachedTokens: 0,
    costUsd: 0.001,
    costKind: "estimate",
    status: "ok",
    retryCount: 0,
    toolCalls: [{ name: "search", argKeys: ["q"] }],
    agentSteps: [],
    promptContent: "secret sk-abcdefghijklmnopqrstuvwxyz123456 and hello",
    responseContent: "ok",
    redactionCount: 0,
    metadata: { api_key: "should-go", safe: true },
    sdkVersion: "0.1.0",
    ...overrides,
  };
}

describe("privacy", () => {
  it("metadata_only strips prompt content", () => {
    const e = applyPrivacy(baseEvent(), "metadata_only");
    expect(e.promptContent).toBeUndefined();
    expect(e.responseContent).toBeUndefined();
    expect(e.metadata.api_key).toBe("[REDACTED]");
    expect(e.metadata.safe).toBe(true);
  });

  it("redacted_content keeps content without secrets", () => {
    const e = applyPrivacy(baseEvent(), "redacted_content");
    expect(e.promptContent).toContain("[REDACTED_API_KEY]");
    expect(e.promptContent).not.toContain("sk-abcdefghijklmnop");
    expect(e.redactionCount).toBeGreaterThan(0);
  });

  it("detects provider key shapes", () => {
    expect(looksLikeProviderKey("sk-abcdefghijklmnopqrstuvwxyz123456")).toBe(true);
    expect(looksLikeProviderKey("rx_workspace_live_abc")).toBe(false);
  });

  it("redactSecrets and scrubMetadataKeys", () => {
    const { count } = redactSecrets("Bearer abcdefghijklmnopqrstuvwxyz012345");
    expect(count).toBeGreaterThan(0);
    expect(scrubMetadataKeys({ openai_api_key: "x", ok: 1 }).openai_api_key).toBe("[REDACTED]");
  });
});

describe("AgentGuardClient", () => {
  it("does not capture prompt by default", async () => {
    const sent: unknown[] = [];
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;

    const client = createAgentGuardClient({
      apiKey: "rx_test_key_not_a_provider_key",
      gatewayUrl: "http://localhost:9999",
      privacyMode: "metadata_only",
      flushIntervalMs: 0,
      fetchImpl,
    });

    const event = client.capture({
      provider: "openai",
      model: "gpt-4o",
      prompt: "do not leak this prompt",
      response: "answer",
      inputTokens: 10,
      outputTokens: 20,
      latencyMs: 50,
    });

    expect(event.promptContent).toBeUndefined();
    expect(event.promptHash).toBeDefined();
    expect(event.promptHash).toHaveLength(64);

    await client.flush();
    expect(fetchImpl).toHaveBeenCalled();
    const body = sent[0] as { events: UsageEvent[] };
    expect(body.events[0]?.promptContent).toBeUndefined();
    await client.close();
  });

  it("fail-open queues offline when gateway down", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const client = createAgentGuardClient({
      apiKey: "rx_test",
      gatewayUrl: "http://localhost:1",
      failOpen: true,
      flushIntervalMs: 0,
      maxRetries: 0,
      fetchImpl,
    });

    client.capture({ provider: "anthropic", model: "claude", inputTokens: 1 });
    const result = await client.flush();
    expect(result.ok).toBe(false);
    expect(result.queuedOffline).toBe(true);
    expect(client.getOfflineQueueSize()).toBeGreaterThan(0);
    await client.close();
  });

  it("wrapCall rethrows provider errors and still captures", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("{}", { status: 200 }),
    ) as unknown as typeof fetch;
    const client = createAgentGuardClient({
      apiKey: "rx_test",
      flushIntervalMs: 0,
      fetchImpl,
    });

    await expect(
      client.wrapCall({
        provider: "openai",
        model: "gpt",
        fn: async () => {
          throw new Error("rate limited");
        },
      }),
    ).rejects.toThrow("rate limited");

    await client.flush();
    await client.close();
  });

  it("assigns correlation ids", () => {
    const client = createAgentGuardClient({ apiKey: "rx_test", flushIntervalMs: 0 });
    const a = client.correlationId();
    const b = client.correlationId(a);
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(8);
  });
});

describe("provider wrappers", () => {
  it("wrapOpenAI extracts usage without leaking keys", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("{}", { status: 200 }),
    ) as unknown as typeof fetch;
    const client = createAgentGuardClient({
      apiKey: "rx_test",
      flushIntervalMs: 0,
      fetchImpl,
    });
    const openai = wrapOpenAI(client);
    const fakeClient = {
      chat: {
        completions: {
          create: async () => ({
            usage: { prompt_tokens: 11, completion_tokens: 22 },
            choices: [],
          }),
        },
      },
    };
    // Provider key lives only on "real" client env — we never pass it here
    const res = await openai.chatCompletionsCreate(fakeClient, {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.usage?.prompt_tokens).toBe(11);
    await client.close();
  });
});

describe("OfflineQueue", () => {
  it("respects max size", () => {
    const q = new OfflineQueue({ max: 2 });
    q.enqueue(baseEvent({ eventId: "1" }));
    q.enqueue(baseEvent({ eventId: "2" }));
    q.enqueue(baseEvent({ eventId: "3" }));
    expect(q.size).toBe(2);
    expect(q.peek(10)[0]?.eventId).toBe("2");
    q.markFlushed(1);
    expect(q.size).toBe(1);
  });
});
