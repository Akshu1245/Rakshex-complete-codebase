/**
 * Governance schema extensions (migrations 0014–0020).
 *
 * SCHEMA-ONLY for now: tables/columns are migrated and exported for Drizzle,
 * but dedicated API/service glue for subjects, identity links, entitlements,
 * and provider-health incidents is not wired yet. Existing product paths use
 * control-plane / enterprise / webhook routers against earlier tables.
 * Do not invent large new features here — extend incrementally when a
 * shipping surface needs these rows.
 *
 * Agent Firewall tables (migration 0022) below ARE wired — see
 * apps/api/api/agentFirewall.ts and @rakshex/action-control for the live
 * identity/authority/ledger/approval API surface.
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

// ─── Agent Firewall enums (migration 0022) ────────────────────────────────
export const agentIdentityStatusEnum = pgEnum("agent_identity_status", [
  "active",
  "paused",
  "revoked",
]);
export const agentFirewallModeEnum = pgEnum("agent_firewall_mode", ["shadow", "enforce"]);
export const actionDecisionEnum = pgEnum("action_decision", [
  "ALLOW",
  "DENY",
  "APPROVAL_REQUIRED",
  "LIMIT",
  "REDACT",
  "SANDBOX",
  "PAUSE",
  "FREEZE",
]);
export const actionEffectiveDecisionEnum = pgEnum("action_effective_decision", [
  "ALLOW",
  "DENY",
  "PENDING_APPROVAL",
]);
export const actionApprovalStatusEnum = pgEnum("action_approval_status", [
  "pending",
  "approved",
  "rejected",
  "expired",
  "consumed",
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

// ─── Agent Firewall v0.1 (migration 0022) ─────────────────────────────────
// Identity, attenuating delegated authority, hash-chained action ledger and
// exact one-time-consumption approvals. Decision logic lives in
// @rakshex/action-control; these tables are the durable record.

/** Stable identity for a protected autonomous agent or workload. */
export const agentIdentities = pgTable(
  "agent_identities",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    agentKey: varchar("agent_key", { length: 128 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    ownerUserId: integer("owner_user_id").notNull(),
    framework: varchar("framework", { length: 64 }),
    model: varchar("model", { length: 128 }),
    environment: varchar("environment", { length: 32 }).default("production").notNull(),
    version: varchar("version", { length: 64 }).default("1").notNull(),
    mode: agentFirewallModeEnum("mode").default("shadow").notNull(),
    status: agentIdentityStatusEnum("status").default("active").notNull(),
    capabilities: json("capabilities").$type<string[]>().default([]).notNull(),
    policyConfig: json("policy_config").$type<Record<string, unknown>>(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    workspaceAgentKeyUniq: uniqueIndex("agent_identities_ws_key_uniq").on(
      table.workspaceId,
      table.agentKey,
    ),
    workspaceIdx: index("agent_identities_workspace_idx").on(table.workspaceId),
    ownerIdx: index("agent_identities_owner_idx").on(table.ownerUserId),
  }),
);
export type AgentIdentity = typeof agentIdentities.$inferSelect;
export type InsertAgentIdentity = typeof agentIdentities.$inferInsert;

/** Signed-at-the-boundary authority scopes. Raw capability tokens are never stored. */
export const delegatedAuthorities = pgTable(
  "delegated_authorities",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    agentId: varchar("agent_id", { length: 64 }).notNull(),
    principalUserId: integer("principal_user_id").notNull(),
    issuedByUserId: integer("issued_by_user_id").notNull(),
    parentAuthorityId: varchar("parent_authority_id", { length: 64 }),
    scope: json("scope").$type<Record<string, unknown>>().notNull(),
    scopeHash: varchar("scope_hash", { length: 64 }).notNull(),
    capabilityTokenHash: varchar("capability_token_hash", { length: 64 }).notNull(),
    capabilityPrefix: varchar("capability_prefix", { length: 20 }).notNull(),
    depth: integer("depth").default(0).notNull(),
    status: varchar("status", { length: 24 }).default("active").notNull(),
    useCount: integer("use_count").default(0).notNull(),
    amountUsedMinor: decimal("amount_used_minor", { precision: 20, scale: 0 })
      .default("0")
      .notNull(),
    validFrom: timestamp("valid_from").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    revokedByUserId: integer("revoked_by_user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    workspaceIdx: index("delegated_authorities_workspace_idx").on(table.workspaceId),
    agentIdx: index("delegated_authorities_agent_idx").on(table.agentId),
    capabilityHashUniq: uniqueIndex("delegated_authorities_cap_hash_uniq").on(
      table.capabilityTokenHash,
    ),
    activeIdx: index("delegated_authorities_active_idx").on(
      table.workspaceId,
      table.agentId,
      table.status,
    ),
  }),
);
export type DelegatedAuthority = typeof delegatedAuthorities.$inferSelect;
export type InsertDelegatedAuthority = typeof delegatedAuthorities.$inferInsert;

