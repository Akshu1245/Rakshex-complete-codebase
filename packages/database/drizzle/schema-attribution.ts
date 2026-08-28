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

/** One complete attribution row for every successfully settled gateway call. */
export const gatewayCallAttribution = pgTable(
  "gateway_call_attribution",
  {
    id: serial("id").primaryKey(),
    requestId: varchar("request_id", { length: 128 }).notNull(),
    workspaceId: integer("workspace_id").notNull(),
    projectId: varchar("project_id", { length: 128 }),
    agentId: varchar("agent_id", { length: 128 }),
    identityId: integer("identity_id"),
    providerAccountId: integer("provider_account_id").notNull(),
    provider: controlPlaneProviderEnum("provider").notNull(),
    model: varchar("model", { length: 255 }).notNull(),
    inputTokens: integer("input_tokens").default(0).notNull(),
    outputTokens: integer("output_tokens").default(0).notNull(),
    cachedInputTokens: integer("cached_input_tokens").default(0).notNull(),
    estimatedCostUsd: decimal("estimated_cost_usd", { precision: 20, scale: 10 }).notNull(),
    settledCostUsd: decimal("settled_cost_usd", { precision: 20, scale: 10 }).notNull(),
    providerReconciledCostUsd: decimal("provider_reconciled_cost_usd", {
      precision: 20,
      scale: 10,
    }),
    priceVersionId: integer("price_version_id"),
    priceSourceUrl: varchar("price_source_url", { length: 2048 }),
    featureTags: json("feature_tags").$type<Record<string, string>>(),
    customerTags: json("customer_tags").$type<Record<string, string>>(),
    occurredAt: timestamp("occurred_at").notNull(),
    settledAt: timestamp("settled_at").defaultNow().notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
  },
  (table) => ({
    requestUniq: uniqueIndex("gateway_call_attribution_request_uniq").on(
      table.workspaceId,
      table.requestId,
    ),
    windowIdx: index("gateway_call_attribution_window_idx").on(
      table.workspaceId,
      table.providerAccountId,
      table.occurredAt,
    ),
    projectIdx: index("gateway_call_attribution_project_idx").on(table.projectId),
    agentIdx: index("gateway_call_attribution_agent_idx").on(table.agentId),
  }),
);

export type GatewayCallAttribution = typeof gatewayCallAttribution.$inferSelect;
export type InsertGatewayCallAttribution = typeof gatewayCallAttribution.$inferInsert;
