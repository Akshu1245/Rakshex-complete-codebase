import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { UsageEvent } from "./types.js";

/**
 * Durable offline queue for telemetry when the gateway is unreachable.
 * Memory-backed by default; optional JSONL file path for Node processes.
 */
export class OfflineQueue {
  private memory: UsageEvent[] = [];
  private readonly max: number;
  private readonly path?: string;

  constructor(opts: { max?: number; path?: string } = {}) {
    this.max = opts.max ?? 1000;
    this.path = opts.path;
    if (this.path) {
      try {
        mkdirSync(dirname(this.path), { recursive: true });
        if (existsSync(this.path)) {
          const lines = readFileSync(this.path, "utf8").split("\n").filter(Boolean);
          for (const line of lines) {
            try {
              this.memory.push(JSON.parse(line) as UsageEvent);
            } catch {
              /* skip corrupt */
            }
          }
          if (this.memory.length > this.max) {
            this.memory = this.memory.slice(-this.max);
          }
        }
      } catch {
        /* fail open — memory only */
      }
    }
  }

  get size(): number {
    return this.memory.length;
  }

  enqueue(event: UsageEvent): void {
    this.memory.push(event);
    while (this.memory.length > this.max) {
      this.memory.shift();
    }
    if (this.path) {
      try {
        appendFileSync(this.path, JSON.stringify(event) + "\n", "utf8");
      } catch {
        /* fail open */
      }
    }
  }

  /** Drain up to `n` events (does not delete until markFlushed). */
  peek(n: number): UsageEvent[] {
    return this.memory.slice(0, n);
  }

  markFlushed(count: number): void {
    this.memory = this.memory.slice(count);
    this.persist();
  }

  private persist(): void {
    if (!this.path) return;
    try {
      writeFileSync(
        this.path,
        this.memory.map((e) => JSON.stringify(e)).join("\n") + (this.memory.length ? "\n" : ""),
        "utf8",
      );
    } catch {
      /* fail open */
    }
  }
}
