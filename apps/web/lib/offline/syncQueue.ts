/**
 * Offline write/mutation queue.
 *
 * When the app is offline (or a mutation fails on a flaky network), the
 * operation is recorded here with change-tracking metadata (client id,
 * timestamp, device id, attempt count). When connectivity returns, the queue
 * is flushed in FIFO order via a caller-supplied processor. Failed ops are
 * retried with a bounded attempt count before being marked "failed" for the
 * user to review.
 *
 * Storage is injected (`QueueStorage`) so the pure queue logic is unit-testable
 * without IndexedDB, and so the browser can back it with IndexedDB in prod.
 */

export type QueuedOpStatus = "pending" | "syncing" | "failed";

export interface QueuedOp<TPayload = unknown> {
  /** Client-generated unique id (also used for idempotency on the server). */
  id: string;
  /** Logical operation name, e.g. "finding.updateStatus". */
  type: string;
  payload: TPayload;
  /** Epoch millis when the op was created on the client. */
  createdAt: number;
  /** Originating device id (change-tracking / conflict metadata). */
  deviceId: string;
  attempts: number;
  status: QueuedOpStatus;
  lastError?: string;
}

export interface QueueStorage {
  getAll(): Promise<QueuedOp[]>;
  put(op: QueuedOp): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Processor returns nothing on success and throws on failure. */
export type OpProcessor = (op: QueuedOp) => Promise<void>;

export const MAX_QUEUE_ATTEMPTS = 5;

/** In-memory storage adapter (used in tests and as an SSR-safe fallback). */
export function createMemoryQueueStorage(seed: QueuedOp[] = []): QueueStorage {
  const map = new Map<string, QueuedOp>(seed.map((o) => [o.id, o]));
  return {
    async getAll() {
      return Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt);
    },
    async put(op) {
      map.set(op.id, op);
    },
    async remove(id) {
      map.delete(id);
    },
  };
}

export class SyncQueue {
  private flushing = false;

  constructor(private storage: QueueStorage) {}

  async enqueue<T>(
    type: string,
    payload: T,
    meta: { deviceId: string; id?: string },
  ): Promise<QueuedOp<T>> {
    const op: QueuedOp<T> = {
      id: meta.id ?? cryptoRandomId(),
      type,
      payload,
      createdAt: Date.now(),
      deviceId: meta.deviceId,
      attempts: 0,
      status: "pending",
    };
    await this.storage.put(op);
    return op;
  }

  async pending(): Promise<QueuedOp[]> {
    const all = await this.storage.getAll();
    return all.filter((o) => o.status !== "failed");
  }

  async all(): Promise<QueuedOp[]> {
    return this.storage.getAll();
  }

  async count(): Promise<number> {
    return (await this.pending()).length;
  }

  /**
   * Flush pending ops in FIFO order. Returns a summary. Ops that throw are
   * retried up to MAX_QUEUE_ATTEMPTS, then marked "failed". Guards against
   * concurrent flushes.
   */
  async flush(
    processor: OpProcessor,
  ): Promise<{ synced: number; failed: number; remaining: number }> {
    if (this.flushing) return { synced: 0, failed: 0, remaining: (await this.pending()).length };
    this.flushing = true;
    let synced = 0;
    let failed = 0;
    try {
      const ops = (await this.storage.getAll())
        .filter((o) => o.status !== "failed")
        .sort((a, b) => a.createdAt - b.createdAt);

      for (const op of ops) {
        try {
          await this.storage.put({ ...op, status: "syncing" });
          await processor(op);
          await this.storage.remove(op.id);
          synced += 1;
        } catch (err) {
          const attempts = op.attempts + 1;
          const status: QueuedOpStatus = attempts >= MAX_QUEUE_ATTEMPTS ? "failed" : "pending";
          if (status === "failed") failed += 1;
          await this.storage.put({
            ...op,
            attempts,
            status,
            lastError: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } finally {
      this.flushing = false;
    }
    const remaining = (await this.pending()).length;
    return { synced, failed, remaining };
  }
}

function cryptoRandomId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
