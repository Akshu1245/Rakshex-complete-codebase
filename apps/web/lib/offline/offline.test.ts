import { describe, expect, it } from "vitest";
import { resolveLWW, isLocalNewer } from "./conflict";
import {
  SyncQueue,
  createMemoryQueueStorage,
  MAX_QUEUE_ATTEMPTS,
  type QueuedOp,
} from "./syncQueue";

describe("resolveLWW", () => {
  it("prefers the higher version", () => {
    const local = { version: 3, updatedAt: 1 };
    const remote = { version: 2, updatedAt: 999 };
    expect(resolveLWW(local, remote)).toBe(local);
  });

  it("falls back to updatedAt when versions are equal/absent", () => {
    const local = { updatedAt: "2026-01-02T00:00:00Z" };
    const remote = { updatedAt: "2026-01-01T00:00:00Z" };
    expect(resolveLWW(local, remote)).toBe(local);
    expect(resolveLWW(remote, local)).toBe(local);
  });

  it("resolves ties to the remote (server canonical)", () => {
    const local = { updatedAt: 100 };
    const remote = { updatedAt: 100 };
    expect(resolveLWW(local, remote)).toBe(remote);
  });

  it("isLocalNewer reflects version/time ordering", () => {
    expect(isLocalNewer({ version: 5 }, { version: 4 })).toBe(true);
    expect(isLocalNewer({ updatedAt: 1 }, { updatedAt: 2 })).toBe(false);
  });
});

describe("SyncQueue", () => {
  it("enqueues with change-tracking metadata and counts pending", async () => {
    const q = new SyncQueue(createMemoryQueueStorage());
    const op = await q.enqueue(
      "finding.update",
      { id: "f1", status: "resolved" },
      { deviceId: "dev-1" },
    );
    expect(op.deviceId).toBe("dev-1");
    expect(op.status).toBe("pending");
    expect(op.attempts).toBe(0);
    expect(await q.count()).toBe(1);
  });

  it("flushes pending ops in FIFO order and removes them on success", async () => {
    const q = new SyncQueue(createMemoryQueueStorage());
    await q.enqueue("a", { n: 1 }, { deviceId: "d" });
    await new Promise((r) => setTimeout(r, 2));
    await q.enqueue("b", { n: 2 }, { deviceId: "d" });

    const processed: string[] = [];
    const res = await q.flush(async (op: QueuedOp) => {
      processed.push(op.type);
    });
    expect(processed).toEqual(["a", "b"]);
    expect(res.synced).toBe(2);
    expect(await q.count()).toBe(0);
  });

  it("retries failing ops and marks them failed after MAX_QUEUE_ATTEMPTS", async () => {
    const q = new SyncQueue(createMemoryQueueStorage());
    await q.enqueue("boom", {}, { deviceId: "d" });
    const failing = async () => {
      throw new Error("network down");
    };
    for (let i = 0; i < MAX_QUEUE_ATTEMPTS; i++) {
      await q.flush(failing);
    }
    const all = await q.all();
    expect(all[0].status).toBe("failed");
    expect(all[0].attempts).toBe(MAX_QUEUE_ATTEMPTS);
    expect(all[0].lastError).toContain("network down");
    // Failed ops are excluded from the pending count.
    expect(await q.count()).toBe(0);
  });

  it("recovers a transiently-failing op on a later flush", async () => {
    const q = new SyncQueue(createMemoryQueueStorage());
    await q.enqueue("flaky", {}, { deviceId: "d" });
    let attempt = 0;
    const processor = async () => {
      attempt += 1;
      if (attempt < 2) throw new Error("temporary");
    };
    await q.flush(processor); // fails once
    expect(await q.count()).toBe(1);
    await q.flush(processor); // succeeds
    expect(await q.count()).toBe(0);
  });
});
