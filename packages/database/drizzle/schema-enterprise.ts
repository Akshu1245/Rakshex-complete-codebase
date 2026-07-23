import { sql } from "drizzle-orm";
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
import { workspaces } from "./schema";

// ─── Enums ───────────────────────────────────────────────────────────────
export const azureResourceTypeEnum = pgEnum("azure_resource_type", [
  "keyVault",
  "servicePrincipal",
  "apiManagement",
  "managedIdentity",
  "storageAccount",
]);
export const discoveryStatusEnum = pgEnum("discovery_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);
export const keyRotationStatusEnum = pgEnum("key_rotation_status", [
  "pending",
  "approved",
  "in_progress",
  "completed",
  "failed",
  "rejected",
]);
export const overprivilegedCategoryEnum = pgEnum("overprivileged_category", [
  "wildcard_permissions",
  "unused_permissions",
  "too_broad_scope",
  "excessive_roles",
]);
export const agentguardActionEnum = pgEnum("agentguard_action", [
  "revoke",
  "rotate",
  "alert_only",
  "disable",
]);
export const agentguardTriggerEnum = pgEnum("agentguard_trigger", [
  "leak_detected",
  "overprivileged",
  "expired_key",
  "shadow_key",
  "budget_exceeded",
  "manual",
]);
export const controlPlaneProviderEnum = pgEnum("control_plane_provider", [
  "openai",
  "anthropic",
  "azure_openai",
  "bedrock",
  "vertex",
  "github_copilot",
  "claude_teams",
  "cursor",
  "windsurf",
  "ollama",
  "vllm",
  "lm_studio",
  "openai_compatible",
]);
export const controlPlaneCredentialStatusEnum = pgEnum("control_plane_credential_status", [
  "active",
  "revoked",
  "expired",
]);
export const controlPlaneFindingStatusEnum = pgEnum("control_plane_finding_status", [
  "open",
  "acknowledged",
  "remediated",
]);
export const controlPlaneSyncStatusEnum = pgEnum("control_plane_sync_status", [
  "healthy",
  "degraded",
  "failed",
  "not_connected",
]);
export const controlPlaneEvidenceConfidenceEnum = pgEnum("control_plane_evidence_confidence", [
  "verified",
  "imported",
  "estimated",
  "inferred",
]);

// ─── Azure Connection (encrypted SPN credentials per workspace) ──────────
export const azureConnections = pgTable(
  "azure_connections",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    tenantId: varchar("tenant_id", { length: 64 }).notNull(),
    subscriptionId: varchar("subscription_id", { length: 64 }).notNull(),
    displayName: varchar("display_name", { length: 255 }),
    // Encrypted service principal credentials (AES-256-GCM)
    encryptedClientId: text("encrypted_client_id").notNull(),
    encryptedClientSecret: text("encrypted_client_secret").notNull(),
    authType: varchar("auth_type", { length: 32 }).default("client_secret").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    lastSyncAt: timestamp("last_sync_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    workspaceIdx: index().on(table.workspaceId),
  }),
);

export type AzureConnection = typeof azureConnections.$inferSelect;
export type InsertAzureConnection = typeof azureConnections.$inferInsert;

// ─── Discovered Azure Resources ──────────────────────────────────────────
export const azureDiscoveredKeys = pgTable(
  "azure_discovered_keys",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    connectionId: integer("connection_id"),
    resourceType: azureResourceTypeEnum("resource_type").notNull(),
    resourceName: varchar("resource_name", { length: 255 }).notNull(),
    resourceId: text("resource_id"), // Azure resource ID
    keyName: varchar("key_name", { length: 255 }).notNull(),
    keyType: varchar("key_type", { length: 64 }), // secret, key, certificate, pat
    keyHash: varchar("key_hash", { length: 128 }), // SHA-256 of key material
    scopes: json("scopes").$type<string[]>(),
    isExpired: boolean("is_expired").default(false).notNull(),
    expiresAt: timestamp("expires_at"),
    lastRotatedAt: timestamp("last_rotated_at"),
    assignedTo: varchar("assigned_to", { length: 255 }), // owner, app, SP name
    status: varchar("status", { length: 32 }).default("active").notNull(),
    discoveryRunId: varchar("discovery_run_id", { length: 64 }),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    discoveredAt: timestamp("discovered_at").defaultNow().notNull(),
  },
  (table) => ({
    workspaceIdx: index().on(table.workspaceId),
    resourceTypeIdx: index().on(table.resourceType),
    keyHashIdx: index().on(table.keyHash),
  }),
);

