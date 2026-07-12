/**
 * Market-ready database foundation tables.
 *
 * Additive to legacy schema.ts tables. Prefer these for new code.
 * Existing product tables remain for backward compatibility until migrated.
 *
 * Conventions:
 * - UUID-style varchar(64) primary keys for new entities
 * - workspaceId integer FK → workspaces.id for tenant isolation
 * - createdAt / updatedAt timestamps
 * - Soft delete via deletedAt where required
 */

import {
  boolean,
  decimal,
  index,
  integer,
  json,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
// ─── Enums (foundation) ───────────────────────────────────────────────────

export const identityProviderEnum = pgEnum("identity_provider", [
  "email",
  "google",
  "github",
  "oidc",
  "saml",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);

export const apiKeyEnvironmentEnum = pgEnum("api_key_environment", ["live", "test"]);

export const scanJobStatusEnum = pgEnum("scan_job_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const findingLifecycleStatusEnum = pgEnum("finding_lifecycle_status", [
  "open",
  "in_progress",
  "resolved",
  "false_positive",
  "accepted_risk",
  "suppressed",
]);

export const policyLifecycleStatusEnum = pgEnum("policy_lifecycle_status", [
  "draft",
  "published",
  "archived",
]);

export const agentRunStatusEnum = pgEnum("agent_run_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
  "blocked",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "open",
  "paid",
  "void",
  "uncollectible",
]);

export const complianceControlStatusEnum = pgEnum("compliance_control_status", [
  "not_started",
  "in_progress",
  "implemented",
  "not_applicable",
  "exception",
]);

// ─── Auth / identity ──────────────────────────────────────────────────────

/** OAuth / email identity links for a user (multi-provider). */
export const identities = pgTable(
  "identities",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("user_id").notNull(),
    provider: identityProviderEnum("provider").notNull(),
    providerSubject: varchar("provider_subject", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }),
    emailVerifiedAt: timestamp("email_verified_at"),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    providerSubjectUniq: uniqueIndex("identities_provider_subject_uidx").on(
      t.provider,
      t.providerSubject,
    ),
    userIdIdx: index("identities_user_id_idx").on(t.userId),
  }),
);

/**
 * Canonical sessions table (foundation).
 * Coexists with legacy user_sessions during migration.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("user_id").notNull(),
    sessionTokenHash: varchar("session_token_hash", { length: 128 }).notNull(),
    refreshTokenHash: varchar("refresh_token_hash", { length: 128 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    tokenUniq: uniqueIndex("sessions_token_hash_uidx").on(t.sessionTokenHash),
    userIdIdx: index("sessions_user_id_idx").on(t.userId),
    expiresIdx: index("sessions_expires_at_idx").on(t.expiresAt),
  }),
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("user_id").notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    purpose: varchar("purpose", { length: 64 }).notNull(), // email_verify | mfa_enroll
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    tokenUniq: uniqueIndex("verification_tokens_hash_uidx").on(t.tokenHash),
    userIdIdx: index("verification_tokens_user_id_idx").on(t.userId),
  }),
);

// ─── RBAC ─────────────────────────────────────────────────────────────────

export const roles = pgTable(
  "roles",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id"),
    /** null workspaceId = system role template */
    key: varchar("key", { length: 64 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    description: text("description"),
    isSystem: boolean("is_system").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    workspaceKeyUniq: uniqueIndex("roles_workspace_key_uidx").on(t.workspaceId, t.key),
    workspaceIdx: index("roles_workspace_id_idx").on(t.workspaceId),
  }),
);

export const permissions = pgTable(
  "permissions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    key: varchar("key", { length: 128 }).notNull().unique(),
    resource: varchar("resource", { length: 64 }).notNull(),
    action: varchar("action", { length: 32 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    resourceActionIdx: index("permissions_resource_action_idx").on(t.resource, t.action),
  }),
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: serial("id").primaryKey(),
    roleId: varchar("role_id", { length: 64 }).notNull(),
    permissionId: varchar("permission_id", { length: 64 }).notNull(),
  },
  (t) => ({
    rolePermUniq: uniqueIndex("role_permissions_uidx").on(t.roleId, t.permissionId),
  }),
);

// ─── API keys ─────────────────────────────────────────────────────────────

