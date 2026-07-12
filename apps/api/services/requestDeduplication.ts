/**
 * Request Deduplication — Prevents duplicate in-flight requests.
 *
 * If two identical requests arrive within the debounce window,
 * the second request reuses the promise from the first.
 *
 * Usage:
 *   const dedup = new RequestDeduplicator({ ttlMs: 5000 });
 *   const result = await dedup.dedup("scan:123", () => runScan("123"));
 */

interface DeduplicatorOptions {
  ttlMs?: number; // How long to keep a promise reference (default: 5000)
}

export class RequestDeduplicator {
  private inFlight = new Map<string, Promise<unknown>>();
  private timers = new Map<string, NodeJS.Timeout>();
  private readonly ttlMs: number;

  constructor(options: DeduplicatorOptions = {}) {
    this.ttlMs = options.ttlMs ?? 5000;
  }

  async dedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = fn().finally(() => {
      // Keep reference briefly for near-simultaneous duplicate requests,
      // then clean up to prevent memory leaks.
      const timer = setTimeout(() => {
        this.inFlight.delete(key);
        this.timers.delete(key);
      }, this.ttlMs);
      this.timers.set(key, timer);
    });

    this.inFlight.set(key, promise);
    return promise;
  }

  clear(key?: string): void {
    if (key) {
      const timer = this.timers.get(key);
      if (timer) clearTimeout(timer);
      this.inFlight.delete(key);
      this.timers.delete(key);
    } else {
      for (const timer of this.timers.values()) {
        clearTimeout(timer);
      }
      this.inFlight.clear();
      this.timers.clear();
    }
  }

  getActiveKeys(): string[] {
    return Array.from(this.inFlight.keys());
  }
}
