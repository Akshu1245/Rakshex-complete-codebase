/**
 * Contract tests: security guarantees of the AgentGuard SDK.
 */
import { describe, expect, it, vi } from "vitest";
import { createAgentGuardClient, looksLikeProviderKey, scrubMetadataKeys } from "./index.js";

describe("security contracts", () => {
  it("never puts provider API keys in outbound telemetry body", async () => {
    let body = "";
    let authHeader = "";
    const fetchImpl = vi.fn(async (_u: string, init?: RequestInit) => {
      body = String(init?.body ?? "");
      const headers = init?.headers as Record<string, string> | undefined;
      authHeader = headers?.authorization ?? "";
      return new Response("{}", { status: 200 });
    });

    const client = createAgentGuardClient({
      apiKey: "rx_workspace_only",
      flushIntervalMs: 0,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    client.capture({
      provider: "openai",
      model: "gpt-4o",
      metadata: {
        openai_api_key: "sk-abcdefghijklmnopqrstuvwxyz123456",
        note: "ok",
      },
      prompt: "sk-abcdefghijklmnopqrstuvwxyz123456 should not appear as content",
    });
    await client.flush();

    expect(body).not.toContain("sk-abcdefghijklmnopqrstuvwxyz");
    expect(body).toContain("[REDACTED]");
    // Workspace key is header-only, never in JSON body
    expect(body).not.toContain("rx_workspace_only");
    expect(authHeader).toBe("Bearer rx_workspace_only");
    expect(authHeader).not.toMatch(/sk-/);
    await client.close();
  });

  it("scrubMetadataKeys redacts secret-shaped fields", () => {
    expect(scrubMetadataKeys({ Authorization: "Bearer x", safe: 1 }).Authorization).toBe(
      "[REDACTED]",
    );
    expect(looksLikeProviderKey("sk-abcdefghijklmnopqrstuvwxyz123456")).toBe(true);
  });
});
