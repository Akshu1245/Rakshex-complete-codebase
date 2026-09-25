import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import {
  billingWebhookSignature,
  dispatchBillingWebhook,
  verifyBillingWebhookSignature,
  type BillingWebhookEvent,
} from "./billingEvents";

const SECRET = "test-secret-123";

function billingEvent(): BillingWebhookEvent {
  return {
    type: "usage.threshold_exceeded",
    workspaceId: "ws-1",
    occurredAt: new Date().toISOString(),
    data: { used: 101, limit: 100, overageUnits: 1 },
  };
}

let servers: Server[] = [];
afterEach(() => {
  for (const s of servers) s.close();
  servers = [];
});

function listen(handler: (req: any, res: any) => void): Promise<string> {
  return new Promise((resolve) => {
    const server = createServer(handler);
    servers.push(server);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve(`http://127.0.0.1:${(addr as any).port}/hook`);
    });
  });
}

describe("billing webhook events", () => {
  it("signs and verifies deterministically", () => {
    const body = JSON.stringify({ a: 1 });
    const sig = billingWebhookSignature({
      secret: SECRET,
      timestamp: "123",
      eventType: "billing.cycle_closed",
      body,
    });
    expect(
      verifyBillingWebhookSignature({
        secret: SECRET,
        timestamp: "123",
        eventType: "billing.cycle_closed",
        body,
        signatureHex: sig,
      }),
    ).toBe(true);
    expect(
      verifyBillingWebhookSignature({
        secret: SECRET,
        timestamp: "123",
        eventType: "billing.cycle_closed",
        body: body + "tampered",
        signatureHex: sig,
      }),
    ).toBe(false);
  });

  it("delivers the signed event with identity headers", async () => {
    let seenHeaders: Record<string, string> = {};
    let seenBody = "";
    const url = await listen((req, res) => {
      seenHeaders = req.headers;
      let chunks = "";
      req.on("data", (c: Buffer) => (chunks += c));
      req.on("end", () => {
        seenBody = chunks;
        res.writeHead(200, { "content-type": "application/json" });
        res.end("{}");
      });
    });
    const result = await dispatchBillingWebhook({ url, secret: SECRET, event: billingEvent() });
    expect(result).toMatchObject({ ok: true, attempts: 1, lastStatus: 200 });
    expect(seenHeaders["x-rakshex-event"]).toBe("usage.threshold_exceeded");
    expect(seenHeaders["x-rakshex-signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(seenHeaders["x-rakshex-timestamp"]).toBeTruthy();
    const parsed = JSON.parse(seenBody);
    expect(parsed.workspaceId).toBe("ws-1");
    // signature covers exactly the delivered body
    const sigHex = (seenHeaders["x-rakshex-signature"] as string).replace("sha256=", "");
    expect(
      verifyBillingWebhookSignature({
        secret: SECRET,
        timestamp: seenHeaders["x-rakshex-timestamp"] as string,
        eventType: "usage.threshold_exceeded",
        body: seenBody,
        signatureHex: sigHex,
      }),
    ).toBe(true);
  });

  it("retries retryable statuses, then succeeds", async () => {
    let calls = 0;
    const url = await listen((_req, res) => {
      calls++;
      if (calls < 3) {
        res.writeHead(500);
        res.end("boom");
      } else {
        res.writeHead(200);
        res.end("{}");
      }
    });
    const result = await dispatchBillingWebhook({ url, secret: SECRET, event: billingEvent() });
    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(3);
    expect(calls).toBe(3);
  });

  it("stops on a terminal 4xx without retrying", async () => {
    let calls = 0;
    const url = await listen((_req, res) => {
      calls++;
      res.writeHead(400);
      res.end("bad");
    });
    const result = await dispatchBillingWebhook({ url, secret: SECRET, event: billingEvent() });
    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(1);
    expect(calls).toBe(1);
  });
});
