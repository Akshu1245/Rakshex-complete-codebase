// @ts-nocheck
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ENV } from "../_core/env";
import { verifyApprovalCallback } from "./approvalCallbacks";

vi.mock("../db", () => ({ recordAlertEvent: vi.fn(async () => {}) }));
vi.mock("../email", () => ({ sendAlertEmail: vi.fn(async () => {}) }));
vi.mock("./webhookDelivery", () => ({
  deliver: vi.fn(async () => [{ status: "delivered" }]),
}));

import { recordAlertEvent } from "../db";
import { sendAlertEmail } from "../email";
import {
  dispatchAlert,
  fireApprovalRequest,
  fireCeilingAlert,
  type FiredAlert,
} from "./alertDispatcher";

const asMutable = (o: object) => o as Record<string, unknown>;

function fired(overrides: Partial<FiredAlert> = {}): FiredAlert {
  return {
    ruleId: 7,
    userId: 42,
    ruleName: "Test rule",
    severity: "high",
    summary: "test summary",
    matched: [],
    snapshots: [],
    channels: {},
    signalLabel: "observed",
    ...overrides,
  };
}

function lastFetchBody() {
  const calls = (globalThis.fetch as any).mock.calls;
  return JSON.parse(calls[calls.length - 1][1].body);
}

describe("dispatcher collapse", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("ok", { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = realFetch;
  });

  it("no dead discord/pagerduty references in the alert surface", () => {
    for (const f of [
      "services/alertDispatcher.ts",
      "services/alertRules.ts",
      "api/alerts.ts",
    ]) {
      const src = readFileSync(f, "utf8");
      expect(src.toLowerCase()).not.toContain("discord");
      expect(src.toLowerCase()).not.toContain("pagerduty");
    }
  });

  it("fires nothing when no channels are configured", async () => {
    const outcomes = await dispatchAlert(fired());
    expect(outcomes).toEqual([]);
    expect(recordAlertEvent).not.toHaveBeenCalled();
  });

  it("only supports email / webhook / slack / teams", async () => {
    const outcomes = await dispatchAlert(
      fired({
        channels: {
          emailTo: ["ops@example.com"],
          webhookEndpointIds: [1],
          slack: { webhookUrl: "https://hooks.slack.com/services/T/x" },
          teams: { webhookUrl: "https://outlook.office.com/webhook/x" },
        },
      }),
    );
    const channels = outcomes.map((o) => o.channel).sort();
    expect(channels).toEqual(["email", "slack", "teams", "webhook"]);
    expect(sendAlertEmail).toHaveBeenCalledWith(
      expect.objectContaining({ toEmail: "ops@example.com" }),
    );
    expect(recordAlertEvent).toHaveBeenCalledTimes(4);
  });
});

describe("fireCeilingAlert", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("ok", { status: 200 })),
    );
    asMutable(ENV).slackBotToken = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = realFetch;
  });

  it("88% warning is high severity with the honesty label", async () => {
    await fireCeilingAlert(
      42,
      {
        scopeType: "workspace",
        scopeId: "ws_1",
        ceilingUsd: 100,
        usedUsd: 88,
        estimatedUsd: 95,
        signalLabel: "estimated",
      },
      { slack: { webhookUrl: "https://hooks.slack.com/services/T/x" } },
    );
    const body = lastFetchBody();
    const text = JSON.stringify(body);
    expect(text).toContain("warning");
    expect(text).toContain("88.0%");
    expect(text).toContain("estimated");
    expect(recordAlertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "high", channel: "slack", ruleId: 0 }),
    );
  });

  it("ceiling hit is critical severity", async () => {
    await fireCeilingAlert(
      42,
      {
        scopeType: "workspace",
        scopeId: "ws_1",
        ceilingUsd: 100,
        usedUsd: 101.5,
        signalLabel: "exact",
      },
      { emailTo: ["ops@example.com"] },
    );
    expect(sendAlertEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining("CRITICAL") }),
    );
    const emailText = (sendAlertEmail as any).mock.calls[0][0].text;
    expect(emailText).toContain("HIT");
    expect(emailText).toContain("signal: exact");
  });
});

describe("fireApprovalRequest", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("ok", { status: 200 })),
    );
    asMutable(ENV).slackBotToken = "";
    asMutable(ENV).internalServiceSecret = "test-server-secret-that-is-long-enough";
    asMutable(ENV).appUrl = "https://api.example.com";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = realFetch;
    asMutable(ENV).internalServiceSecret = "";
  });

  it("embeds signed approve/reject URLs that verify", async () => {
    await fireApprovalRequest(
      42,
      { approvalId: "apr_42", actionSummary: "financial.refund $12.50" },
      { slack: { webhookUrl: "https://hooks.slack.com/services/T/x" } },
    );
    const body = lastFetchBody();
    const actions = body.blocks.find((b: any) => b.type === "actions");
    expect(actions.elements).toHaveLength(2);
    for (const el of actions.elements) {
      const q = new URL(el.url).searchParams;
      const v = verifyApprovalCallback(
        {
          approvalId: q.get("approvalId") ?? undefined,
          decision: q.get("decision") ?? undefined,
          exp: q.get("exp") ?? undefined,
          sig: q.get("sig") ?? undefined,
        },
        Date.now(),
        "test-server-secret-that-is-long-enough",
      );
      expect(v).toEqual({
        ok: true,
        approvalId: "apr_42",
        decision: el.action_id,
      });
    }
  });

  it("omits actions when the signing secret is unavailable", async () => {
    asMutable(ENV).internalServiceSecret = "";
    await fireApprovalRequest(
      42,
      { approvalId: "apr_42", actionSummary: "financial.refund $12.50" },
      { slack: { webhookUrl: "https://hooks.slack.com/services/T/x" } },
    );
    const body = lastFetchBody();
    expect(body.blocks.some((b: any) => b.type === "actions")).toBe(false);
  });
});
