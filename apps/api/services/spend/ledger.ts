/**
 * Append-only spend ledger service (Team B, meter core).
 *
 * This module deliberately exposes ONLY append + read helpers. There is no
 * update and no delete export: spend history is evidence, and evidence is
 * never rewritten. Corrections are new rows. (The table is also referenced
 * by signed receipts via receipt_id for cross-evidence joins.)
 */
import { sql } from "drizzle-orm";
import type { SignalLabel } from "@rakshex/spend-meter";
import { type SpendDb, type SpendScope, type SpendScopeKind } from "./reservation";

export interface AppendSpendEntry {
  workspaceId: number;
  agentId: string;
  keyId?: string;
  userId?: string;
  sessionId?: string;
  action: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Realized USD cost, major units. */
  costUsd: number;
  signalLabel: SignalLabel;
  reservationId?: string;
  receiptId?: number;
  occurredAt?: Date;
}

/** The single write path. Nothing in this module mutates or removes rows. */
export async function appendSpendLedgerEntry(
  db: SpendDb,
  entry: AppendSpendEntry,
): Promise<{ id: number }> {
  if (!Number.isInteger(entry.workspaceId) || entry.workspaceId <= 0) {
    throw new Error("appendSpendLedgerEntry requires a positive workspaceId");
  }
  if (!entry.agentId || !entry.provider || !entry.model) {
    throw new Error("appendSpendLedgerEntry requires agentId, provider, and model");
  }
  if (!Number.isFinite(entry.costUsd) || entry.costUsd < 0) {
    throw new Error(`appendSpendLedgerEntry requires a finite non-negative costUsd, got ${entry.costUsd}`);
  }
  const result = await db.execute(sql`
    INSERT INTO spend_ledger
      (occurred_at, workspace_id, agent_id, key_id, user_id, session_id, action,
       provider, model, input_tokens, output_tokens, cost_usd, signal_label,
       reservation_id, receipt_id)
    VALUES
      (${entry.occurredAt ?? new Date()}, ${entry.workspaceId}, ${entry.agentId},
       ${entry.keyId ?? null}, ${entry.userId ?? null}, ${entry.sessionId ?? null},
       ${entry.action}, ${entry.provider}, ${entry.model},
       ${entry.inputTokens}, ${entry.outputTokens}, ${entry.costUsd.toFixed(10)},
       ${entry.signalLabel}, ${entry.reservationId ?? null}, ${entry.receiptId ?? null})
    RETURNING id
  `);
  const id = result.rows[0]?.["id"];
  if (typeof id !== "number") {
    throw new Error("spend_ledger append returned no id — refusing to continue fail-open");
  }
  return { id };
}

/** Realized (settled) spend for a scope. Pair with sumOutstandingUsd for the live total. */
export async function sumLedgerSpendUsd(db: SpendDb, scope: SpendScope): Promise<number> {
  // Identifier is chosen from a fixed whitelist — never interpolated from input.
  const column =
    scope.scopeKind === "agent"
      ? sql`agent_id`
      : scope.scopeKind === "key"
        ? sql`key_id`
        : sql`user_id`;
  const result = await db.execute(sql`
    SELECT COALESCE(SUM(cost_usd), 0) AS total
    FROM spend_ledger
    WHERE workspace_id = ${scope.workspaceId} AND ${column} = ${scope.scopeId}
  `);
  const total = result.rows[0]?.["total"];
  const n = typeof total === "string" ? Number(total) : Number(total ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export type { SpendScope, SpendScopeKind };