export const apiKeys = pgTable(
  "api_keys",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    createdByUserId: integer("created_by_user_id").notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    /** Public prefix e.g. rk_live_abc — secret only stored hashed. */
    keyPrefix: varchar("key_prefix", { length: 24 }).notNull(),
    keyHash: varchar("key_hash", { length: 128 }).notNull(),
    environment: apiKeyEnvironmentEnum("environment").default("live").notNull(),
    scopes: json("scopes").$type<string[]>().notNull().default([]),
    expiresAt: timestamp("expires_at"),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    prefixUniq: uniqueIndex("api_keys_prefix_uidx").on(t.keyPrefix),
    hashUniq: uniqueIndex("api_keys_hash_uidx").on(t.keyHash),
    workspaceIdx: index("api_keys_workspace_id_idx").on(t.workspaceId),
  }),
);

// ─── Projects / repositories ──────────────────────────────────────────────

export const projects = pgTable(
  "projects",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    name: varchar("name", { length: 192 }).notNull(),
    slug: varchar("slug", { length: 64 }).notNull(),
    description: text("description"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    workspaceSlugUniq: uniqueIndex("projects_workspace_slug_uidx").on(t.workspaceId, t.slug),
    workspaceIdx: index("projects_workspace_id_idx").on(t.workspaceId),
  }),
);

export const repositories = pgTable(
  "repositories",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    projectId: varchar("project_id", { length: 64 }),
    provider: varchar("provider", { length: 32 }).notNull().default("github"),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    defaultBranch: varchar("default_branch", { length: 128 }),
    externalId: varchar("external_id", { length: 128 }),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    workspaceRepoUniq: uniqueIndex("repositories_workspace_fullname_uidx").on(
      t.workspaceId,
      t.provider,
      t.fullName,
    ),
    workspaceIdx: index("repositories_workspace_id_idx").on(t.workspaceId),
    projectIdx: index("repositories_project_id_idx").on(t.projectId),
  }),
);

// ─── Collections / versions ───────────────────────────────────────────────

export const collectionVersions = pgTable(
  "collection_versions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    /** Logical collection id (legacy collections.id or future uuid). */
    collectionId: varchar("collection_id", { length: 64 }).notNull(),
    version: integer("version").notNull(),
    format: varchar("format", { length: 32 }).notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    data: json("data").notNull(),
    createdByUserId: integer("created_by_user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    collectionVersionUniq: uniqueIndex("collection_versions_uidx").on(t.collectionId, t.version),
    workspaceIdx: index("collection_versions_workspace_id_idx").on(t.workspaceId),
    hashIdx: index("collection_versions_hash_idx").on(t.contentHash),
  }),
);

// ─── Scans / jobs ─────────────────────────────────────────────────────────

export const scanJobs = pgTable(
  "scan_jobs",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    scanId: varchar("scan_id", { length: 64 }),
    collectionId: varchar("collection_id", { length: 64 }),
    jobType: varchar("job_type", { length: 64 }).notNull(),
    status: scanJobStatusEnum("status").default("queued").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    workspaceIdx: index("scan_jobs_workspace_id_idx").on(t.workspaceId),
    statusIdx: index("scan_jobs_status_idx").on(t.status),
    idempotencyUniq: uniqueIndex("scan_jobs_idempotency_uidx").on(t.workspaceId, t.idempotencyKey),
  }),
);

// ─── Findings lifecycle ───────────────────────────────────────────────────

export const findingInstances = pgTable(
  "finding_instances",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    findingId: varchar("finding_id", { length: 64 }).notNull(),
    scanId: varchar("scan_id", { length: 64 }).notNull(),
    fingerprint: varchar("fingerprint", { length: 255 }).notNull(),
    endpoint: text("endpoint"),
    method: varchar("method", { length: 16 }),
    evidence: json("evidence").$type<Record<string, unknown>>(),
    firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    occurrenceCount: integer("occurrence_count").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    workspaceFingerprintIdx: index("finding_instances_ws_fp_idx").on(t.workspaceId, t.fingerprint),
    findingIdx: index("finding_instances_finding_id_idx").on(t.findingId),
    scanIdx: index("finding_instances_scan_id_idx").on(t.scanId),
  }),
);

export const findingComments = pgTable(
  "finding_comments",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    findingId: varchar("finding_id", { length: 64 }).notNull(),
    authorUserId: integer("author_user_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    workspaceIdx: index("finding_comments_workspace_id_idx").on(t.workspaceId),
    findingIdx: index("finding_comments_finding_id_idx").on(t.findingId),
  }),
);

