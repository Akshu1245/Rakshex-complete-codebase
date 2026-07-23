/**
 * Governance schema extensions (migrations 0014–0020).
 *
 * SCHEMA-ONLY for now: tables/columns are migrated and exported for Drizzle,
 * but dedicated API/service glue for subjects, identity links, entitlements,
 * and provider-health incidents is not wired yet. Existing product paths use
 * control-plane / enterprise / webhook routers against earlier tables.
 * Do not invent large new features here — extend incrementally when a
 * shipping surface needs these rows.
 */
import {
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  json,
  decimal,
  boolean,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { controlPlaneProviderEnum } from "./schema-enterprise";

// ─── Enums (extensions beyond team_ai_* in schema-enterprise) ─────────────
export const governanceSubjectKindEnum = pgEnum("governance_subject_kind", [
  "employee",
  "service_account",
  "workload",
  "unresolved",
]);

export const identityLinkTypeEnum = pgEnum("identity_link_type", [
  "workspace_user",
  "email",
  "github_login",
  "cloud_principal",
  "scim_id",
  "sdk_subject",
  "device",
  "external_user_id",
]);

export const providerHealthStatusEnum = pgEnum("provider_health_status", [
  "healthy",
  "degraded",
  "unhealthy",
  "unknown",
]);

// ─── Workspace entitlements (billing source of truth for seats) ──────────
export const workspaceEntitlements = pgTable(
  "workspace_entitlements",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    plan: varchar("plan", { length: 32 }).default("free").notNull(),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    includedSeats: integer("included_seats").default(1).notNull(),
    purchasedSeats: integer("purchased_seats").default(0).notNull(),
    overrideSeats: integer("override_seats"),
    billingProvider: varchar("billing_provider", { length: 32 }),
    billingCustomerId: varchar("billing_customer_id", { length: 255 }),
    billingSubscriptionId: varchar("billing_subscription_id", { length: 255 }),
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    graceExpiresAt: timestamp("grace_expires_at"),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    workspaceUniq: uniqueIndex("workspace_entitlements_workspace_id_uniq").on(table.workspaceId),
  }),
);
export type WorkspaceEntitlement = typeof workspaceEntitlements.$inferSelect;
export type InsertWorkspaceEntitlement = typeof workspaceEntitlements.$inferInsert;

/** Canonical cross-provider subject; links to team_ai_identities via identity links. */
export const governanceSubjects = pgTable(
  "governance_subjects",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    kind: governanceSubjectKindEnum("kind").default("employee").notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    primaryEmail: varchar("primary_email", { length: 320 }),
    workspaceUserId: integer("workspace_user_id"),
    teamAiIdentityId: integer("team_ai_identity_id"),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    workspaceIdx: index("governance_subjects_workspace_id_idx").on(table.workspaceId),
    emailIdx: index("governance_subjects_primary_email_idx").on(table.primaryEmail),
    userIdx: index("governance_subjects_workspace_user_id_idx").on(table.workspaceUserId),
  }),
);
export type GovernanceSubject = typeof governanceSubjects.$inferSelect;
export type InsertGovernanceSubject = typeof governanceSubjects.$inferInsert;

export const subjectIdentityLinks = pgTable(
  "subject_identity_links",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    subjectId: integer("subject_id").notNull(),
    linkType: identityLinkTypeEnum("link_type").notNull(),
    externalId: varchar("external_id", { length: 512 }).notNull(),
    verified: boolean("verified").default(false).notNull(),
    source: varchar("source", { length: 64 }).notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    linkUniq: uniqueIndex("subject_identity_links_uniq").on(
      table.workspaceId,
      table.linkType,
      table.externalId,
    ),
    subjectIdx: index("subject_identity_links_subject_id_idx").on(table.subjectId),
  }),
);
export type SubjectIdentityLink = typeof subjectIdentityLinks.$inferSelect;
export type InsertSubjectIdentityLink = typeof subjectIdentityLinks.$inferInsert;

export const identityResolutionEvents = pgTable(
  "identity_resolution_events",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    subjectId: integer("subject_id"),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    linkType: identityLinkTypeEnum("link_type"),
    externalId: varchar("external_id", { length: 512 }),
    confidence: varchar("confidence", { length: 32 }).default("inferred").notNull(),
    actorUserId: integer("actor_user_id"),
    details: json("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    workspaceIdx: index("identity_resolution_events_workspace_id_idx").on(table.workspaceId),
  }),
);
export type IdentityResolutionEvent = typeof identityResolutionEvents.$inferSelect;
export type InsertIdentityResolutionEvent = typeof identityResolutionEvents.$inferInsert;