export type AzureDiscoveredKey = typeof azureDiscoveredKeys.$inferSelect;
export type InsertAzureDiscoveredKey = typeof azureDiscoveredKeys.$inferInsert;

// ─── Discovery Runs ──────────────────────────────────────────────────────
export const discoveryRuns = pgTable(
  "discovery_runs",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    connectionId: integer("connection_id"),
    status: discoveryStatusEnum("status").notNull(),
    resourcesFound: integer("resources_found").default(0).notNull(),
    keysFound: integer("keys_found").default(0).notNull(),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    workspaceIdx: index().on(table.workspaceId),
  }),
);

export type DiscoveryRun = typeof discoveryRuns.$inferSelect;
export type InsertDiscoveryRun = typeof discoveryRuns.$inferInsert;

// ─── Key Risk Assessments ────────────────────────────────────────────────
export const keyRiskAssessments = pgTable(
  "key_risk_assessments",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    discoveredKeyId: integer("discovered_key_id"),
    category: overprivilegedCategoryEnum("category").notNull(),
    severity: varchar("severity", { length: 16 }).notNull(), // low, medium, high, critical
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    evidence: json("evidence").$type<Record<string, unknown>>(),
    suggestedAction: text("suggested_action"),
    status: varchar("status", { length: 32 }).default("open").notNull(),
    acknowledgedAt: timestamp("acknowledged_at"),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    workspaceIdx: index().on(table.workspaceId),
    keyIdx: index().on(table.discoveredKeyId),
  }),
);

// ─── Shadow Keys (keys in code NOT in vault) ────────────────────────────
export const shadowKeys = pgTable(
  "shadow_keys",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    keyHash: varchar("key_hash", { length: 128 }).notNull(),
    keyPrefix: varchar("key_prefix", { length: 32 }), // first few chars for identification
    provider: varchar("provider", { length: 64 }).notNull(), // azure, github, openai, etc.
    discoveredIn: varchar("discovered_in", { length: 255 }), // file path, repo, collection
    discoveredBy: varchar("discovered_by", { length: 64 }), // scanner type
    riskLevel: varchar("risk_level", { length: 16 }).notNull(),
    isInVault: boolean("is_in_vault").default(false).notNull(),
    suggestedVault: varchar("suggested_vault", { length: 255 }),
    status: varchar("status", { length: 32 }).default("open").notNull(),
    assigneeUserId: integer("assignee_user_id"),
    resolutionNote: text("resolution_note"),
    remediatedAt: timestamp("remediated_at"),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    workspaceIdx: index().on(table.workspaceId),
    keyHashIdx: index().on(table.keyHash),
    workspaceKeyUniq: uniqueIndex("shadow_keys_workspace_key_uniq").on(
      table.workspaceId,
      table.keyHash,
    ),
    workspaceStatusIdx: index("shadow_keys_workspace_status_idx").on(
      table.workspaceId,
      table.status,
      table.lastSeenAt,
    ),
  }),
);

// ─── AgentGuard Policies ─────────────────────────────────────────────────
export const agentGuardPolicies = pgTable(
  "agent_guard_policies",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    triggers: json("triggers").$type<{ event: string; severity: string }[]>().notNull(),
    action: agentguardActionEnum("action").notNull(),
    conditions: json("conditions").$type<Record<string, unknown>>(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    createdBy: integer("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    workspaceIdx: index().on(table.workspaceId),
  }),
);

