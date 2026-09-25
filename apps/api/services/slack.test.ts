// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSlackBlocks, sendSlackAlert } from "./slack";
import { ENV } from "../_core/env";

const asMutable = (o: object) => o as Record<string, unknown>;

describe("buildSlackBlocks", () => {
  it("renders header + summary + fields", () => {
    const blocks = buildSlackBlocks({
      title: "Spend ceiling warning",
      summary: "used $88 of $100",
      severity: "high",
      fields: [{ name: "cost_usd", value: "$88.00" }],
      signalLabel: "observed",
    });
    const text = JSON.stringify(blocks);
    expect(text).toContain("Spend ceiling warning");
    expect(text).toContain("$88.00");
    expect(text).toContain("observed");
  });

  it("renders Approve/Reject buttons only when signed URLs exist", () => {
    const withActions = buildSlackBlocks({
      title: "t",
      summary: "s",
      severity: "critical",
      approval: {
        approveUrl: "https://api.example.com/api/approval-callbacks?sig=a",
        rejectUrl: "https://api.example.com/api/approval-callbacks?sig=r",
      },
    });
    const actions = withActions.find((b) => b.type === "actions");
    expect(actions).toBeDefined();
    expect(JSON.stringify(actions)).toContain("approval-callbacks?sig=a");

    const withoutActions = buildSlackBlocks({
      title: "t",
      summary: "s",
      severity: "critical",
      approval: { approveUrl: null, rejectUrl: null },
    });
    expect(withoutActions.some((b) => b.type === "actions")).toBe(false);
  });
});

describe("sendSlackAlert", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("ok", { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = realFetch;
  });

  it("webhook fallback mode posts blocks to the webhook URL", async () => {
    asMutable(ENV).slackBotToken = "";
    asMutable(ENV).slackWebhookUrl = "";
    const r = await sendSlackAlert(
      { webhookUrl: "https://hooks.slack.com/services/T/x" },
      { title: "t", summary: "s", severity: "medium" },
    );
    expect(r).toMatchObject({ ok: true, status: 200, mode: "webhook" });
    const [url, init] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://hooks.slack.com/services/T/x");
    expect(JSON.parse(init.body).blocks).toBeDefined();
  });

  it("bot mode uses chat.postMessage when token + channelId are set", async () => {
    asMutable(ENV).slackBotToken = "xoxb-test";
    const r = await sendSlackAlert(
      { channelId: "C123" },
      { title: "t", summary: "s", severity: "low" },
    );
    expect(r).toMatchObject({ ok: true, mode: "bot" });
    const [url, init] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://slack.com/api/chat.postMessage");
    expect(init.headers.Authorization).toBe("Bearer xoxb-test");
    expect(JSON.parse(init.body).channel).toBe("C123");
    asMutable(ENV).slackBotToken = "";
  });

  it("reports unconfigured when nothing is set", async () => {
    asMutable(ENV).slackBotToken = "";
    asMutable(ENV).slackWebhookUrl = "";
    const r = await sendSlackAlert({}, { title: "t", summary: "s", severity: "low" });
    expect(r).toMatchObject({ ok: false, mode: "unconfigured" });
    expect((globalThis.fetch as any).mock.calls.length).toBe(0);
  });

  it("never throws on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("boom");
      }),
    );
    const r = await sendSlackAlert(
      { webhookUrl: "https://hooks.slack.com/services/T/x" },
      { title: "t", summary: "s", severity: "low" },
    );
    expect(r.ok).toBe(false);
    expect(r.errorMessage).toBe("boom");
  });
});