export const findingSuppressions = pgTable(
  "finding_suppressions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    findingId: varchar("finding_id", { length: 64 }),
    fingerprint: varchar("fingerprint", { length: 255 }).notNull(),
    reason: text("reason").notNull(),
    createdByUserId: integer("created_by_user_id").notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (t) => ({
    workspaceFingerprintUniq: uniqueIndex("finding_suppressions_ws_fp_uidx").on(
      t.workspaceId,
      t.fingerprint,
    ),
    workspaceIdx: index("finding_suppressions_workspace_id_idx").on(t.workspaceId),
  }),
);

export const acceptedRisks = pgTable(
  "accepted_risks",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    findingId: varchar("finding_id", { length: 64 }),
    fingerprint: varchar("fingerprint", { length: 255 }).notNull(),
    justification: text("justification").notNull(),
    acceptedByUserId: integer("accepted_by_user_id").notNull(),
    approvedByUserId: integer("approved_by_user_id"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (t) => ({
    workspaceFingerprintUniq: uniqueIndex("accepted_risks_ws_fp_uidx").on(
      t.workspaceId,
      t.fingerprint,
    ),
    workspaceIdx: index("accepted_risks_workspace_id_idx").on(t.workspaceId),
  }),
);

// ─── Policies ─────────────────────────────────────────────────────────────

export const policies = pgTable(
  "policies",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    name: varchar("name", { length: 192 }).notNull(),
    description: text("description"),
    status: policyLifecycleStatusEnum("status").default("draft").notNull(),
    currentVersion: integer("current_version").default(0).notNull(),
    createdByUserId: integer("created_by_user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    workspaceNameUniq: uniqueIndex("policies_workspace_name_uidx").on(t.workspaceId, t.name),
    workspaceIdx: index("policies_workspace_id_idx").on(t.workspaceId),
  }),
);

export const policyVersions = pgTable(
  "policy_versions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    policyId: varchar("policy_id", { length: 64 }).notNull(),
    version: integer("version").notNull(),
    document: json("document").notNull(),
    documentYaml: text("document_yaml"),
    publishedAt: timestamp("published_at"),
    createdByUserId: integer("created_by_user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    policyVersionUniq: uniqueIndex("policy_versions_uidx").on(t.policyId, t.version),
    workspaceIdx: index("policy_versions_workspace_id_idx").on(t.workspaceId),
  }),
);

export const policyViolations = pgTable(
  "policy_violations",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    policyId: varchar("policy_id", { length: 64 }),
    policyVersionId: varchar("policy_version_id", { length: 64 }),
    agentRunId: varchar("agent_run_id", { length: 64 }),
    ruleKey: varchar("rule_key", { length: 128 }).notNull(),
    action: varchar("action", { length: 32 }).notNull(),
    details: json("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    workspaceIdx: index("policy_violations_workspace_id_idx").on(t.workspaceId),
    policyIdx: index("policy_violations_policy_id_idx").on(t.policyId),
    createdAtIdx: index("policy_violations_created_at_idx").on(t.createdAt),
  }),
);

// ─── Integrations / notifications ─────────────────────────────────────────

export const integrations = pgTable(
  "integrations",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    kind: varchar("kind", { length: 64 }).notNull(), // github | slack | teams | pagerduty | webhook
    name: varchar("name", { length: 192 }).notNull(),
    config: json("config").$type<Record<string, unknown>>().notNull().default({}),
    /** Encrypted secrets — never store plaintext. */
    secretsRef: varchar("secrets_ref", { length: 255 }),
    enabled: boolean("enabled").default(true).notNull(),
    createdByUserId: integer("created_by_user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    workspaceKindNameUniq: uniqueIndex("integrations_ws_kind_name_uidx").on(
      t.workspaceId,
      t.kind,
      t.name,
    ),
    workspaceIdx: index("integrations_workspace_id_idx").on(t.workspaceId),
  }),
);

export const notificationChannels = pgTable(
  "notification_channels",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    kind: varchar("kind", { length: 32 }).notNull(), // email | slack | teams | webhook | in_app
    name: varchar("name", { length: 128 }).notNull(),
    config: json("config").$type<Record<string, unknown>>().notNull().default({}),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    workspaceNameUniq: uniqueIndex("notification_channels_ws_name_uidx").on(t.workspaceId, t.name),
    workspaceIdx: index("notification_channels_workspace_id_idx").on(t.workspaceId),
  }),
);