// ─── AgentGuard Events ───────────────────────────────────────────────────
export const agentGuardEvents = pgTable(
  "agent_guard_events",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    policyId: integer("policy_id"),
    trigger: agentguardTriggerEnum("trigger").notNull(),
    action: agentguardActionEnum("action").notNull(),
    targetKeyId: integer("target_key_id"),
    targetKeyName: varchar("target_key_name", { length: 255 }),
    severity: varchar("severity", { length: 16 }).notNull(),
    reason: text("reason").notNull(),
    result: varchar("result", { length: 32 }), // success, failed, pending
    executedAt: timestamp("executed_at").defaultNow().notNull(),
  },
  (table) => ({
    workspaceIdx: index().on(table.workspaceId),
    policyIdx: index().on(table.policyId),
  }),
);

// ─── Key Rotation Requests ───────────────────────────────────────────────
export const keyRotationRequests = pgTable(
  "key_rotation_requests",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    discoveredKeyId: integer("discovered_key_id").notNull(),
    keyName: varchar("key_name", { length: 255 }).notNull(),
    keyType: varchar("key_type", { length: 64 }).notNull(),
    provider: varchar("provider", { length: 64 }).notNull(),
    reason: text("reason").notNull(),
    status: keyRotationStatusEnum("status").default("pending").notNull(),
    requestedBy: integer("requested_by").notNull(),
    approvedBy: integer("approved_by"),
    approvedAt: timestamp("approved_at"),
    rotationStartedAt: timestamp("rotation_started_at"),
    rotationCompletedAt: timestamp("rotation_completed_at"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    workspaceIdx: index().on(table.workspaceId),
    keyIdx: index().on(table.discoveredKeyId),
    statusIdx: index().on(table.status),
  }),
);

// ─── ISO27001 Control Assessments ────────────────────────────────────────
export const iso27001Controls = pgTable(
  "iso27001_controls",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    controlId: varchar("control_id", { length: 16 }).notNull(), // A.9.1, A.10.1, etc.
    controlName: varchar("control_name", { length: 255 }).notNull(),
    status: varchar("status", { length: 32 }).default("not_assessed").notNull(), // compliant, partial, non_compliant, not_assessed
    score: decimal("score", { precision: 3, scale: 1 }), // 0.0 - 5.0
    evidence:
      json("evidence").$type<
        { type: string; description: string; source: string; timestamp: string }[]
      >(),
    findings: text("findings"),
    remediation: text("remediation"),
    lastAssessedAt: timestamp("last_assessed_at"),
    assessedBy: integer("assessed_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    workspaceIdx: index().on(table.workspaceId),
    controlIdIdx: uniqueIndex().on(table.workspaceId, table.controlId),
  }),
);

// ─── Per-Key Usage Metrics (daily aggregation) ───────────────────────────
export const keyUsageMetrics = pgTable(
  "key_usage_metrics",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    discoveredKeyId: integer("discovered_key_id"),
    keyName: varchar("key_name", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 64 }).notNull(),
    date: timestamp("date").notNull(),
    requestCount: integer("request_count").default(0).notNull(),
    costUsd: decimal("cost_usd", { precision: 12, scale: 6 }).default("0").notNull(),
    tokensUsed: integer("tokens_used").default(0),
    source: varchar("source", { length: 64 }), // copilot, azure_openai, api_management, direct
    metadata: json("metadata").$type<Record<string, unknown>>(),
  },
  (table) => ({
    workspaceIdx: index().on(table.workspaceId),
    keyDateIdx: index().on(table.discoveredKeyId, table.date),
    dateIdx: index().on(table.date),
  }),
);

