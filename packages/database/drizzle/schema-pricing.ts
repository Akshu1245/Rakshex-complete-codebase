import {
  decimal,
  index,
  json,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { controlPlaneProviderEnum } from "./schema-enterprise";

/**
 * Append-only-by-convention model prices. Runtime lookup selects the newest
 * version whose effectiveFrom is <= the request timestamp. Anthropic is
 * supported by the schema but no Anthropic rows/calls are implemented yet.
 */
export const modelPriceVersions = pgTable(
  "model_price_versions",
  {
    id: serial("id").primaryKey(),
    provider: controlPlaneProviderEnum("provider").notNull(),
    model: varchar("model", { length: 255 }).notNull(),
    currency: varchar("currency", { length: 16 }).default("usd").notNull(),
    inputPerMillion: decimal("input_per_million", { precision: 20, scale: 10 }).notNull(),
    outputPerMillion: decimal("output_per_million", { precision: 20, scale: 10 }).notNull(),
    cachedInputPerMillion: decimal("cached_input_per_million", { precision: 20, scale: 10 }),
    effectiveFrom: timestamp("effective_from").notNull(),
    sourceUrl: varchar("source_url", { length: 2048 }).notNull(),
    sourceCheckedAt: timestamp("source_checked_at").defaultNow().notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    versionUniq: uniqueIndex("model_price_versions_version_uniq").on(
      table.provider,
      table.model,
      table.effectiveFrom,
    ),
    lookupIdx: index("model_price_versions_lookup_idx").on(
      table.provider,
      table.model,
      table.effectiveFrom,
    ),
  }),
);

export type ModelPriceVersion = typeof modelPriceVersions.$inferSelect;
export type InsertModelPriceVersion = typeof modelPriceVersions.$inferInsert;