/** Tamper-evident decision and outcome record for every protected action. */
export const actionLedger = pgTable(
  "action_ledger",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    projectId: varchar("project_id", { length: 64 }),
    agentId: varchar("agent_id", { length: 64 }).notNull(),
    principalUserId: integer("principal_user_id").notNull(),
    authorityId: varchar("authority_id", { length: 64 }),
    traceId: varchar("trace_id", { length: 128 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    mode: agentFirewallModeEnum("mode").notNull(),
    semanticAction: varchar("semantic_action", { length: 128 }).notNull(),
    actionVersion: varchar("action_version", { length: 16 }).default("0.1").notNull(),
    domain: varchar("domain", { length: 32 }).notNull(),
    effect: varchar("effect", { length: 32 }).notNull(),
    parametersRedacted: json("parameters_redacted").$type<Record<string, unknown>>().notNull(),
    resource: varchar("resource", { length: 512 }),
    environment: varchar("environment", { length: 32 }),
    rawReference: json("raw_reference").$type<Record<string, unknown>>().notNull(),
    policyVersion: varchar("policy_version", { length: 128 }).notNull(),
    decision: actionDecisionEnum("decision").notNull(),
    effectiveDecision: actionEffectiveDecisionEnum("effective_decision").notNull(),
    reasons: json("reasons").$type<string[]>().notNull(),
    amountMinor: decimal("amount_minor", { precision: 20, scale: 0 }),
    currency: varchar("currency", { length: 3 }),
    approvalId: varchar("approval_id", { length: 64 }),
    outcomeStatus: varchar("outcome_status", { length: 32 }).default("not_executed").notNull(),
    outcome: json("outcome").$type<Record<string, unknown>>(),
    previousHash: varchar("previous_hash", { length: 64 }),
    recordHash: varchar("record_hash", { length: 64 }).notNull(),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    workspaceIdempotencyUniq: uniqueIndex("action_ledger_ws_idempotency_uniq").on(
      table.workspaceId,
      table.idempotencyKey,
    ),
    workspaceOccurredIdx: index("action_ledger_ws_occurred_idx").on(
      table.workspaceId,
      table.occurredAt,
    ),
    agentOccurredIdx: index("action_ledger_agent_occurred_idx").on(table.agentId, table.occurredAt),
    traceIdx: index("action_ledger_trace_idx").on(table.traceId),
  }),
);
export type ActionLedgerRecord = typeof actionLedger.$inferSelect;
export type InsertActionLedgerRecord = typeof actionLedger.$inferInsert;

/** Exact, expiring approval grant tied to one ledger record. */
export const actionApprovals = pgTable(
  "action_approvals",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    ledgerId: varchar("ledger_id", { length: 64 }).notNull(),
    requestedByAgentId: varchar("requested_by_agent_id", { length: 64 }).notNull(),
    semanticAction: varchar("semantic_action", { length: 128 }).notNull(),
    resource: varchar("resource", { length: 512 }),
    amountMinor: decimal("amount_minor", { precision: 20, scale: 0 }),
    currency: varchar("currency", { length: 3 }),
    status: actionApprovalStatusEnum("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    resolvedAt: timestamp("resolved_at"),
    resolvedByUserId: integer("resolved_by_user_id"),
    resolutionNote: text("resolution_note"),
    consumedAt: timestamp("consumed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    workspaceStatusIdx: index("action_approvals_ws_status_idx").on(table.workspaceId, table.status),
    ledgerUniq: uniqueIndex("action_approvals_ledger_uniq").on(table.ledgerId),
  }),
);
export type ActionApproval = typeof actionApprovals.$inferSelect;
export type InsertActionApproval = typeof actionApprovals.$inferInsert;