// ─── GitHub Copilot Sync State ───────────────────────────────────────────
export const copilotSyncState = pgTable(
  "copilot_sync_state",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    orgName: varchar("org_name", { length: 255 }).notNull(),
    totalSeats: integer("total_seats").default(0).notNull(),
    activeSeats: integer("active_seats").default(0).notNull(),
    totalUsageUsd: decimal("total_usage_usd", { precision: 12, scale: 2 }).default("0").notNull(),
    data: json("data").$type<Record<string, unknown>>(),
    syncedAt: timestamp("synced_at").defaultNow().notNull(),
  },
  (table) => ({
    workspaceIdx: index().on(table.workspaceId),
  }),
);

// ─── Team/Org Hierarchy Sync ─────────────────────────────────────────────
export const orgSyncState = pgTable(
  "org_sync_state",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    provider: varchar("provider", { length: 32 }).notNull(), // azure_ad, github
    providerOrgId: varchar("provider_org_id", { length: 128 }).notNull(),
    providerOrgName: varchar("provider_org_name", { length: 255 }),
    lastSyncedAt: timestamp("last_synced_at"),
    syncStatus: varchar("sync_status", { length: 32 }).default("pending").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    workspaceIdx: index().on(table.workspaceId),
  }),
);

/** Workspace-scoped provider accounts and OAuth/admin connections. */
export const providerAccounts = pgTable(
  "provider_accounts",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    provider: controlPlaneProviderEnum("provider").notNull(),
    accountType: varchar("account_type", { length: 64 }).notNull(),
    externalId: varchar("external_id", { length: 255 }),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    connectionStatus: varchar("connection_status", { length: 32 })
      .default("inventory_only")
      .notNull(),
    authMethod: varchar("auth_method", { length: 32 }).default("manual_import").notNull(),
    adminCredentialId: integer("admin_credential_id"),
    syncStatus: controlPlaneSyncStatusEnum("sync_status").default("not_connected").notNull(),
    lastSyncError: text("last_sync_error"),
    capabilities: json("capabilities").$type<Record<string, boolean>>().notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    workspaceIdx: index().on(table.workspaceId),
    providerIdx: index().on(table.provider),
  }),
);
export type ProviderAccount = typeof providerAccounts.$inferSelect;
export type InsertProviderAccount = typeof providerAccounts.$inferInsert;

/** Encrypted credentials. The encrypted value is never returned by list APIs. */
export const controlPlaneCredentials = pgTable(
  "control_plane_credentials",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    providerAccountId: integer("provider_account_id"),
    name: varchar("name", { length: 128 }).notNull(),
    provider: controlPlaneProviderEnum("provider").notNull(),
    credentialType: varchar("credential_type", { length: 64 }).notNull(),
    environment: varchar("environment", { length: 32 }).default("production").notNull(),
    encryptedValue: text("encrypted_value").notNull(),
    fingerprint: varchar("fingerprint", { length: 128 }).notNull(),
    keyPrefix: varchar("key_prefix", { length: 32 }),
    status: controlPlaneCredentialStatusEnum("status").default("active").notNull(),
    expiresAt: timestamp("expires_at"),
    lastUsedAt: timestamp("last_used_at"),
    createdBy: integer("created_by").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => ({
    workspaceIdx: index().on(table.workspaceId),
    fingerprintIdx: index().on(table.fingerprint),
    providerIdx: index().on(table.provider),
  }),
);
export type ControlPlaneCredential = typeof controlPlaneCredentials.$inferSelect;
export type InsertControlPlaneCredential = typeof controlPlaneCredentials.$inferInsert;

