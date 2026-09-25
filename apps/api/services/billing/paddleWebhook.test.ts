import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  normalizePaddleEvent,
  parsePaddleSignature,
  verifyPaddleSignature,
} from "./paddleWebhook";

const SECRET = "test_webhook_secret";

function sign(ts: number, body: string): string {
  const h1 = createHmac("sha256", SECRET).update(`${ts}:${body}`, "utf8").digest("hex");
  return `ts=${ts};h1=${h1}`;
}

describe("parsePaddleSignature", () => {
  it("parses ts and h1", () => {
    const h1 = "a".repeat(64);
    expect(parsePaddleSignature(`ts=1727000000;h1=${h1}`)).toEqual({ ts: "1727000000", h1 });
  });

  it("rejects malformed headers", () => {
    expect(parsePaddleSignature("garbage")).toBeNull();
    expect(parsePaddleSignature("ts=abc;h1=" + "a".repeat(64))).toBeNull();
    expect(parsePaddleSignature("ts=1727000000;h1=short")).toBeNull();
  });
});

describe("verifyPaddleSignature", () => {
  it("accepts a valid signature", () => {
    const body = JSON.stringify({ event_id: "evt_1" });
    const ts = Math.floor(Date.now() / 1000);
    expect(verifyPaddleSignature(body, sign(ts, body), SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const body = JSON.stringify({ event_id: "evt_1" });
    const ts = Math.floor(Date.now() / 1000);
    expect(verifyPaddleSignature(body + " ", sign(ts, body), SECRET)).toBe(false);
  });

  it("rejects stale timestamps", () => {
    const body = JSON.stringify({ event_id: "evt_1" });
    const ts = Math.floor(Date.now() / 1000) - 3600;
    expect(verifyPaddleSignature(body, sign(ts, body), SECRET)).toBe(false);
  });

  it("rejects missing secret or header", () => {
    expect(verifyPaddleSignature("{}", "", SECRET)).toBe(false);
    expect(verifyPaddleSignature("{}", sign(1, "{}"), "")).toBe(false);
  });
});

describe("normalizePaddleEvent", () => {
  it("maps subscription.activated to an active entitlement", () => {
    const n = normalizePaddleEvent({
      event_type: "subscription.activated",
      data: { status: "active", custom_data: { plan: "pro" } },
    });
    expect(n).toEqual({ eventType: "subscription.activated", plan: "pro", status: "active" });
  });

  it("maps subscription.canceled to free/canceled", () => {
    const n = normalizePaddleEvent({
      event_type: "subscription.canceled",
      data: { custom_data: { plan: "pro" } },
    });
    expect(n).toEqual({ eventType: "subscription.canceled", plan: "free", status: "canceled" });
  });

  it("ignores non-entitlement events", () => {
    expect(normalizePaddleEvent({ event_type: "transaction.completed", data: {} })).toBeNull();
    expect(normalizePaddleEvent({ event_type: "unknown.thing", data: {} })).toBeNull();
  });
});
