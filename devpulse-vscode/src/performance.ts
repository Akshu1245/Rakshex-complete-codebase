/**
 * Rakshex VS Code Extension Performance Optimizations
 *
 * Targets:
 *   - < 2s startup time
 *   - < 150MB memory
 *   - Instant sidebar response
 *   - Non-blocking scans
 */

import * as vscode from "vscode";

// ── Lazy Loading ──────────────────────────────────────────────────────────

/** Lazy import wrapper — loads modules only when needed. */
export async function lazyImport<T>(modulePath: string): Promise<T> {
  return import(modulePath) as Promise<T>;
}

// ── Debounce ──────────────────────────────────────────────────────────────

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  waitMs: number,
): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout | undefined;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

/** Debounced refresh — prevents rapid re-renders. */
export function createDebouncedRefresh(refreshFn: () => Promise<void>, waitMs = 500) {
  return debounce(() => {
    void refreshFn();
  }, waitMs);
}

// ── Memory Monitor ────────────────────────────────────────────────────────

interface MemorySnapshot {
  used: number; // MB
  limit: number; // MB
  timestamp: number;
}

let memorySnapshots: MemorySnapshot[] = [];
const MAX_SNAPSHOTS = 50;
const MEMORY_LIMIT_MB = 150;

export function recordMemoryUsage(): void {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  memorySnapshots.push({
    used,
    limit: MEMORY_LIMIT_MB,
    timestamp: Date.now(),
  });
  if (memorySnapshots.length > MAX_SNAPSHOTS) {
    memorySnapshots = memorySnapshots.slice(-MAX_SNAPSHOTS);
  }

  if (used > MEMORY_LIMIT_MB * 0.9) {
    vscode.window.showWarningMessage(
      `Rakshex memory usage is high (${used.toFixed(1)}MB). Consider reloading the window.`,
    );
  }
}

export function getMemoryTrend(): { increasing: boolean; avgMb: number } {
  if (memorySnapshots.length < 5) return { increasing: false, avgMb: 0 };
  const first = memorySnapshots[0].used;
  const last = memorySnapshots[memorySnapshots.length - 1].used;
  const avg = memorySnapshots.reduce((s, x) => s + x.used, 0) / memorySnapshots.length;
  return { increasing: last > first + 10, avgMb: avg };
}

// ── Request Collapsing ────────────────────────────────────────────────────

/** Collapses duplicate in-flight requests. */
export class RequestDeduper {
  private inflight = new Map<string, Promise<unknown>>();

  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const promise = fn().finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.inflight.clear();
  }
}

// ── Scan Throttling ──────────────────────────────────────────────────────

/** Ensures scans don't run more frequently than interval. */
export class ScanThrottler {
  private lastScan = 0;
  private minIntervalMs: number;

  constructor(minIntervalMs = 5000) {
    this.minIntervalMs = minIntervalMs;
  }

  canScan(): boolean {
    return Date.now() - this.lastScan >= this.minIntervalMs;
  }

  recordScan(): void {
    this.lastScan = Date.now();
  }
}

// ── Telemetry Batching ───────────────────────────────────────────────────

export class TelemetryBatcher {
  private buffer: Array<{ event: string; data: unknown }> = [];
  private flushTimer?: NodeJS.Timeout;
  private readonly flushIntervalMs: number;
  private readonly maxBuffer: number;

  constructor(flushIntervalMs = 30000, maxBuffer = 20) {
    this.flushIntervalMs = flushIntervalMs;
    this.maxBuffer = maxBuffer;
    this.startFlushTimer();
  }

  push(event: string, data: unknown): void {
    this.buffer.push({ event, data });
    if (this.buffer.length >= this.maxBuffer) {
      void this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.maxBuffer);
    // Send to telemetry endpoint
    try {
      // await sendTelemetry(batch);
    } catch {
      // Silently drop on error
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
  }

  dispose(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    void this.flush();
  }
}

// ── Virtualized List Helper (for large finding lists) ─────────────────────

export function getVisibleRange(
  scrollTop: number,
  viewportHeight: number,
  itemHeight: number,
  totalItems: number,
): { start: number; end: number } {
  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - 2);
  const visibleCount = Math.ceil(viewportHeight / itemHeight) + 4;
  const end = Math.min(totalItems, start + visibleCount);
  return { start, end };
}