// ─── Agent runtime telemetry ──────────────────────────────────────────────

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    projectId: varchar("project_id", { length: 64 }),
    agentKey: varchar("agent_key", { length: 128 }).notNull(),
    status: agentRunStatusEnum("status").default("pending").notNull(),
    correlationId: varchar("correlation_id", { length: 64 }),
    totalCostUsd: decimal("total_cost_usd", { precision: 12, scale: 6 }).default("0").notNull(),
    stepCount: integer("step_count").default(0).notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    workspaceIdx: index("agent_runs_workspace_id_idx").on(t.workspaceId),
    statusIdx: index("agent_runs_status_idx").on(t.status),
    correlationIdx: index("agent_runs_correlation_id_idx").on(t.correlationId),
  }),
);

export const agentSteps = pgTable(
  "agent_steps",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    agentRunId: varchar("agent_run_id", { length: 64 }).notNull(),
    stepIndex: integer("step_index").notNull(),
    name: varchar("name", { length: 192 }),
    status: agentRunStatusEnum("status").default("pending").notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    runStepUniq: uniqueIndex("agent_steps_run_index_uidx").on(t.agentRunId, t.stepIndex),
    workspaceIdx: index("agent_steps_workspace_id_idx").on(t.workspaceId),
  }),
);

export const llmRequests = pgTable(
  "llm_requests",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    agentRunId: varchar("agent_run_id", { length: 64 }),
    agentStepId: varchar("agent_step_id", { length: 64 }),
    provider: varchar("provider", { length: 64 }).notNull(),
    model: varchar("model", { length: 128 }).notNull(),
    inputTokens: integer("input_tokens").default(0).notNull(),
    outputTokens: integer("output_tokens").default(0).notNull(),
    cachedTokens: integer("cached_tokens").default(0).notNull(),
    latencyMs: integer("latency_ms"),
    costUsd: decimal("cost_usd", { precision: 12, scale: 6 }).default("0").notNull(),
    pricingVersionId: varchar("pricing_version_id", { length: 64 }),
    status: varchar("status", { length: 32 }).default("ok").notNull(),
    promptHash: varchar("prompt_hash", { length: 64 }),
    responseHash: varchar("response_hash", { length: 64 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    workspaceIdx: index("llm_requests_workspace_id_idx").on(t.workspaceId),
    runIdx: index("llm_requests_agent_run_id_idx").on(t.agentRunId),
    createdAtIdx: index("llm_requests_created_at_idx").on(t.createdAt),
  }),
);

export const toolCalls = pgTable(
  "tool_calls",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    agentRunId: varchar("agent_run_id", { length: 64 }),
    agentStepId: varchar("agent_step_id", { length: 64 }),
    toolName: varchar("tool_name", { length: 192 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(), // completed | blocked | errored | pending_approval
    argumentsRedacted: json("arguments_redacted").$type<Record<string, unknown>>(),
    resultSummary: text("result_summary"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    workspaceIdx: index("tool_calls_workspace_id_idx").on(t.workspaceId),
    runIdx: index("tool_calls_agent_run_id_idx").on(t.agentRunId),
    toolNameIdx: index("tool_calls_tool_name_idx").on(t.toolName),
  }),
);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    quantity: decimal("quantity", { precision: 18, scale: 6 }).default("1").notNull(),
    unit: varchar("unit", { length: 32 }).notNull().default("count"),
    costUsd: decimal("cost_usd", { precision: 12, scale: 6 }),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    workspaceIdx: index("usage_events_workspace_id_idx").on(t.workspaceId),
    typeIdx: index("usage_events_event_type_idx").on(t.eventType),
    occurredIdx: index("usage_events_occurred_at_idx").on(t.occurredAt),
  }),
);

// ─── Pricing / cost ───────────────────────────────────────────────────────

export const pricingVersions = pgTable(
  "pricing_versions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    provider: varchar("provider", { length: 64 }).notNull(),
    model: varchar("model", { length: 128 }).notNull(),
    region: varchar("region", { length: 64 }),
    currency: varchar("currency", { length: 8 }).default("USD").notNull(),
    inputPer1m: decimal("input_per_1m", { precision: 12, scale: 6 }),
    outputPer1m: decimal("output_per_1m", { precision: 12, scale: 6 }),
    cachedInputPer1m: decimal("cached_input_per_1m", { precision: 12, scale: 6 }),
    effectiveFrom: timestamp("effective_from").notNull(),
    effectiveTo: timestamp("effective_to"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    providerModelFromUniq: uniqueIndex("pricing_versions_provider_model_from_uidx").on(
      t.provider,
      t.model,
      t.region,
      t.effectiveFrom,
    ),
  }),
);

