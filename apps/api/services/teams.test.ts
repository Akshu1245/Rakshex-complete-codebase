// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildTeamsCard, sendTeamsAlert } from "./teams";
import { ENV } from "../_core/env";

const asMutable = (o: object) => o as Record<string, unknown>;

describe("buildTeamsCard", () => {
  it("renders a MessageCard with facts and signal label", () => {
    const card = buildTeamsCard({
      title: "Spend ceiling hit",
      summary: "used $101 of $100",
      severity: "critical",
      facts: [{ name: "cost_usd", value: "$101.00" }],
      signalLabel: "exact",
    });
    expect(card["@type"]).toBe("MessageCard");
    expect(card.themeColor).toBe("D13438");
    const text = JSON.stringify(card);
    expect(text).toContain("$101.00");
    expect(text).toContain("exact");
  });

  it("renders Approve/Reject as OpenUri actions only when signed URLs exist", () => {
    const card = buildTeamsCard({
      title: "t",
      summary: "s",
      severity: "high",
      approval: {
        approveUrl: "https://api.example.com/api/approval-callbacks?sig=a",
        rejectUrl: "https://api.example.com/api/approval-callbacks?sig=r",
      },
    });
    const actions = card.potentialAction;
    expect(actions).toHaveLength(2);
    expect(actions[0]["@type"]).toBe("OpenUri");
    expect(actions[0].targets[0].uri).toContain("sig=a");
    expect(actions[1].targets[0].uri).toContain("sig=r");

    const plain = buildTeamsCard({
      title: "t",
      summary: "s",
      severity: "high",
      approval: { approveUrl: null, rejectUrl: null },
    });
    expect(plain.potentialAction).toBeUndefined();
  });

  it("adds the dashboard link as an action", () => {
    const card = buildTeamsCard({
      title: "t",
      summary: "s",
      severity: "low",
      url: "https://app.example.com/d/1",
    });
    expect(card.potentialAction).toHaveLength(1);
    expect(card.potentialAction[0].name).toBe("Open in RaksHex");
  });
});

describe("sendTeamsAlert", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("1", { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = realFetch;
    asMutable(ENV).teamsWebhookUrl = "";
  });

  it("posts the card to the configured webhook URL", async () => {
    const r = await sendTeamsAlert(
      { webhookUrl: "https://outlook.office.com/webhook/x" },
      { title: "t", summary: "s", severity: "medium" },
    );
    expect(r).toMatchObject({ ok: true, status: 200, mode: "webhook" });
    const [url, init] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("https://outlook.office.com/webhook/x");
    expect(JSON.parse(init.body)["@type"]).toBe("MessageCard");
  });

  it("falls back to TEAMS_WEBHOOK_URL env", async () => {
    asMutable(ENV).teamsWebhookUrl = "https://outlook.office.com/webhook/env";
    const r = await sendTeamsAlert({}, { title: "t", summary: "s", severity: "low" });
    expect(r.ok).toBe(true);
    expect((globalThis.fetch as any).mock.calls[0][0]).toBe(
      "https://outlook.office.com/webhook/env",
    );
  });

  it("reports unconfigured when no webhook is set", async () => {
    const r = await sendTeamsAlert({}, { title: "t", summary: "s", severity: "low" });
    expect(r).toMatchObject({ ok: false, mode: "unconfigured" });
    expect((globalThis.fetch as any).mock.calls.length).toBe(0);
  });

  it("rejects non-https webhook URLs", async () => {
    const r = await sendTeamsAlert(
      { webhookUrl: "http://evil.example.com/hook" },
      { title: "t", summary: "s", severity: "low" },
    );
    expect(r.ok).toBe(false);
    expect(r.errorMessage).toContain("https");
  });
});
