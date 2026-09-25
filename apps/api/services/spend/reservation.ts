/**
 * Atomic cost reservations for real-time spend ceilings (Team B, meter core).
 *
 * The hard truth, stated plainly: in-flight overshoot is universal. Between
 * the gate's worst-case estimate and the stream's actual tokens, the provider
 * can always emit more than predicted — retries, tool loops, and long
 * completions all push past the estimate. Reservations do NOT eliminate
 * overshoot; they bound it to one outstanding worst-case estimate per scope
 * instead of unbounded concurrent spend.
 *
 * Atomicity: `reserve` is a single INSERT; `settle`/`abort` are single
 * conditional UPDATEs (`WHERE status = 'reserved'`). There is no
 * SELECT-then-UPDATE anywhere here, so a settle and an abort racing on the
 * same reservation cannot both succeed — exactly one wins, the other gets
 * zero rows and fails closed.
 */
import crypto from "node:crypto";
import { sql, type SQL } from "drizzle-orm";

/** Minimal DB surface this service needs — pass the real db or a test fake. */
export interface SpendDb {
  execute: (query: SQL<unknown>) => Promise<{
    rows: Record<string, unknown>[];
    rowCount: number | null;
  }>;
}

export type SpendScopeKind = "agent" | "key" | "user";

export interface ReserveInput {
  workspaceId: number;
  scopeKind: SpendScopeKind;
  scopeId: string;
  /** Worst-case USD bound (input*inRate + maxTokens*outRate), major units. */
  estimatedUsd: number;
  reservationId?: string;
}

export interface SettleInput {
  reservationId: string;
  /** Provider-reported actual USD, major units. */
  actualUsd: number;
}

export interface SpendScope {
  workspaceId: number;
  scopeKind: SpendScopeKind;
  scopeId: string;
}

function reservationId(): string {
  return `res_${crypto.randomUUID().replaceAll("-", "")}`;
}

function assertUsd(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite non-negative USD amount, got ${value}`);
  }
}

function assertScope(scope: SpendScope): void {
  if (!scope.scopeId || !Number.isInteger(scope.workspaceId) || scope.workspaceId <= 0) {
    throw new Error("spend scope requires a positive workspaceId and a non-empty scopeId");
  }
}

/** Hold a worst-case cost against a scope before the model call starts. */
export async function reserve(
  db: SpendDb,
  input: ReserveInput,
): Promise<{ reservationId: string }> {
  assertScope(input);
  assertUsd("estimatedUsd", input.estimatedUsd);
  const id = input.reservationId ?? reservationId();
  await db.execute(sql`
    INSERT INTO spend_reservations (id, workspace_id, scope_kind, scope_id, estimated_usd, status)
    VALUES (${id}, ${input.workspaceId}, ${input.scopeKind}, ${input.scopeId}, ${input.estimatedUsd.toFixed(10)}, 'reserved')
  `);
  return { reservationId: id };
}

/**
 * Release a reservation with the actual cost. The conditional UPDATE moves
 * reserved -> settled exactly once; double-settle or unknown id fails closed.
 */
export async function settle(db: SpendDb, input: SettleInput): Promise<void> {
  assertUsd("actualUsd", input.actualUsd);
  const result = await db.execute(sql`
    UPDATE spend_reservations
    SET status = 'settled', actual_usd = ${input.actualUsd.toFixed(10)}, settled_at = now()
    WHERE id = ${input.reservationId} AND status = 'reserved'
  `);
  if ((result.rowCount ?? 0) !== 1) {
    throw new Error(
      `settle failed: reservation ${input.reservationId} is not in reserved state (unknown id or double settle) — refusing to adjust spend twice`,
    );
  }
}

/** Cancel a reservation mid-stream (user abort, stream error, timeout). */
export async function abort(
  db: SpendDb,
  input: { reservationId: string },
): Promise<void> {
  const result = await db.execute(sql`
    UPDATE spend_reservations
    SET status = 'aborted', settled_at = now()
    WHERE id = ${input.reservationId} AND status = 'reserved'
  `);
  if ((result.rowCount ?? 0) !== 1) {
    throw new Error(
      `abort failed: reservation ${input.reservationId} is not in reserved state (unknown id or already settled)`,
    );
  }
}

/**
 * Outstanding (not yet settled) spend for a scope: the sum of worst-case
 * estimates the gate is currently exposed to. This is what the ceiling check
 * adds to realized ledger spend — it bounds the blind window between the
 * gate decision and the stream's actuals landing in the ledger.
 */
export async function sumOutstandingUsd(db: SpendDb, scope: SpendScope): Promise<number> {
  assertScope(scope);
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(COALESCE(actual_usd, estimated_usd)), 0) AS total
    FROM spend_reservations
    WHERE workspace_id = ${scope.workspaceId}
      AND scope_kind = ${scope.scopeKind}
      AND scope_id = ${scope.scopeId}
      AND status = 'reserved'
  `);
  return numericTotal(result.rows[0]?.["total"]);
}

function numericTotal(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}
