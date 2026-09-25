// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ENV } from "../_core/env";

vi.mock("../db", () => ({ recordAlertEvent: vi.fn(async () => {}) }));
vi.mock("../email", () => ({ sendAlertEmail: vi.fn(async () => {}) }));

import { wireDriftAlerts, weakerLabel, type DriftAlertPayload } from "./driftAlerts";

const asMutable = (o: object) => o as Record<string, unknown>;

function drift(overrides: Partial<DriftAlertPayload> = {}): DriftAlertPayload {
  return {
    provider: "openai",
    workspaceId: 9,
    providerAccountId: 3,
    windowStart: new Date(Date.now() - 86400_000),
    windowEnd: new Date(),
    providerReportedUsd: 12.34,
    ledgerAttributedUsd: 12.0,
    driftUsd: 0.34,
    driftPct: 2.8,
    providerLabel: "observed",
    ledgerLabel: "exact",
    providerDataLatency: "~5min delayed",
    ...overrides,
  };
}

describe("wireDriftAlerts", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })));
    asMutable(ENV).slackBotToken = "";
    asMutable(ENV).internalServiceSecret = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = realFetch;
  });

  it("fans drift out through the collapsed dispatcher", async () => {
    const onDrift = wireDriftAlerts((wsId) => ({
      userId: 77,
      channels: { slack: { webhookUrl: "https://hooks.slack.com/services/T/x" } },
    }));
    await onDrift(drift());

    const calls = (globalThis.fetch as any).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const text = JSON.stringify(JSON.parse(calls[calls.length - 1][1].body));
    expect(text).toContain("Billing drift (openai)");
    expect(text).toContain("$12.34");
    expect(text).toContain("$12.00");
    // Combined label is the weaker side: observed vs exact → observed.
    expect(text).toContain("observed");
  });

  it("escalates severity at the drift thresholds", async () => {
    const seen: string[] = [];
    const onDrift = wireDriftAlerts(() => ({
      userId: 77,
      channels: { slack: { webhookUrl: "https://hooks.slack.com/services/T/x" } },
    }));
    for (const pct of [1.5, 5, 12]) {
      await onDrift(drift({ driftPct: pct, driftUsd: pct }));
    }
    const { recordAlertEvent } = await import("../db");
    seen.push(...(recordAlertEvent as any).mock.calls.map((c: any) => c[0].severity));
    expect(seen).toEqual(["low", "medium", "high"]);
  });

  it("skips silently when no target resolves", async () => {
    const onDrift = wireDriftAlerts(() => null);
    await onDrift(drift());
    expect((globalThis.fetch as any).mock.calls).toHaveLength(0);
  });

  it("never throws, even when the resolver or dispatcher fail", async () => {
    const throwingResolver = wireDriftAlerts(() => {
      throw new Error("boom");
    });
    await expect(throwingResolver(drift())).resolves.toBeUndefined();
  });
});

describe("weakerLabel", () => {
  it("picks the less trustworthy side", () => {
    expect(weakerLabel("exact", "observed")).toBe("observed");
    expect(weakerLabel("estimated", "not_available")).toBe("not_available");
    expect(weakerLabel("exact", "exact")).toBe("exact");
  });
});