/**
 * ── Credential mediation (migration 0024) ────────────────────────────────
 *
 * Closes the "gateway bypass" hole: before this, an agent held the real
 * Stripe/GitHub key itself, so `evaluate()` recorded the correct decision but
 * could not actually stop the agent from calling the provider directly. The
 * ledger was advisory, not a control.
 *
 * The model here is CB4A "Model A" (proxy gateway): the raw provider secret
 * is stored encrypted (AES-256-GCM, per-workspace AAD — see
 * services/encryptedVault.ts) and NEVER leaves the server. The agent holds
 * only an opaque credential id. To make an upstream call the agent must
 * present a ledger id proving `evaluate()` returned ALLOW for the specific
 * semantic action; the broker then injects the secret at egress and returns
 * only the provider's response.
 */
export const brokeredCredentialStatusEnum = pgEnum("brokered_credential_status", [
  "active",
  "revoked",
]);

/** How the secret is attached to the outbound provider request. */
export const credentialInjectionEnum = pgEnum("credential_injection", [
  "bearer", // Authorization: Bearer <secret>
  "header", // <headerName>: <secret>
  "basic", // Authorization: Basic base64(<secret>:)
]);

export const brokeredCredentials = pgTable(
  "brokered_credentials",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    provider: varchar("provider", { length: 64 }).notNull(),
    /**
     * Vault ciphertext (`v1.iv.tag.ct`) of the provider secret, encrypted
     * with the workspace id as AAD so one workspace's blob cannot be
     * decrypted in another's context. The plaintext is never selected into
     * any API response.
     */
    secretCiphertext: text("secret_ciphertext").notNull(),
    /**
     * Semantic-action patterns this credential may be used for, e.g.
     * ["financial.refund"]. The broker requires the ledger record's
     * semanticAction to match one of these, so a credential minted for
     * refunds cannot be replayed to authorize a payout.
     */
    allowedActions: json("allowed_actions").$type<string[]>().notNull(),
    /**
     * Exact https origin the broker may send this secret to (e.g.
     * "https://api.stripe.com"). Prevents a compromised agent from
     * redirecting a valid credential to an attacker-controlled host.
     */
    allowedOrigin: varchar("allowed_origin", { length: 512 }).notNull(),
    injection: credentialInjectionEnum("injection").default("bearer").notNull(),
    /** Header name when `injection` = "header" (e.g. "X-Api-Key"). */
    headerName: varchar("header_name", { length: 128 }),
    status: brokeredCredentialStatusEnum("status").default("active").notNull(),
    createdByUserId: integer("created_by_user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
    lastUsedAt: timestamp("last_used_at"),
  },
  (table) => ({
    workspaceIdx: index("brokered_credentials_ws_idx").on(table.workspaceId, table.status),
  }),
);
export type BrokeredCredential = typeof brokeredCredentials.$inferSelect;
export type InsertBrokeredCredential = typeof brokeredCredentials.$inferInsert;

/**
 * One row per brokered upstream call. The unique index on ledgerId is the
 * anti-replay control: a single ALLOW decision can be spent exactly once, so
 * an agent cannot obtain one approval and then issue the same privileged
 * call repeatedly.
 */
export const credentialEgressLog = pgTable(
  "credential_egress_log",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    credentialId: varchar("credential_id", { length: 64 }).notNull(),
    ledgerId: varchar("ledger_id", { length: 64 }).notNull(),
    agentId: varchar("agent_id", { length: 64 }),
    semanticAction: varchar("semantic_action", { length: 128 }).notNull(),
    method: varchar("method", { length: 8 }).notNull(),
    targetUrl: varchar("target_url", { length: 2048 }).notNull(),
    responseStatus: integer("response_status"),
    durationMs: integer("duration_ms"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    ledgerUniq: uniqueIndex("credential_egress_ledger_uniq").on(table.ledgerId),
    workspaceIdx: index("credential_egress_ws_idx").on(table.workspaceId, table.createdAt),
  }),
);
export type CredentialEgressRecord = typeof credentialEgressLog.$inferSelect;
export type InsertCredentialEgressRecord = typeof credentialEgressLog.$inferInsert;