/** Daily/hourly rollups for attribution dashboards. */
export const governanceUsageRollups = pgTable(
  "governance_usage_rollups",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    identityId: integer("identity_id"),
    provider: controlPlaneProviderEnum("provider"),
    model: varchar("model", { length: 128 }),
    projectId: varchar("project_id", { length: 128 }),
    periodStart: timestamp("period_start").notNull(),
    periodKind: varchar("period_kind", { length: 16 }).notNull(),
    eventCount: integer("event_count").default(0).notNull(),
    totalTokens: integer("total_tokens").default(0).notNull(),
    costUsd: decimal("cost_usd", { precision: 14, scale: 6 }).default("0").notNull(),
    exactCostUsd: decimal("exact_cost_usd", { precision: 14, scale: 6 }).default("0").notNull(),
    estimatedCostUsd: decimal("estimated_cost_usd", { precision: 14, scale: 6 })
      .default("0")
      .notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    rollupUniq: uniqueIndex("governance_usage_rollups_uniq").on(
      table.workspaceId,
      table.identityId,
      table.provider,
      table.model,
      table.projectId,
      table.periodStart,
      table.periodKind,
    ),
    workspacePeriodIdx: index("governance_usage_rollups_workspace_period_idx").on(
      table.workspaceId,
      table.periodStart,
    ),
  }),
);
export type GovernanceUsageRollup = typeof governanceUsageRollups.$inferSelect;
export type InsertGovernanceUsageRollup = typeof governanceUsageRollups.$inferInsert;

export const connectorCheckpoints = pgTable(
  "connector_checkpoints",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    providerAccountId: integer("provider_account_id").notNull(),
    provider: controlPlaneProviderEnum("provider").notNull(),
    cursor: text("cursor"),
    lastSyncedAt: timestamp("last_synced_at"),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    accountUniq: uniqueIndex("connector_checkpoints_account_uniq").on(table.providerAccountId),
  }),
);
export type ConnectorCheckpoint = typeof connectorCheckpoints.$inferSelect;
export type InsertConnectorCheckpoint = typeof connectorCheckpoints.$inferInsert;

export const connectorErrors = pgTable(
  "connector_errors",
  {
    id: serial("id").primaryKey(),
    syncRunId: integer("sync_run_id").notNull(),
    workspaceId: integer("workspace_id").notNull(),
    code: varchar("code", { length: 64 }).notNull(),
    message: text("message").notNull(),
    retryable: boolean("retryable").default(true).notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    syncRunIdx: index("connector_errors_sync_run_id_idx").on(table.syncRunId),
    workspaceIdx: index("connector_errors_workspace_id_idx").on(table.workspaceId),
  }),
);
export type ConnectorError = typeof connectorErrors.$inferSelect;
export type InsertConnectorError = typeof connectorErrors.$inferInsert;

export const providerHealthChecks = pgTable(
  "provider_health_checks",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    providerAccountId: integer("provider_account_id"),
    provider: controlPlaneProviderEnum("provider").notNull(),
    checkType: varchar("check_type", { length: 64 }).notNull(),
    status: providerHealthStatusEnum("status").default("unknown").notNull(),
    latencyMs: integer("latency_ms"),
    message: text("message"),
    checkedAt: timestamp("checked_at").defaultNow().notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
  },
  (table) => ({
    workspaceIdx: index("provider_health_checks_workspace_id_idx").on(table.workspaceId),
    checkedAtIdx: index("provider_health_checks_checked_at_idx").on(table.checkedAt),
  }),
);
export type ProviderHealthCheck = typeof providerHealthChecks.$inferSelect;
export type InsertProviderHealthCheck = typeof providerHealthChecks.$inferInsert;

export const providerHealthIncidents = pgTable(
  "provider_health_incidents",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    providerAccountId: integer("provider_account_id"),
    provider: controlPlaneProviderEnum("provider").notNull(),
    severity: varchar("severity", { length: 16 }).default("medium").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 32 }).default("open").notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
    metadata: json("metadata").$type<Record<string, unknown>>(),
  },
  (table) => ({
    workspaceIdx: index("provider_health_incidents_workspace_id_idx").on(table.workspaceId),
    statusIdx: index("provider_health_incidents_status_idx").on(table.status),
  }),
);
export type ProviderHealthIncident = typeof providerHealthIncidents.$inferSelect;
export type InsertProviderHealthIncident = typeof providerHealthIncidents.$inferInsert;

export const connectorHealthSnapshots = pgTable(
  "connector_health_snapshots",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    providerAccountId: integer("provider_account_id").notNull(),
    provider: controlPlaneProviderEnum("provider").notNull(),
    syncLagMinutes: integer("sync_lag_minutes"),
    authStatus: providerHealthStatusEnum("auth_status").default("unknown").notNull(),
    apiStatus: providerHealthStatusEnum("api_status").default("unknown").notNull(),
    lastSuccessfulSyncAt: timestamp("last_successful_sync_at"),
    snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
  },
  (table) => ({
    accountUniq: uniqueIndex("connector_health_snapshots_account_uniq").on(table.providerAccountId),
    workspaceIdx: index("connector_health_snapshots_workspace_id_idx").on(table.workspaceId),
  }),
);
export type ConnectorHealthSnapshot = typeof connectorHealthSnapshots.$inferSelect;
export type InsertConnectorHealthSnapshot = typeof connectorHealthSnapshots.$inferInsert;
