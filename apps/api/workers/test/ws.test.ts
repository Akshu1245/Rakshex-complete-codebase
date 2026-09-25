import { describe, expect, it, vi } from "vitest";
import { acceptWs, isUpgradeRequest, sendDecisionEvent } from "../src/adapters/ws";

function upgradeRequest(): Request {
  return new Request("https://x/v1/stream/decisions?workspaceId=1", {
    headers: { Upgrade: "websocket", Connection: "Upgrade" },
  });
}

describe("ws adapter", () => {
  it("detects websocket upgrade requests", () => {
    expect(isUpgradeRequest(upgradeRequest())).toBe(true);
    expect(isUpgradeRequest(new Request("https://x/v1/health"))).toBe(false);
  });

  it("acceptWs throws on non-upgrade requests (fail-closed)", () => {
    expect(() => acceptWs(new Request("https://x/v1/health"))).toThrow(/Not a WebSocket upgrade/);
  });

  it("sendDecisionEvent serializes the event as JSON on an open socket", () => {
    const send = vi.fn();
    const socket = { readyState: 1, send } as unknown as WebSocket; // WebSocket.OPEN === 1
    sendDecisionEvent(socket, {
      type: "decision",
      workspaceId: 1,
      requestId: "r1",
      decision: "DENY",
      effectiveDecision: "DENY",
      receiptId: 5,
      entryHash: "ab".repeat(32),
      at: "2026-09-25T10:00:00.000Z",
    });
    expect(send).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(send.mock.calls[0]![0] as string);
    expect(parsed.decision).toBe("DENY");
    expect(parsed.receiptId).toBe(5);
  });

  it("sendDecisionEvent drops events on a closed socket instead of throwing", () => {
    const send = vi.fn();
    const socket = { readyState: 3, send } as unknown as WebSocket; // CLOSED
    expect(() =>
      sendDecisionEvent(socket, {
        type: "decision",
        workspaceId: 1,
        requestId: "r1",
        decision: "ALLOW",
        effectiveDecision: "ALLOW",
        receiptId: 1,
        entryHash: "ab".repeat(32),
        at: "2026-09-25T10:00:00.000Z",
      }),
    ).not.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});