export const costRecords = pgTable(
  "cost_records",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    llmRequestId: varchar("llm_request_id", { length: 64 }),
    pricingVersionId: varchar("pricing_version_id", { length: 64 }),
    amountUsd: decimal("amount_usd", { precision: 12, scale: 6 }).notNull(),
    /** estimate | confirmed */
    kind: varchar("kind", { length: 16 }).notNull().default("estimate"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    workspaceIdx: index("cost_records_workspace_id_idx").on(t.workspaceId),
    createdAtIdx: index("cost_records_created_at_idx").on(t.createdAt),
  }),
);

// ─── Billing invoices ─────────────────────────────────────────────────────

export const invoices = pgTable(
  "invoices",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    subscriptionId: varchar("subscription_id", { length: 64 }),
    externalId: varchar("external_id", { length: 128 }),
    status: invoiceStatusEnum("status").default("draft").notNull(),
    currency: varchar("currency", { length: 8 }).default("USD").notNull(),
    amountDue: decimal("amount_due", { precision: 12, scale: 2 }).notNull(),
    amountPaid: decimal("amount_paid", { precision: 12, scale: 2 }).default("0").notNull(),
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    dueAt: timestamp("due_at"),
    paidAt: timestamp("paid_at"),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    workspaceIdx: index("invoices_workspace_id_idx").on(t.workspaceId),
    externalUniq: uniqueIndex("invoices_external_id_uidx").on(t.externalId),
    statusIdx: index("invoices_status_idx").on(t.status),
  }),
);

// ─── Compliance ───────────────────────────────────────────────────────────

export const complianceFrameworks = pgTable("compliance_frameworks", {
  id: varchar("id", { length: 64 }).primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 192 }).notNull(),
  version: varchar("version", { length: 32 }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const complianceControls = pgTable(
  "compliance_controls",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    frameworkId: varchar("framework_id", { length: 64 }).notNull(),
    controlKey: varchar("control_key", { length: 64 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    requirement: text("requirement").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    frameworkControlUniq: uniqueIndex("compliance_controls_framework_key_uidx").on(
      t.frameworkId,
      t.controlKey,
    ),
  }),
);

export const complianceEvidence = pgTable(
  "compliance_evidence",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    controlId: varchar("control_id", { length: 64 }).notNull(),
    status: complianceControlStatusEnum("status").default("not_started").notNull(),
    summary: text("summary"),
    evidence: json("evidence").$type<Record<string, unknown>>(),
    ownerUserId: integer("owner_user_id"),
    lastTestedAt: timestamp("last_tested_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    workspaceControlUniq: uniqueIndex("compliance_evidence_ws_control_uidx").on(
      t.workspaceId,
      t.controlId,
    ),
    workspaceIdx: index("compliance_evidence_workspace_id_idx").on(t.workspaceId),
  }),
);

// ─── Canonical audit_logs (foundation name) ───────────────────────────────

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id"),
    actorUserId: integer("actor_user_id"),
    action: varchar("action", { length: 128 }).notNull(),
    targetType: varchar("target_type", { length: 64 }),
    targetId: varchar("target_id", { length: 128 }),
    beforeState: json("before_state").$type<Record<string, unknown>>(),
    afterState: json("after_state").$type<Record<string, unknown>>(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    correlationId: varchar("correlation_id", { length: 64 }),
    /** Hash chain for tamper evidence (previous row hash). */
    prevHash: varchar("prev_hash", { length: 64 }),
    rowHash: varchar("row_hash", { length: 64 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    workspaceIdx: index("audit_logs_workspace_id_idx").on(t.workspaceId),
    actorIdx: index("audit_logs_actor_user_id_idx").on(t.actorUserId),
    actionIdx: index("audit_logs_action_idx").on(t.action),
    createdAtIdx: index("audit_logs_created_at_idx").on(t.createdAt),
  }),
);

// ─── Types ────────────────────────────────────────────────────────────────

export type Identity = typeof identities.$inferSelect;
export type InsertIdentity = typeof identities.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type Repository = typeof repositories.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type InsertAgentRun = typeof agentRuns.$inferInsert;
export type Policy = typeof policies.$inferSelect;
export type InsertPolicy = typeof policies.$inferInsert;
export type PricingVersion = typeof pricingVersions.$inferSelect;
export type CostRecord = typeof costRecords.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type AuditLogRow = typeof auditLogs.$inferSelect;
