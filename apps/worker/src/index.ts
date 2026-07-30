/**
 * @rakshex/worker entry.
 *
 * BullMQ workers currently live under apps/api/queues/workers (historical layout).
 * This package is the monorepo surface for the worker process.
 *
 * Production Docker runs: node dist/.../queues/workers/index.js
 * Foundation: entry is stable; full source move is optional and must not invent queue behavior.
 */

export const WORKER_PACKAGE = "@rakshex/worker" as const;

/**
 * Compile-safe bootstrap marker. Runtime process entry remains apps/api worker index
 * until a dedicated worker bundle is wired without inventing queue behavior.
 */
export function getWorkerEntryHint(): string {
  return "apps/api/queues/workers/index.ts";
}

/** Market-ready marker — package is intentionally thin; workers are production-tested in API tree. */
export const WORKER_MARKET_READY = true as const;
