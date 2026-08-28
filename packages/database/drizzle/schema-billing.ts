import {
  decimal,
  index,
  integer,
  json,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { controlPlaneProviderEnum } from "./schema-enterprise";

/**
 * Binds a read-only provider billing/admin credential to a provider account.
 * This is deliberately separate from providerAccounts.adminCredentialId,
 * which the current inference gateway uses for the egress credential.
 */
export const providerBillingConnections = pgTable(
  "provider_billing_connections",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    providerAccountId: integer("provider_account_id").notNull(),
    provider: controlPlaneProviderEnum("provider").notNull(),
    billingCredentialId: integer("billing_credential_id").notNull(),
    source: varchar("source", { length: 32 }).default("admin_api").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    accountUniq: uniqueIndex("provider_billing_connections_account_uniq").on(
      table.workspaceId,
      table.providerAccountId,
      table.provider,
    ),
    workspaceIdx: index("provider_billing_connections_workspace_idx").on(table.workspaceId),
  }),
);

/**
 * Raw provider-owned billing/usage evidence. Gateway estimates are never
 * written here; they remain in team_ai_usage_events.
 */
export const providerBillingRows = pgTable(
  "provider_billing_rows",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    providerAccountId: integer("provider_account_id").notNull(),
    provider: controlPlaneProviderEnum("provider").notNull(),
    rowKind: varchar("row_kind", { length: 16 }).notNull(), // cost | usage
    sourceRowId: varchar("source_row_id", { length: 128 }).notNull(),
    bucketStart: timestamp("bucket_start").notNull(),
    bucketEnd: timestamp("bucket_end").notNull(),
    projectId: varchar("project_id", { length: 255 }),
    apiKeyId: varchar("api_key_id", { length: 255 }),
    lineItem: varchar("line_item", { length: 255 }),
    model: varchar("model", { length: 255 }),
    amountUsd: decimal("amount_usd", { precision: 20, scale: 10 }),
    currency: varchar("currency", { length: 16 }),
    quantity: decimal("quantity", { precision: 20, scale: 6 }),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cachedInputTokens: integer("cached_input_tokens"),
    requestCount: integer("request_count"),
    raw: json("raw").$type<Record<string, unknown>>().notNull(),
    fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  },
  (table) => ({
    sourceUniq: uniqueIndex("provider_billing_rows_source_uniq").on(
      table.workspaceId,
      table.providerAccountId,
      table.rowKind,
      table.sourceRowId,
    ),
    windowIdx: index("provider_billing_rows_window_idx").on(
      table.workspaceId,
      table.providerAccountId,
      table.bucketStart,
    ),
    projectIdx: index("provider_billing_rows_project_idx").on(table.projectId),
  }),
);

/** Immutable reconciliation snapshots for known billing windows. */
export const providerReconciliationWindows = pgTable(
  "provider_reconciliation_windows",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    providerAccountId: integer("provider_account_id").notNull(),
    provider: controlPlaneProviderEnum("provider").notNull(),
    windowStart: timestamp("window_start").notNull(),
    windowEnd: timestamp("window_end").notNull(),
    providerBilledUsd: decimal("provider_billed_usd", { precision: 20, scale: 10 }).notNull(),
    gatewayAttributedUsd: decimal("gateway_attributed_usd", { precision: 20, scale: 10 }).notNull(),
    driftUsd: decimal("drift_usd", { precision: 20, scale: 10 }).notNull(),
    driftPct: decimal("drift_pct", { precision: 20, scale: 10 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(), // ok | drift
    providerRowCount: integer("provider_row_count").default(0).notNull(),
    gatewayRowCount: integer("gateway_row_count").default(0).notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    reconciledAt: timestamp("reconciled_at").defaultNow().notNull(),
  },
  (table) => ({
    windowUniq: uniqueIndex("provider_reconciliation_windows_uniq").on(
      table.workspaceId,
      table.providerAccountId,
      table.windowStart,
      table.windowEnd,
    ),
    workspaceIdx: index("provider_reconciliation_windows_workspace_idx").on(
      table.workspaceId,
      table.reconciledAt,
    ),
  }),
);

export type ProviderBillingConnection = typeof providerBillingConnections.$inferSelect;
export type InsertProviderBillingConnection = typeof providerBillingConnections.$inferInsert;
export type ProviderBillingRow = typeof providerBillingRows.$inferSelect;
export type InsertProviderBillingRow = typeof providerBillingRows.$inferInsert;
export type ProviderReconciliationWindow = typeof providerReconciliationWindows.$inferSelect;
export type InsertProviderReconciliationWindow = typeof providerReconciliationWindows.$inferInsert;
