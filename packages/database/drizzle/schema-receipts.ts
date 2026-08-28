import {
  index,
  integer,
  json,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const actionReceiptLedger = pgTable(
  "action_receipt_ledger",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    requestId: varchar("request_id", { length: 128 }).notNull(),
    eventType: varchar("event_type", { length: 16 }).notNull(),
    occurredAt: timestamp("occurred_at").notNull(),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    previousHash: varchar("previous_hash", { length: 64 }).notNull(),
    entryHash: varchar("entry_hash", { length: 64 }).notNull(),
    signingKeyId: varchar("signing_key_id", { length: 128 }).notNull(),
    signingAlgorithm: varchar("signing_algorithm", { length: 32 }).default("ed25519").notNull(),
    signature: text("signature").notNull(),
    publicKeyPem: text("public_key_pem").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    entryHashUniq: uniqueIndex("action_receipt_ledger_entry_hash_uniq").on(table.entryHash),
    workspaceChainIdx: index("action_receipt_ledger_workspace_chain_idx").on(
      table.workspaceId,
      table.id,
    ),
    requestIdx: index("action_receipt_ledger_request_idx").on(
      table.workspaceId,
      table.requestId,
    ),
  }),
);

export type ActionReceiptLedgerEntry = typeof actionReceiptLedger.$inferSelect;
export type InsertActionReceiptLedgerEntry = typeof actionReceiptLedger.$inferInsert;
