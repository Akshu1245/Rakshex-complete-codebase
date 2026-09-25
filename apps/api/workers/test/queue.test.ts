import { describe, expect, it, vi } from "vitest";
import { enqueueJob, enqueueReceiptExport } from "../src/adapters/queue";
import type { Env } from "../src/env";

function mockEnv(): Env {
  return {
    EVAL_QUEUE: { send: vi.fn().mockResolvedValue(undefined) },
  } as unknown as Env;
}

describe("queue adapter", () => {
  it("sends a well-shaped job to the queue", async () => {
    const env = mockEnv();
    await enqueueJob(env, "receipt-export", { workspaceId: 3 });
    const send = env.EVAL_QUEUE.send as ReturnType<typeof vi.fn>;
    expect(send).toHaveBeenCalledTimes(1);
    const job = send.mock.calls[0]![0] as { type: string; enqueuedAt: string; payload: unknown };
    expect(job.type).toBe("receipt-export");
    expect(job.payload).toEqual({ workspaceId: 3 });
    expect(typeof job.enqueuedAt).toBe("string");
    expect(Number.isNaN(Date.parse(job.enqueuedAt))).toBe(false);
  });

  it("enqueueReceiptExport helper forwards workspace + request id", async () => {
    const env = mockEnv();
    await enqueueReceiptExport(env, 9, "req-42");
    const send = env.EVAL_QUEUE.send as ReturnType<typeof vi.fn>;
    const job = send.mock.calls[0]![0] as { type: string; payload: unknown };
    expect(job.type).toBe("receipt-export");
    expect(job.payload).toEqual({ workspaceId: 9, requestId: "req-42" });
  });

  it("propagates queue send failures (caller decides retry policy)", async () => {
    const env = mockEnv();
    (env.EVAL_QUEUE.send as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("queue down"),
    );
    await expect(enqueueJob(env, "weekly-digest", {})).rejects.toThrow("queue down");
  });
});