/** Imported or synchronized team subscriptions, distinct from API credentials. */
export const aiSubscriptions = pgTable(
  "ai_subscriptions",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    provider: controlPlaneProviderEnum("provider").notNull(),
    externalId: varchar("external_id", { length: 255 }),
    plan: varchar("plan", { length: 128 }).notNull(),
    seatsPurchased: integer("seats_purchased").default(0).notNull(),
    seatsUsed: integer("seats_used").default(0).notNull(),
    ownerEmail: varchar("owner_email", { length: 320 }),
    costCenter: varchar("cost_center", { length: 128 }),
    renewalAt: timestamp("renewal_at"),
    source: varchar("source", { length: 32 }).default("manual").notNull(),
    confidence: varchar("confidence", { length: 32 }).default("imported").notNull(),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    workspaceIdx: index().on(table.workspaceId),
    providerIdx: index().on(table.provider),
  }),
);
export type AiSubscription = typeof aiSubscriptions.$inferSelect;
export type InsertAiSubscription = typeof aiSubscriptions.$inferInsert;

/** A subscription seat is a license assignment, not an API key. */
export const aiSubscriptionSeats = pgTable(
  "ai_subscription_seats",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    subscriptionId: integer("subscription_id").notNull(),
    externalUserId: varchar("external_user_id", { length: 255 }),
    email: varchar("email", { length: 320 }),
    displayName: varchar("display_name", { length: 255 }),
    role: varchar("role", { length: 64 }),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    assignedAt: timestamp("assigned_at"),
    lastActivityAt: timestamp("last_activity_at"),
    source: varchar("source", { length: 32 }).default("manual").notNull(),
    confidence: controlPlaneEvidenceConfidenceEnum("confidence").default("imported").notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    workspaceIdx: index().on(table.workspaceId),
    subscriptionIdx: index().on(table.subscriptionId),
    emailIdx: index().on(table.email),
  }),
);
export type AiSubscriptionSeat = typeof aiSubscriptionSeats.$inferSelect;
export type InsertAiSubscriptionSeat = typeof aiSubscriptionSeats.$inferInsert;

/** Cloud/provider hierarchy inventory: tenant, account, project, subscription, or resource. */
export const controlPlaneResources = pgTable(
  "control_plane_resources",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    providerAccountId: integer("provider_account_id"),
    provider: controlPlaneProviderEnum("provider").notNull(),
    resourceType: varchar("resource_type", { length: 64 }).notNull(),
    externalId: varchar("external_id", { length: 512 }).notNull(),
    parentExternalId: varchar("parent_external_id", { length: 512 }),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    region: varchar("region", { length: 64 }),
    ownerEmail: varchar("owner_email", { length: 320 }),
    costCenter: varchar("cost_center", { length: 128 }),
    tags: json("tags").$type<Record<string, string>>(),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    source: varchar("source", { length: 32 }).default("manual").notNull(),
    confidence: controlPlaneEvidenceConfidenceEnum("confidence").default("imported").notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    lastSyncedAt: timestamp("last_synced_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    workspaceIdx: index().on(table.workspaceId),
    providerIdx: index().on(table.provider),
    externalIdx: index().on(table.externalId),
  }),
);
export type ControlPlaneResource = typeof controlPlaneResources.$inferSelect;
export type InsertControlPlaneResource = typeof controlPlaneResources.$inferInsert;

/** Metadata-only discovery findings from local scanners and CI integrations. */
export const controlPlaneDiscoveryFindings = pgTable(
  "control_plane_discovery_findings",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    kind: varchar("kind", { length: 64 }).notNull(),
    provider: controlPlaneProviderEnum("provider"),
    fingerprint: varchar("fingerprint", { length: 128 }).notNull(),
    maskedValue: varchar("masked_value", { length: 128 }),
    source: varchar("source", { length: 64 }).notNull(),
    sourcePath: varchar("source_path", { length: 512 }),
    model: varchar("model", { length: 128 }),
    severity: varchar("severity", { length: 16 }).default("medium").notNull(),
    status: controlPlaneFindingStatusEnum("status").default("open").notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => ({
    workspaceIdx: index().on(table.workspaceId),
    fingerprintIdx: index().on(table.fingerprint),
    statusIdx: index().on(table.status),
  }),
);
export type ControlPlaneDiscoveryFinding = typeof controlPlaneDiscoveryFindings.$inferSelect;
export type InsertControlPlaneDiscoveryFinding = typeof controlPlaneDiscoveryFindings.$inferInsert;

