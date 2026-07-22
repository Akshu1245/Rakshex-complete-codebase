/**
 * Conflict resolution for offline-first sync.
 *
 * We use Last-Write-Wins (LWW) keyed on a monotonic `updatedAt` (or `version`)
 * field, which is the simplest correct strategy for the DevPulse data model
 * (records are owned by a workspace and rarely edited concurrently). More
 * advanced merge/CRDT strategies can be layered on later per-entity.
 */

export interface Versioned {
  /** ISO timestamp or epoch millis of the last write. */
  updatedAt?: string | number | Date | null;
  /** Optional monotonic version counter (takes precedence over updatedAt). */
  version?: number | null;
}

function toMillis(value: Versioned["updatedAt"]): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Resolve a conflict between a local (offline-edited) record and the remote
 * (server) record. Returns whichever is "newer": higher version wins, else
 * later updatedAt wins. Ties resolve to the remote copy (server is canonical).
 */
export function resolveLWW<T extends Versioned>(local: T, remote: T): T {
  const lv = local.version ?? null;
  const rv = remote.version ?? null;
  if (lv != null && rv != null && lv !== rv) {
    return lv > rv ? local : remote;
  }
  const lt = toMillis(local.updatedAt);
  const rt = toMillis(remote.updatedAt);
  if (lt === rt) return remote; // tie → server canonical
  return lt > rt ? local : remote;
}

/** True if the local copy is strictly newer than the remote copy. */
export function isLocalNewer(local: Versioned, remote: Versioned): boolean {
  const lv = local.version ?? null;
  const rv = remote.version ?? null;
  if (lv != null && rv != null && lv !== rv) return lv > rv;
  return toMillis(local.updatedAt) > toMillis(remote.updatedAt);
}
