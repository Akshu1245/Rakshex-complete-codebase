import {
  decimal,
  index,
  integer,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { actionReceiptLedger } from "./schema-receipts";

/**
 * Spend-meter tables (Team B, enforcement parity).
 *
 * - spend_reservations: in-flight worst-case cost holds. A reservation is a
 *   single-row INSERT; settle/abort are single conditional UPDATEs
 *   (WHERE status='reserved'), which is the atomic primitive — no SELECT
 *   then UPDATE, so concurrent settles cannot double-release.
 * - spend_ledger: append-only record of realized LLM spend. NEVER update or
 *   delete rows; corrections are new rows. The service layer only exposes
 *   `append` (see apps/api/services/spend/ledger.ts).
 *
 * Money is USD major units (decimal dollars), matching the gate's
 * SpendUsdByScope in @rakshex/action-control.
 */

export const spendReservations = pgTable(
  "spend_reservations",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    scopeKind: varchar("scope_kind", { length: 16 }).notNull(), // agent | key | user
    scopeId: varchar("scope_id", { length: 128 }).notNull(),
    estimatedUsd: decimal("estimated_usd", { precision: 20, scale: 10 }).notNull(),
    actualUsd: decimal("actual_usd", { precision: 20, scale: 10 }),
    status: varchar("status", { length: 16 }).default("reserved").notNull(), // reserved | settled | aborted
    createdAt: timestamp("created_at").defaultNow().notNull(),
    settledAt: timestamp("settled_at"),
  },
  (table) => ({
    scopeIdx: index("spend_reservations_scope_idx").on(
      table.workspaceId,
      table.scopeKind,
      table.scopeId,
    ),
    statusIdx: index("spend_reservations_status_idx").on(table.status),
  }),
);

export const spendLedger = pgTable(
  "spend_ledger",
  {
    id: serial("id").primaryKey(),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    workspaceId: integer("workspace_id").notNull(),
    agentId: varchar("agent_id", { length: 128 }).notNull(),
    keyId: varchar("key_id", { length: 128 }),
    userId: varchar("user_id", { length: 128 }),
    sessionId: varchar("session_id", { length: 128 }),
    action: varchar("action", { length: 256 }).notNull(),
    provider: varchar("provider", { length: 64 }).notNull(),
    model: varchar("model", { length: 128 }).notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    costUsd: decimal("cost_usd", { precision: 20, scale: 10 }).notNull(),
    signalLabel: varchar("signal_label", { length: 16 }).notNull(), // exact | observed | estimated | not_available
    reservationId: varchar("reservation_id", { length: 64 }),
    receiptId: integer("receipt_id").references(() => actionReceiptLedger.id),
  },
  (table) => ({
    workspaceIdx: index("spend_ledger_workspace_idx").on(table.workspaceId, table.occurredAt),
    agentIdx: index("spend_ledger_agent_idx").on(table.workspaceId, table.agentId),
  }),
);

export type SpendReservation = typeof spendReservations.$inferSelect;
export type InsertSpendReservation = typeof spendReservations.$inferInsert;
export type SpendLedgerEntry = typeof spendLedger.$inferSelect;
export type InsertSpendLedgerEntry = typeof spendLedger.$inferInsert;
