/**
 * @rakshex/worker entry.
 *
 * BullMQ workers currently live under apps/api/queues/workers (historical layout).
 * This package is the monorepo surface for the worker process.
 *
 * Production Docker still runs: node dist/.../queues/workers/index.js
 * TODO(foundation): move worker sources fully into apps/worker once import graph is stable.
 */

export const WORKER_PACKAGE = "@rakshex/worker" as const;

/**
 * Compile-safe bootstrap marker. Runtime process entry remains apps/api worker index
 * until a dedicated worker bundle is wired without inventing queue behavior.
 */
export function getWorkerEntryHint(): string {
  return "apps/api/queues/workers/index.ts";
}
