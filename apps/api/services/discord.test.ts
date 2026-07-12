// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildDiscordBody, sendDiscordAlert, validateDiscordWebhookUrl } from "./discord";

describe("validateDiscordWebhookUrl", () => {
  it("accepts discord.com webhook url", () => {
    expect(
      validateDiscordWebhookUrl("https://discord.com/api/webhooks/12345/abcde-token"),
    ).toBeNull();
  });

  it("accepts discordapp.com webhook url", () => {
    expect(
      validateDiscordWebhookUrl("https://discordapp.com/api/webhooks/12345/abcde-token"),
    ).toBeNull();
  });

  it("rejects non-https", () => {
    expect(validateDiscordWebhookUrl("http://discord.com/api/webhooks/12345/abcde-token")).toBe(
      "must be https",
    );
  });

  it("rejects non-discord host", () => {
    expect(validateDiscordWebhookUrl("https://evil.example.com/api/webhooks/x/y")).toBe(
      "must be a discord.com webhook",
    );
  });

  it("rejects unparseable URL", () => {
    expect(validateDiscordWebhookUrl("not a url at all")).toBe("must be a valid URL");
  });

  it("rejects path that is not /api/webhooks/", () => {
    expect(validateDiscordWebhookUrl("https://discord.com/api/users/@me")).toBe(
      "must point to /api/webhooks/...",
    );
  });
});

describe("buildDiscordBody", () => {
  const ts = new Date("2026-05-08T10:00:00Z");

  it("includes severity emoji + color", () => {
    const body = buildDiscordBody({
      webhookUrl: "https://discord.com/api/webhooks/x/y",
      title: "Cost spike",
      description: "spend tripled",
      severity: "critical",
      timestamp: ts,
    }) as { embeds: Array<{ title: string; color: number }> };
    expect(body.embeds[0].title).toContain("🚨");
    expect(body.embeds[0].title).toContain("Cost spike");
    expect(body.embeds[0].color).toBe(0xdc2626);
  });

  it("uses default Ojas Security username", () => {
    const body = buildDiscordBody({
      webhookUrl: "https://discord.com/api/webhooks/x/y",
      title: "x",
      description: "y",
      severity: "low",
    }) as { username: string };
    expect(body.username).toBe("Ojas Security");
  });

  it("respects custom username + avatar", () => {
    const body = buildDiscordBody({
      webhookUrl: "https://discord.com/api/webhooks/x/y",
      title: "x",
      description: "y",
      severity: "low",
      username: "MyOrg Sec",
      avatarUrl: "https://example.com/a.png",
    }) as { username: string; avatar_url: string };
    expect(body.username).toBe("MyOrg Sec");
    expect(body.avatar_url).toBe("https://example.com/a.png");
  });

  it("clamps fields to MAX_FIELDS", () => {
    const fields = Array.from({ length: 50 }, (_, i) => ({
      name: `f${i}`,
      value: `v${i}`,
    }));
    const body = buildDiscordBody({
      webhookUrl: "https://discord.com/api/webhooks/x/y",
      title: "x",
      description: "y",
      severity: "low",
      fields,
    }) as { embeds: Array<{ fields: unknown[] }> };
    expect(body.embeds[0].fields).toHaveLength(25);
  });

  it("truncates long field values", () => {
    const fields = [{ name: "f", value: "x".repeat(2000) }];
    const body = buildDiscordBody({
      webhookUrl: "https://discord.com/api/webhooks/x/y",
      title: "x",
      description: "y",
      severity: "low",
      fields,
    }) as { embeds: Array<{ fields: Array<{ value: string }> }> };
    expect(body.embeds[0].fields[0].value.length).toBe(1024);
    expect(body.embeds[0].fields[0].value.endsWith("…")).toBe(true);
  });
});

describe("sendDiscordAlert", () => {
  const ORIGINAL_FETCH = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("posts JSON body and returns ok=true on 204", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const res = await sendDiscordAlert({
      webhookUrl: "https://discord.com/api/webhooks/123/xyz",
      title: "t",
      description: "d",
      severity: "medium",
    });
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toContain("/api/webhooks/123/xyz");
    expect(call[1].method).toBe("POST");
  });

  it("returns ok=false on non-2xx", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
    const res = await sendDiscordAlert({
      webhookUrl: "https://discord.com/api/webhooks/123/xyz",
      title: "t",
      description: "d",
      severity: "high",
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(429);
  });

  it("does not call fetch on invalid url", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const res = await sendDiscordAlert({
      webhookUrl: "https://evil.example.com/x",
      title: "t",
      description: "d",
      severity: "low",
    });
    expect(res.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
