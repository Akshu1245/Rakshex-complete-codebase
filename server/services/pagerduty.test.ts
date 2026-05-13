// @ts-nocheck  
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildDedupKey,
  buildPagerDutyBody,
  sendPagerDutyEvent,
  validateRoutingKey,
} from "./pagerduty";

describe("validateRoutingKey", () => {
  it("accepts a 32-char alphanumeric key", () => {
    expect(validateRoutingKey("a".repeat(32))).toBeNull();
  });

  it("rejects too-short keys", () => {
    expect(validateRoutingKey("abc")).toBeTruthy();
  });

  it("rejects keys with special characters", () => {
    expect(validateRoutingKey("abc-".repeat(8))).toBeTruthy();
  });

  it("rejects empty strings", () => {
    expect(validateRoutingKey("")).toBe("routing key required");
  });
});

describe("buildDedupKey", () => {
  it("is stable for the same inputs", () => {
    const a = buildDedupKey(123, "high", "scope1");
    const b = buildDedupKey(123, "high", "scope1");
    expect(a).toBe(b);
  });

  it("differs for different rule ids", () => {
    expect(buildDedupKey(1, "high")).not.toBe(buildDedupKey(2, "high"));
  });

  it("differs for different severities", () => {
    expect(buildDedupKey(1, "high")).not.toBe(buildDedupKey(1, "low"));
  });

  it("returns 32-char hex", () => {
    const k = buildDedupKey(1, "critical");
    expect(k.length).toBe(32);
    expect(/^[a-f0-9]+$/.test(k)).toBe(true);
  });
});

describe("buildPagerDutyBody", () => {
  it("trigger event includes payload + custom_details", () => {
    const body = buildPagerDutyBody({
      routingKey: "k".repeat(32),
      action: "trigger",
      dedupKey: "d".repeat(32),
      summary: "Cost spike detected",
      source: "ojas-gateway",
      severity: "critical",
      customDetails: { current: 500, baseline: 100 },
    }) as {
      routing_key: string;
      event_action: string;
      payload: { summary: string; severity: string; custom_details: unknown };
    };
    expect(body.routing_key).toBe("k".repeat(32));
    expect(body.event_action).toBe("trigger");
    expect(body.payload.summary).toBe("Cost spike detected");
    expect(body.payload.severity).toBe("critical");
    expect(body.payload.custom_details).toEqual({ current: 500, baseline: 100 });
  });

  it("acknowledge omits payload (v2 spec)", () => {
    const body = buildPagerDutyBody({
      routingKey: "k".repeat(32),
      action: "acknowledge",
      dedupKey: "d".repeat(32),
      summary: "x",
      source: "ojas-gateway",
      severity: "low",
    }) as { event_action: string; payload?: unknown };
    expect(body.event_action).toBe("acknowledge");
    expect(body.payload).toBeUndefined();
  });

  it("resolve omits payload", () => {
    const body = buildPagerDutyBody({
      routingKey: "k".repeat(32),
      action: "resolve",
      dedupKey: "d".repeat(32),
      summary: "x",
      source: "s",
      severity: "low",
    }) as { event_action: string; payload?: unknown };
    expect(body.event_action).toBe("resolve");
    expect(body.payload).toBeUndefined();
  });

  it("maps internal severity to PD severity", () => {
    const sevs: Array<["low" | "medium" | "high" | "critical", string]> = [
      ["low", "info"],
      ["medium", "warning"],
      ["high", "error"],
      ["critical", "critical"],
    ];
    for (const [input, pd] of sevs) {
      const body = buildPagerDutyBody({
        routingKey: "k".repeat(32),
        action: "trigger",
        dedupKey: "d".repeat(32),
        summary: "x",
        source: "s",
        severity: input,
      }) as { payload: { severity: string } };
      expect(body.payload.severity).toBe(pd);
    }
  });

  it("clamps long summary to 1024 chars", () => {
    const body = buildPagerDutyBody({
      routingKey: "k".repeat(32),
      action: "trigger",
      dedupKey: "d".repeat(32),
      summary: "x".repeat(2000),
      source: "s",
      severity: "low",
    }) as { payload: { summary: string } };
    expect(body.payload.summary.length).toBe(1024);
  });
});

describe("sendPagerDutyEvent", () => {
  const ORIGINAL_FETCH = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("posts to events.pagerduty.com on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "success", dedup_key: "echo" }), {
        status: 202,
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const res = await sendPagerDutyEvent({
      routingKey: "a".repeat(32),
      action: "trigger",
      dedupKey: "b".repeat(32),
      summary: "x",
      source: "s",
      severity: "high",
    });
    expect(res.ok).toBe(true);
    expect(res.dedupKey).toBe("echo");
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toBe("https://events.pagerduty.com/v2/enqueue");
  });

  it("returns ok=false on bad routing key without making network call", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const res = await sendPagerDutyEvent({
      routingKey: "bad",
      action: "trigger",
      dedupKey: "d".repeat(32),
      summary: "x",
      source: "s",
      severity: "high",
    });
    expect(res.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns ok=false on non-2xx response", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: "Invalid routing key" }), {
          status: 400,
        })
      ) as unknown as typeof fetch;
    const res = await sendPagerDutyEvent({
      routingKey: "a".repeat(32),
      action: "trigger",
      dedupKey: "d".repeat(32),
      summary: "x",
      source: "s",
      severity: "low",
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
    expect(res.errorMessage).toBe("Invalid routing key");
  });
});