// ─── Team AI Governance ──────────────────────────────────────────────────

export const teamAiIdentityStatusEnum = pgEnum("team_ai_identity_status", [
  "active",
  "inactive",
  "suspended",
  "unknown",
]);

export const teamAiUsageSourceEnum = pgEnum("team_ai_usage_source", [
  "gateway",
  "admin_api",
  "analytics_api",
  "cloud_billing",
  "otel",
  "csv",
  "manual",
]);

export const teamAiBudgetPeriodEnum = pgEnum("team_ai_budget_period", ["monthly"]);

export const teamAiEnforcementModeEnum = pgEnum("team_ai_enforcement_mode", [
  "gateway",
  "provider_native",
  "monitor_only",
]);

export const runtimeKillScopeTypeEnum = pgEnum("runtime_kill_scope_type", [
  "workspace",
  "identity",
  "project",
  "agent",
]);

export const providerSyncRunStatusEnum = pgEnum("provider_sync_run_status", [
  "pending",
  "running",
  "success",
  "partial",
  "failed",
  "not_configured",
  "not_implemented",
]);

/** Normalized per-employee AI identity linked to a provider seat/user. */
export const teamAiIdentities = pgTable(
  "team_ai_identities",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    workspaceUserId: integer("workspace_user_id"),
    provider: controlPlaneProviderEnum("provider").notNull(),
    externalUserId: varchar("external_user_id", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }),
    displayName: varchar("display_name", { length: 255 }),
    subscriptionSeatId: integer("subscription_seat_id"),
    status: teamAiIdentityStatusEnum("status").default("active").notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    workspaceProviderExternalUniq: uniqueIndex("team_ai_identities_ws_provider_ext_uniq").on(
      table.workspaceId,
      table.provider,
      table.externalUserId,
    ),
    workspaceIdx: index("team_ai_identities_workspace_idx").on(table.workspaceId),
    emailIdx: index("team_ai_identities_email_idx").on(table.email),
    workspaceUserIdx: index("team_ai_identities_workspace_user_idx").on(table.workspaceUserId),
  }),
);
export type TeamAiIdentity = typeof teamAiIdentities.$inferSelect;
export type InsertTeamAiIdentity = typeof teamAiIdentities.$inferInsert;

/** Idempotent usage/cost events attributed to identities (no raw prompts). */
export const teamAiUsageEvents = pgTable(
  "team_ai_usage_events",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    identityId: integer("identity_id"),
    providerAccountId: integer("provider_account_id"),
    provider: controlPlaneProviderEnum("provider").notNull(),
    source: teamAiUsageSourceEnum("source").notNull(),
    externalEventId: varchar("external_event_id", { length: 255 }).notNull(),
    occurredAt: timestamp("occurred_at").notNull(),
    requestCount: integer("request_count").default(1).notNull(),
    inputTokens: integer("input_tokens").default(0).notNull(),
    outputTokens: integer("output_tokens").default(0).notNull(),
    costUsd: decimal("cost_usd", { precision: 18, scale: 8 }).default("0").notNull(),
    model: varchar("model", { length: 128 }),
    product: varchar("product", { length: 128 }),
    confidence: controlPlaneEvidenceConfidenceEnum("confidence").default("imported").notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    workspaceExternalUniq: uniqueIndex("team_ai_usage_events_ws_ext_uniq").on(
      table.workspaceId,
      table.externalEventId,
    ),
    workspaceOccurredIdx: index("team_ai_usage_events_ws_occurred_idx").on(
      table.workspaceId,
      table.occurredAt,
    ),
    identityIdx: index("team_ai_usage_events_identity_idx").on(table.identityId),
    providerIdx: index("team_ai_usage_events_provider_idx").on(table.provider),
  }),
);
export type TeamAiUsageEvent = typeof teamAiUsageEvents.$inferSelect;
export type InsertTeamAiUsageEvent = typeof teamAiUsageEvents.$inferInsert;

/** Workspace or per-identity AI spend budgets with honest enforcement modes. */
export const teamAiBudgets = pgTable(
  "team_ai_budgets",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    /** null = workspace default budget */
    identityId: integer("identity_id"),
    period: teamAiBudgetPeriodEnum("period").default("monthly").notNull(),
    limitUsd: decimal("limit_usd", { precision: 18, scale: 4 }).notNull(),
    warningPct: integer("warning_pct").default(80).notNull(),
    hardLimit: boolean("hard_limit").default(false).notNull(),
    enforcementMode: teamAiEnforcementModeEnum("enforcement_mode")
      .default("monitor_only")
      .notNull(),
    currentSpendUsd: decimal("current_spend_usd", { precision: 18, scale: 8 })
      .default("0")
      .notNull(),
    periodStart: timestamp("period_start"),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    workspaceDefaultPeriodUniq: uniqueIndex("team_ai_budgets_ws_default_period_uniq")
      .on(table.workspaceId, table.period)
      .where(sql`${table.identityId} IS NULL`),
    workspaceIdentityPeriodUniq: uniqueIndex("team_ai_budgets_ws_identity_period_uniq")
      .on(table.workspaceId, table.identityId, table.period)
      .where(sql`${table.identityId} IS NOT NULL`),
    workspaceIdx: index("team_ai_budgets_workspace_idx").on(table.workspaceId),
  }),
);
export type TeamAiBudget = typeof teamAiBudgets.$inferSelect;
export type InsertTeamAiBudget = typeof teamAiBudgets.$inferInsert;

/** Durable runtime kill switches scoped to workspace / identity / project / agent. */
export const runtimeKillSwitches = pgTable(
  "runtime_kill_switches",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    scopeType: runtimeKillScopeTypeEnum("scope_type").notNull(),
    scopeId: varchar("scope_id", { length: 128 }).notNull(),
    active: boolean("active").default(false).notNull(),
    reason: text("reason"),
    setBy: integer("set_by"),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    workspaceScopeUniq: uniqueIndex("runtime_kill_switches_ws_scope_uniq").on(
      table.workspaceId,
      table.scopeType,
      table.scopeId,
    ),
    workspaceIdx: index("runtime_kill_switches_workspace_idx").on(table.workspaceId),
    activeIdx: index("runtime_kill_switches_active_idx").on(table.workspaceId, table.active),
  }),
);
export type RuntimeKillSwitch = typeof runtimeKillSwitches.$inferSelect;
export type InsertRuntimeKillSwitch = typeof runtimeKillSwitches.$inferInsert;

/** Provider connector sync run history for health / staleness UI. */
export const providerSyncRuns = pgTable(
  "provider_sync_runs",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    provider: controlPlaneProviderEnum("provider").notNull(),
    providerAccountId: integer("provider_account_id"),
    status: providerSyncRunStatusEnum("status").default("pending").notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
    latencyMs: integer("latency_ms"),
    seatsSynced: integer("seats_synced").default(0),
    usageEventsSynced: integer("usage_events_synced").default(0),
    errorCode: varchar("error_code", { length: 64 }),
    errorMessage: text("error_message"),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    workspaceProviderIdx: index("provider_sync_runs_ws_provider_idx").on(
      table.workspaceId,
      table.provider,
    ),
    startedIdx: index("provider_sync_runs_started_idx").on(table.workspaceId, table.startedAt),
  }),
);
export type ProviderSyncRun = typeof providerSyncRuns.$inferSelect;
export type InsertProviderSyncRun = typeof providerSyncRuns.$inferInsert;
