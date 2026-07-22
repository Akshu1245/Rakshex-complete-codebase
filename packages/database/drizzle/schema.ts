import {
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  json,
  decimal,
  boolean,
  index,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["user", "editor", "admin"]);
export const userPlanEnum = pgEnum("user_plan", ["free", "pro", "enterprise"]);
export const collectionFormatEnum = pgEnum("collection_format", ["postman", "openapi", "bruno"]);
export const scanTypeEnum = pgEnum("scan_type", [
  "full",
  "quick",
  "shadow_api",
  "prompt_injection",
]);
export const scanStatusEnum = pgEnum("scan_status", ["pending", "running", "completed", "failed"]);
export const riskLevelEnum = pgEnum("risk_level", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const findingSeverityEnum = pgEnum("finding_severity", [
  "Critical",
  "High",
  "Medium",
  "Low",
]);
export const findingStatusEnum = pgEnum("finding_status", [
  "open",
  "in-progress",
  "resolved",
  "suppressed",
  "false_positive",
  "accepted_risk",
  "reopened",
]);
export const killSwitchEventTypeEnum = pgEnum("kill_switch_event_type", [
  "budget_set",
  "triggered",
  "auto_triggered",
  "reset",
]);
export const reportTypeEnum = pgEnum("report_type", [
  "pci_dss",
  "owasp",
  "custom",
  "owasp_llm",
  "dpdp",
  "gdpr",
]);
export const teamMemberRoleEnum = pgEnum("team_member_role", ["admin", "editor", "viewer"]);
export const teamMemberStatusEnum = pgEnum("team_member_status", [
  "pending",
  "accepted",
  "rejected",
]);
export const subscriptionPlanEnum = pgEnum("subscription_plan", ["free", "pro", "enterprise"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "paused",
  "cancelled",
  "past_due",
  "pending",
  "halted",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "created",
  "authorized",
  "captured",
  "failed",
  "refunded",
  "partially_refunded",
]);
export const refundStatusEnum = pgEnum("refund_status", ["null", "partial", "full"]);
export const mcpTransportEnum = pgEnum("mcp_transport", ["stdio", "streamable-http", "sse"]);
export const mcpRiskClassEnum = pgEnum("mcp_risk_class", ["safe", "elevated", "unsafe", "unknown"]);
export const gatewayDecisionEnum = pgEnum("gateway_decision", ["allowed", "blocked", "errored"]);
export const tokenBudgetModeEnum = pgEnum("token_budget_mode", ["soft", "hard"]);
export const shadowAiSeverityEnum = pgEnum("shadow_ai_severity", [
  "info",
  "low",
  "medium",
  "high",
  "critical",
]);
export const aiAllowlistKindEnum = pgEnum("ai_allowlist_kind", ["host", "model"]);
export const redteamTriggeredByEnum = pgEnum("redteam_triggered_by", ["manual", "schedule", "api"]);
export const redteamStatusEnum = pgEnum("redteam_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);
export const redteamSeverityEnum = pgEnum("redteam_severity", [
  "Low",
  "Medium",
  "High",
  "Critical",
]);
export const redteamOutcomeEnum = pgEnum("redteam_outcome", ["blocked", "leaked", "errored"]);
export const autofixStatusEnum = pgEnum("autofix_status", ["open", "applied", "dismissed"]);
export const copilotRoleEnum = pgEnum("copilot_role", ["user", "assistant", "system"]);
export const alertWindowEnum = pgEnum("alert_window", ["1h", "24h", "7d"]);
export const alertSeverityEnum = pgEnum("alert_severity", ["low", "medium", "high", "critical"]);
export const ssoKindEnum = pgEnum("sso_kind", ["oidc", "saml"]);
export const ssoDefaultRoleEnum = pgEnum("sso_default_role", ["admin", "editor", "viewer"]);
export const workspaceMemberRoleEnum = pgEnum("workspace_member_role", [
  "owner",
  "admin",
  "security_lead",
  "developer",
  "analyst",
  "viewer",
  "billing_admin",
  "editor", // legacy alias
]);
export const workspaceInvitationRoleEnum = pgEnum("workspace_invitation_role", [
  "admin",
  "security_lead",
  "developer",
  "analyst",
  "viewer",
  "billing_admin",
  "editor", // legacy alias
]);
export const aiEventStatusEnum = pgEnum("ai_event_status", ["ok", "error", "timeout", "blocked"]);
export const securityEventTypeEnum = pgEnum("security_event_type", [
  "prompt_injection",
  "pii_leak",
  "policy_violation",
  "anomaly",
]);
export const securitySeverityEnum = pgEnum("security_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: userRoleEnum("role").default("user").notNull(),
    plan: userPlanEnum("plan").default("free").notNull(),
    passwordHash: varchar("passwordHash", { length: 512 }),
    apiKey: varchar("apiKey", { length: 64 }),
    apiKeyPrefix: varchar("apiKeyPrefix", { length: 12 }),
    scansRemaining: integer("scansRemaining").default(10).notNull(),
    onboardingCompleted: boolean("onboardingCompleted").default(false).notNull(),
    failedLoginAttempts: integer("failedLoginAttempts").default(0).notNull(),
    lockedUntil: timestamp("lockedUntil"),
    totpSecret: varchar("totpSecret", { length: 64 }),
    pendingTotpSecret: varchar("pendingTotpSecret", { length: 64 }),
    pendingTotpExpiresAt: timestamp("pendingTotpExpiresAt"),
    emailVerifiedAt: timestamp("email_verified_at"),
    /** SHA-256 hashes of MFA recovery codes (JSON string array). */
    recoveryCodesHash: json("recovery_codes_hash").$type<string[]>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index().on(table.email),
    apiKeyIdx: index().on(table.apiKey),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * VS Code extension activity tracking.
 */
export const vscodeActivities = pgTable(
  "vscode_activities",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("userId").notNull(),
    type: varchar("type", { length: 32 }).notNull(),
    data: json("data"),
    timestamp: timestamp("timestamp").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    timestampIdx: index().on(table.timestamp),
  }),
);

export type VscodeActivity = typeof vscodeActivities.$inferSelect;
export type InsertVscodeActivity = typeof vscodeActivities.$inferInsert;

/**
 * API Collections - stores imported Postman/OpenAPI collections
 */
export const collections = pgTable(
  "collections",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("userId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    format: collectionFormatEnum("format").notNull(),
    data: json("data").notNull(), // Store full collection JSON
    totalRequests: integer("totalRequests").default(0).notNull(),
    githubRepo: varchar("githubRepo", { length: 255 }), // Link to GitHub repo (owner/repo format)
    lastScannedAt: timestamp("lastScannedAt"),
    contentHash: varchar("content_hash", { length: 64 }),
    tags: json("tags").$type<string[]>().default([]),
    version: integer("version").default(1),
    workspaceId: integer("workspace_id"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    githubRepoIdx: index().on(table.githubRepo),
    workspaceIdIdx: index("collections_workspace_id_idx").on(table.workspaceId),
    workspaceCreatedIdx: index("collections_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
  }),
);

export type Collection = typeof collections.$inferSelect;
export type InsertCollection = typeof collections.$inferInsert;

/**
 * Security Scans - stores scan history and results
 */
export const scans = pgTable(
  "scans",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("userId").notNull(),
    collectionId: varchar("collectionId", { length: 64 }).notNull(),
    scanType: scanTypeEnum("scanType").notNull(),
    status: scanStatusEnum("status").notNull(),
    riskScore: decimal("riskScore", { precision: 5, scale: 2 }).default("0"),
    riskLevel: riskLevelEnum("riskLevel").notNull(),
    totalFindings: integer("totalFindings").default(0).notNull(),
    findingsData: json("findingsData"), // Store findings summary
    workspaceId: integer("workspace_id"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    collectionIdIdx: index().on(table.collectionId),
    workspaceIdIdx: index("scans_workspace_id_idx").on(table.workspaceId),
    workspaceCreatedIdx: index("scans_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
    collectionCreatedIdx: index("scans_collection_created_idx").on(
      table.collectionId,
      table.createdAt,
    ),
  }),
);

export type Scan = typeof scans.$inferSelect;
export type InsertScan = typeof scans.$inferInsert;

/**
 * Security Findings - individual vulnerabilities found in scans
 */
export const findings = pgTable(
  "findings",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    scanId: varchar("scanId", { length: 64 }).notNull(),
    collectionId: varchar("collectionId", { length: 64 }).notNull(),
    userId: integer("userId").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    severity: findingSeverityEnum("severity").notNull(),
    category: varchar("category", { length: 255 }),
    remediation: text("remediation"),
    status: findingStatusEnum("status").default("open").notNull(),
    cweId: varchar("cweId", { length: 64 }),
    ruleId: varchar("rule_id", { length: 128 }),
    confidence: varchar("confidence", { length: 32 }),
    fingerprint: varchar("fingerprint", { length: 255 }),
    endpoint: text("endpoint"),
    method: varchar("method", { length: 16 }),
    evidence: json("evidence"),
    assigneeUserId: integer("assignee_user_id"),
    dueAt: timestamp("due_at"),
    duplicateOf: varchar("duplicate_of", { length: 64 }),
    suppressionReason: text("suppression_reason"),
    suppressionExpiresAt: timestamp("suppression_expires_at"),
    acceptedRiskReason: text("accepted_risk_reason"),
    acceptedRiskApprovedBy: integer("accepted_risk_approved_by"),
    workspaceId: integer("workspace_id"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    scanIdIdx: index().on(table.scanId),
    collectionIdIdx: index().on(table.collectionId),
    userIdIdx: index().on(table.userId),
    fingerprintIdx: index().on(table.fingerprint),
    ruleIdIdx: index().on(table.ruleId),
    statusIdx: index().on(table.status),
    workspaceIdIdx: index("findings_workspace_id_idx").on(table.workspaceId),
    workspaceCreatedIdx: index("findings_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
    collectionStatusIdx: index("findings_collection_status_idx").on(
      table.collectionId,
      table.status,
    ),
  }),
);

export type Finding = typeof findings.$inferSelect;
export type InsertFinding = typeof findings.$inferInsert;

/**
 * Shadow APIs - undocumented endpoints detected in collections
 */
export const shadowAPIs = pgTable(
  "shadow_apis",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    scanId: varchar("scanId", { length: 64 }).notNull(),
    collectionId: varchar("collectionId", { length: 64 }).notNull(),
    userId: integer("userId").notNull(),
    endpoint: varchar("endpoint", { length: 255 }).notNull(),
    method: varchar("method", { length: 16 }),
    file: varchar("file", { length: 255 }),
    line: integer("line"),
    riskLevel: riskLevelEnum("riskLevel").notNull(),
    reason: text("reason"),
    recommendation: text("recommendation"),
    isDocumented: boolean("isDocumented").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    scanIdIdx: index().on(table.scanId),
    collectionIdIdx: index().on(table.collectionId),
    userIdIdx: index().on(table.userId),
  }),
);

export type ShadowAPI = typeof shadowAPIs.$inferSelect;
export type InsertShadowAPI = typeof shadowAPIs.$inferInsert;

/**
 * LLM Token Usage - tracks token consumption per model
 */
export const tokenUsage = pgTable(
  "token_usage",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("userId").notNull(),
    model: varchar("model", { length: 128 }).notNull(),
    promptTokens: integer("promptTokens").default(0).notNull(),
    completionTokens: integer("completionTokens").default(0).notNull(),
    thinkingTokens: integer("thinkingTokens").default(0).notNull(),
    totalTokens: integer("totalTokens").default(0).notNull(),
    costUSD: decimal("costUSD", { precision: 10, scale: 6 }).default("0"),
    date: timestamp("date").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    modelIdx: index().on(table.model),
    dateIdx: index().on(table.date),
  }),
);

export type TokenUsage = typeof tokenUsage.$inferSelect;
export type InsertTokenUsage = typeof tokenUsage.$inferInsert;

/**
 * Kill Switch Events - audit trail for kill switch triggers and budget management
 */
export const killSwitchEvents = pgTable(
  "kill_switch_events",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("userId").notNull(),
    eventType: killSwitchEventTypeEnum("eventType").notNull(),
    budgetLimit: decimal("budgetLimit", { precision: 10, scale: 2 }),
    currentSpend: decimal("currentSpend", { precision: 10, scale: 2 }),
    reason: text("reason"),
    details: json("details"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
  }),
);

export type KillSwitchEvent = typeof killSwitchEvents.$inferSelect;
export type InsertKillSwitchEvent = typeof killSwitchEvents.$inferInsert;

/**
 * Kill Switch Settings - current budget and status per user
 */
export const killSwitchSettings = pgTable(
  "kill_switch_settings",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("userId").notNull().unique(),
    budgetLimitUSD: decimal("budgetLimitUSD", {
      precision: 10,
      scale: 2,
    }).default("100"),
    isActive: boolean("isActive").default(false).notNull(),
    currentSpendUSD: decimal("currentSpendUSD", {
      precision: 10,
      scale: 2,
    }).default("0"),
    lastWarningSentAt: timestamp("lastWarningSentAt"), // Track when 80% warning was last sent
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
  }),
);

export type KillSwitchSettings = typeof killSwitchSettings.$inferSelect;
export type InsertKillSwitchSettings = typeof killSwitchSettings.$inferInsert;

/**
 * Compliance Reports - PCI DSS compliance assessment results
 */
export const complianceReports = pgTable(
  "compliance_reports",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("userId").notNull(),
    collectionId: varchar("collectionId", { length: 64 }).notNull(),
    reportType: reportTypeEnum("reportType").notNull(),
    complianceScore: decimal("complianceScore", {
      precision: 5,
      scale: 2,
    }).notNull(),
    totalRequirements: integer("totalRequirements").notNull(),
    metRequirements: integer("metRequirements").notNull(),
    requirementsData: json("requirementsData"), // Detailed requirement breakdown
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt"),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    collectionIdIdx: index().on(table.collectionId),
  }),
);

export type ComplianceReport = typeof complianceReports.$inferSelect;
export type InsertComplianceReport = typeof complianceReports.$inferInsert;

/**
 * Team Members - users invited to collaborate on workspace
 */
export const teamMembers = pgTable(
  "team_members",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("userId").notNull(), // Owner/inviter
    memberEmail: varchar("memberEmail", { length: 320 }).notNull(),
    memberUserId: integer("memberUserId"), // Set when member accepts invitation
    role: teamMemberRoleEnum("role").default("viewer").notNull(),
    status: teamMemberStatusEnum("status").default("pending").notNull(),
    invitedAt: timestamp("invitedAt").defaultNow().notNull(),
    acceptedAt: timestamp("acceptedAt"),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    memberEmailIdx: index().on(table.memberEmail),
  }),
);

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;

/**
 * Onboarding Progress - tracks user progress through onboarding wizard
 */
export const onboardingProgress = pgTable(
  "onboarding_progress",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("userId").notNull().unique(),
    currentStep: integer("currentStep").default(1).notNull(), // 1-5
    importCollectionCompleted: boolean("importCollectionCompleted").default(false).notNull(),
    runScanCompleted: boolean("runScanCompleted").default(false).notNull(),
    reviewFindingsCompleted: boolean("reviewFindingsCompleted").default(false).notNull(),
    inviteTeamCompleted: boolean("inviteTeamCompleted").default(false).notNull(),
    setupComplianceCompleted: boolean("setupComplianceCompleted").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
  }),
);

export type OnboardingProgress = typeof onboardingProgress.$inferSelect;
export type InsertOnboardingProgress = typeof onboardingProgress.$inferInsert;

/**
 * In-app notifications — scan results, cost anomalies, security alerts,
 * billing, and team events surfaced in the dashboard bell + feed.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    type: varchar("type", { length: 40 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    link: varchar("link", { length: 300 }),
    read: boolean("read").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    createdAtIdx: index().on(table.createdAt),
  }),
);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

/**
 * Feature flags — runtime on/off + percentage rollout toggles managed from
 * the admin dashboard. Gates risky or gradual-rollout features without a deploy.
 */
export const featureFlags = pgTable("feature_flags", {
  key: varchar("key", { length: 80 }).primaryKey(),
  description: varchar("description", { length: 300 }).notNull().default(""),
  enabled: boolean("enabled").default(false).notNull(),
  rolloutPercentage: integer("rolloutPercentage").default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = typeof featureFlags.$inferInsert;

/**
 * Subscriptions - Razorpay subscription management
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("userId").notNull().unique(),
    plan: subscriptionPlanEnum("plan").default("free").notNull(),
    razorpaySubscriptionId: varchar("razorpaySubscriptionId", {
      length: 255,
    }).unique(),
    razorpayCustomerId: varchar("razorpayCustomerId", { length: 255 }),
    status: subscriptionStatusEnum("status").default("pending").notNull(),
    currentPeriodStart: timestamp("currentPeriodStart"),
    currentPeriodEnd: timestamp("currentPeriodEnd"),
    cancelledAt: timestamp("cancelledAt"),
    cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    razorpaySubscriptionIdIdx: index().on(table.razorpaySubscriptionId),
    statusIdx: index().on(table.status),
    currentPeriodEndIdx: index().on(table.currentPeriodEnd),
  }),
);

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * Payments - Razorpay payment records and invoices
 */
export const payments = pgTable(
  "payments",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("userId").notNull(),
    subscriptionId: varchar("subscriptionId", { length: 64 }),
    razorpayPaymentId: varchar("razorpayPaymentId", { length: 255 }).notNull().unique(),
    razorpayOrderId: varchar("razorpayOrderId", { length: 255 }),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("INR").notNull(),
    status: paymentStatusEnum("status").default("created").notNull(),
    receipt: varchar("receipt", { length: 255 }),
    description: text("description"),
    metadata: json("metadata"),
    refundAmount: decimal("refundAmount", { precision: 10, scale: 2 }).default("0"),
    refundStatus: refundStatusEnum("refundStatus").default("null"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    subscriptionIdIdx: index().on(table.subscriptionId),
    razorpayPaymentIdIdx: index().on(table.razorpayPaymentId),
    statusIdx: index().on(table.status),
    createdAtIdx: index().on(table.createdAt),
  }),
);

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

/**
 * Password Reset Tokens - stores SHA-256 hashes of reset tokens (never plaintext).
 * Column name remains `token` for compatibility; writers must hash before insert.
 */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("userId").notNull(),
    /** SHA-256 hex of the raw token sent to the user */
    token: varchar("token", { length: 255 }).notNull().unique(),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    tokenIdx: index().on(table.token),
    expiresAtIdx: index().on(table.expiresAt),
  }),
);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

/**
 * User Sessions - track active sessions for session management
 */
export const userSessions = pgTable(
  "user_sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("userId").notNull(),
    sessionToken: varchar("sessionToken", { length: 255 }).notNull().unique(),
    refreshTokenHash: varchar("refreshTokenHash", { length: 64 }),
    ipAddress: varchar("ipAddress", { length: 45 }),
    userAgent: text("userAgent"),
    lastActiveAt: timestamp("lastActiveAt").defaultNow().notNull(),
    lastUsedAt: timestamp("lastUsedAt"),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    revokedAt: timestamp("revokedAt"),
    isRevoked: boolean("isRevoked").default(false).notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    sessionTokenIdx: index().on(table.sessionToken),
    expiresAtIdx: index().on(table.expiresAt),
    refreshTokenHashIdx: index().on(table.refreshTokenHash),
  }),
);

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = typeof userSessions.$inferInsert;

/**
 * Email Preferences - user notification settings
 */
export const emailPreferences = pgTable(
  "email_preferences",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("userId").notNull().unique(),
    unsubscribeToken: varchar("unsubscribeToken", { length: 64 }).unique(),
    scanComplete: boolean("scanComplete").default(true).notNull(),
    budgetAlerts: boolean("budgetAlerts").default(true).notNull(),
    weeklyDigest: boolean("weeklyDigest").default(true).notNull(),
    teamActivity: boolean("teamActivity").default(true).notNull(),
    promotionalEmails: boolean("promotionalEmails").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
  }),
);

export type EmailPreference = typeof emailPreferences.$inferSelect;
export type InsertEmailPreference = typeof emailPreferences.$inferInsert;

/**
 * Audit Log - track important user actions for security
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("userId").notNull(),
    action: varchar("action", { length: 128 }).notNull(), // password_changed, email_changed, account_deleted, etc.
    details: json("details"),
    ipAddress: varchar("ipAddress", { length: 45 }),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    actionIdx: index().on(table.action),
    createdAtIdx: index().on(table.createdAt),
  }),
);

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

/**
 * Lifecycle Webhooks - user-registered HTTP endpoints that Rakshex calls
 * when events fire (scan.complete, finding.discovered, quota.warning,
 * kill_switch.triggered). Generalises what the hard-coded Slack integration
 * already does. Each delivery is signed with an HMAC-SHA256 digest of the
 * body using the per-endpoint `secret`, same shape Razorpay / Stripe use.
 */
export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("userId").notNull(),
    url: varchar("url", { length: 1024 }).notNull(),
    // 32-byte random secret, base64-encoded (length 44). Never exposed
    // after creation except in masked form.
    secret: varchar("secret", { length: 128 }).notNull(),
    // Array of event names this endpoint subscribes to. JSON for easy
    // multi-event subscription without a join table.
    events: json("events").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    lastDeliveryAt: timestamp("lastDeliveryAt"),
    lastStatus: integer("lastStatus"),
    // Incremented each failed delivery, reset on success. We auto-disable
    // an endpoint once this reaches 20 (~a day of retries) to avoid
    // hammering dead receivers.
    consecutiveFailures: integer("consecutiveFailures").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
  }),
);

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type InsertWebhookEndpoint = typeof webhookEndpoints.$inferInsert;

/**
 * Webhook Deliveries - audit trail of every webhook fire. Kept in-table
 * (rather than just logs) so users can inspect history and retry failed
 * ones from the dashboard.
 */
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    webhookId: varchar("webhookId", { length: 64 }).notNull(),
    event: varchar("event", { length: 64 }).notNull(),
    payload: json("payload").notNull(),
    status: integer("status"),
    responseBody: text("responseBody"),
    errorMessage: text("errorMessage"),
    deliveredAt: timestamp("deliveredAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    webhookIdIdx: index().on(table.webhookId),
    createdAtIdx: index().on(table.createdAt),
  }),
);

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type InsertWebhookDelivery = typeof webhookDeliveries.$inferInsert;

/**
 * Processed Webhook Events — idempotency log for inbound webhooks
 * (Razorpay, Stripe, GitHub, etc.). Razorpay in particular retries the
 * same event for ~24 hours if our 2xx response is delayed or lost, which
 * means we'd otherwise upgrade a user's plan multiple times for a single
 * payment. We persist the provider's event ID so a duplicate delivery
 * short-circuits before any side effect runs.
 */
export const processedWebhookEvents = pgTable(
  "processed_webhook_events",
  {
    // Composite identity stored as `provider:eventId` so we never have
    // to worry about cross-provider id collisions (Razorpay's `evt_*`
    // namespace overlaps with Stripe's, for example).
    id: varchar("id", { length: 128 }).primaryKey(),
    provider: varchar("provider", { length: 32 }).notNull(),
    eventId: varchar("eventId", { length: 128 }).notNull(),
    eventType: varchar("eventType", { length: 64 }).notNull(),
    processedAt: timestamp("processedAt").defaultNow().notNull(),
  },
  (table) => ({
    providerEventIdx: index().on(table.provider, table.eventId),
  }),
);

export type ProcessedWebhookEvent = typeof processedWebhookEvents.$inferSelect;
export type InsertProcessedWebhookEvent = typeof processedWebhookEvents.$inferInsert;

/**
 * MCP Server registry — Sprint 2 scaffolding for "MCP Governance".
 *
 * An MCP server (Model Context Protocol) is a process that exposes one or
 * more *tools* an LLM agent can call. Rakshex models the registry, the
 * permission graph (which user/agent may call which tool on which server),
 * and an immutable audit log of every tool invocation routed through the
 * gateway. The actual MCP transport (stdio / streamable-http / sse) is
 * pluggable; the schema below is transport-agnostic.
 */
export const mcpServers = pgTable(
  "mcp_servers",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("userId").notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    url: varchar("url", { length: 1024 }),
    transport: mcpTransportEnum("transport").notNull(),
    /**
     * Capability fingerprint — JSON snapshot of the tool list the server
     * advertised at last discovery, used to detect drift / capability
     * additions that may need re-review.
     */
    capabilityFingerprint: json("capabilityFingerprint"),
    riskScore: integer("riskScore").default(0).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    discoveredAt: timestamp("discoveredAt").defaultNow().notNull(),
    lastSeenAt: timestamp("lastSeenAt"),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
  }),
);

export type McpServer = typeof mcpServers.$inferSelect;
export type InsertMcpServer = typeof mcpServers.$inferInsert;

/**
 * MCP Tools — denormalised list of tools a registered MCP server exposes.
 * One row per (server, tool name). Lets us run permission-graph queries
 * (which agent can call this tool) without hitting the JSON capability
 * blob.
 */
export const mcpTools = pgTable(
  "mcp_tools",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    serverId: varchar("serverId", { length: 64 }).notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    description: text("description"),
    /**
     * Risk classification produced by the static analyzer. `unsafe` means
     * the tool can mutate external state without confirmation (e.g.
     * filesystem write, payment, mass email). The dashboard surfaces
     * unsafe tools on a separate review screen.
     */
    riskClass: mcpRiskClassEnum("riskClass").default("unknown").notNull(),
    /** Schema for input parameters (JSON Schema). */
    inputSchema: json("inputSchema"),
    isApproved: boolean("isApproved").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    serverIdIdx: index().on(table.serverId),
  }),
);

export type McpTool = typeof mcpTools.$inferSelect;
export type InsertMcpTool = typeof mcpTools.$inferInsert;

/**
 * MCP Tool Invocation Log — append-only audit trail of every tool call
 * routed through the Rakshex gateway. Source of truth for the "permission
 * graph" view (who used what when), abuse detection, and compliance
 * evidence.
 *
 * NOTE: we log a SHA-256 fingerprint of the `arguments` payload by default,
 * never the raw arguments. The dashboard only fetches raw args on demand
 * and only for users with the `mcp:audit:read-raw` permission.
 */
export const mcpInvocationLog = pgTable(
  "mcp_invocation_log",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("userId").notNull(),
    serverId: varchar("serverId", { length: 64 }).notNull(),
    toolId: varchar("toolId", { length: 64 }).notNull(),
    /** Gateway request id. Joins back to gateway audit records. */
    requestId: varchar("requestId", { length: 64 }),
    /** SHA-256 fingerprint of input args, base16. */
    argsFingerprint: varchar("argsFingerprint", { length: 64 }),
    decision: gatewayDecisionEnum("decision").notNull(),
    blockReason: varchar("blockReason", { length: 128 }),
    durationMs: integer("durationMs"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    serverIdIdx: index().on(table.serverId),
    toolIdIdx: index().on(table.toolId),
    createdAtIdx: index().on(table.createdAt),
  }),
);

export type McpInvocation = typeof mcpInvocationLog.$inferSelect;
export type InsertMcpInvocation = typeof mcpInvocationLog.$inferInsert;

// ============================================================================
// SPRINT 3: AI Runtime Governance — gateway audit, token meters, shadow AI,
// continuous red-team, auto-fix engine, security copilot.
// ============================================================================

/**
 * Gateway audit log — every request that crossed the inline LLM gateway.
 * One row per request, regardless of decision (allowed/blocked/errored).
 * Drives the runtime dashboard, anomaly detection, and the cost meter.
 */
export const gatewayAudit = pgTable(
  "gateway_audit",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    requestId: varchar("requestId", { length: 64 }).notNull(),
    model: varchar("model", { length: 96 }).notNull(),
    provider: varchar("provider", { length: 32 }),
    decision: gatewayDecisionEnum("decision").notNull().default("allowed"),
    blockReason: varchar("blockReason", { length: 96 }),
    promptTokens: integer("promptTokens").default(0).notNull(),
    completionTokens: integer("completionTokens").default(0).notNull(),
    totalTokens: integer("totalTokens").default(0).notNull(),
    estimatedCostUsd: decimal("estimatedCostUsd", { precision: 10, scale: 6 })
      .default("0")
      .notNull(),
    promptFingerprint: varchar("promptFingerprint", { length: 64 }),
    latencyMs: integer("latencyMs"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    createdAtIdx: index().on(table.createdAt),
    decisionIdx: index().on(table.decision),
    modelIdx: index().on(table.model),
  }),
);
export type GatewayAuditRow = typeof gatewayAudit.$inferSelect;
export type InsertGatewayAuditRow = typeof gatewayAudit.$inferInsert;

/**
 * Per-tenant daily token caps. The gateway consults these inline to enforce
 * hard / soft budgets without polling the cost meter on every request.
 */
export const tokenBudgets = pgTable("token_budgets", {
  userId: serial("userId").primaryKey(),
  dailyTokenLimit: integer("dailyTokenLimit"),
  mode: tokenBudgetModeEnum("mode").default("soft").notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdateFn(() => new Date())
    .notNull(),
});
export type TokenBudgetRow = typeof tokenBudgets.$inferSelect;
export type InsertTokenBudgetRow = typeof tokenBudgets.$inferInsert;

/**
 * Shadow-AI events — observations of LLM traffic from sources OTHER than the
 * sanctioned gateway. Fed by log ingestion, network taps, or agent telemetry.
 * Events flagged "rogue" are surfaced in the dashboard.
 */
export const shadowAiEvents = pgTable(
  "shadow_ai_events",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    source: varchar("source", { length: 64 }).notNull(),
    detectedHost: varchar("detectedHost", { length: 192 }).notNull(),
    detectedModel: varchar("detectedModel", { length: 96 }),
    isAllowlisted: boolean("isAllowlisted").default(false).notNull(),
    severity: shadowAiSeverityEnum("severity").default("medium").notNull(),
    rawSignals: json("rawSignals"),
    occurredAt: timestamp("occurredAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    severityIdx: index().on(table.severity),
    detectedHostIdx: index().on(table.detectedHost),
  }),
);
export type ShadowAiEventRow = typeof shadowAiEvents.$inferSelect;
export type InsertShadowAiEventRow = typeof shadowAiEvents.$inferInsert;

/**
 * Allowlist / denylist of LLM hosts and models per tenant. Gates the
 * shadow-AI classifier — if a host isn't here, it's considered "shadow."
 */
export const aiAllowlist = pgTable(
  "ai_allowlist",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    /** "host" — match by hostname; "model" — match by model id. */
    kind: aiAllowlistKindEnum("kind").notNull(),
    pattern: varchar("pattern", { length: 192 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
  }),
);
export type AiAllowlistRow = typeof aiAllowlist.$inferSelect;
export type InsertAiAllowlistRow = typeof aiAllowlist.$inferInsert;

/**
 * Continuous red-team runs — one row per scheduled (or manually triggered)
 * attack simulation against the customer's LLM gateway endpoint. Stores
 * aggregate scores; per-payload outcomes go in `redteamFindings`.
 */
export const redteamRuns = pgTable(
  "redteam_runs",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("userId").notNull(),
    target: varchar("target", { length: 192 }).notNull(),
    triggeredBy: redteamTriggeredByEnum("triggeredBy").default("manual").notNull(),
    status: redteamStatusEnum("status").default("pending").notNull(),
    totalPayloads: integer("totalPayloads").default(0).notNull(),
    blockedCount: integer("blockedCount").default(0).notNull(),
    leakedCount: integer("leakedCount").default(0).notNull(),
    erroredCount: integer("erroredCount").default(0).notNull(),
    /** Out of 100. */
    securityScore: integer("securityScore"),
    durationMs: integer("durationMs"),
    startedAt: timestamp("startedAt"),
    finishedAt: timestamp("finishedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    statusIdx: index().on(table.status),
    createdAtIdx: index().on(table.createdAt),
  }),
);
export type RedteamRunRow = typeof redteamRuns.$inferSelect;
export type InsertRedteamRunRow = typeof redteamRuns.$inferInsert;

export const redteamFindings = pgTable(
  "redteam_findings",
  {
    id: serial("id").primaryKey(),
    runId: varchar("runId", { length: 64 }).notNull(),
    payloadId: varchar("payloadId", { length: 64 }).notNull(),
    category: varchar("category", { length: 64 }).notNull(),
    severity: redteamSeverityEnum("severity").notNull(),
    outcome: redteamOutcomeEnum("outcome").notNull(),
    /** First 200 chars of the response, sanitized. */
    sample: text("sample"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    runIdIdx: index().on(table.runId),
    outcomeIdx: index().on(table.outcome),
  }),
);
export type RedteamFindingRow = typeof redteamFindings.$inferSelect;
export type InsertRedteamFindingRow = typeof redteamFindings.$inferInsert;

/**
 * Continuous red-team schedule entries. Fanned out by the cron loop.
 */
export const redteamSchedules = pgTable(
  "redteam_schedules",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    target: varchar("target", { length: 192 }).notNull(),
    /** Cron expression (UTC). */
    cron: varchar("cron", { length: 64 }).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    lastRunAt: timestamp("lastRunAt"),
    nextRunAt: timestamp("nextRunAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    activeIdx: index().on(table.isActive),
  }),
);
export type RedteamScheduleRow = typeof redteamSchedules.$inferSelect;
export type InsertRedteamScheduleRow = typeof redteamSchedules.$inferInsert;

/**
 * Auto-fix suggestions — generated remediation snippets per finding type.
 * The auto-fix engine is templated, deterministic, and never proposes a fix
 * that wasn't explicitly modelled — no LLM-generated patches that could
 * themselves contain injection payloads.
 */
export const autofixSuggestions = pgTable(
  "autofix_suggestions",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    findingType: varchar("findingType", { length: 64 }).notNull(),
    findingRef: varchar("findingRef", { length: 128 }),
    title: varchar("title", { length: 192 }).notNull(),
    rationale: text("rationale"),
    languageHint: varchar("languageHint", { length: 32 }),
    snippet: text("snippet").notNull(),
    status: autofixStatusEnum("status").default("open").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    statusIdx: index().on(table.status),
    findingTypeIdx: index().on(table.findingType),
  }),
);
export type AutofixSuggestionRow = typeof autofixSuggestions.$inferSelect;
export type InsertAutofixSuggestionRow = typeof autofixSuggestions.$inferInsert;

/**
 * Security copilot conversations — chat-over-data sessions where the user
 * asks questions about their own runtime data. The conversations are
 * scoped to the user; the retrieval layer never crosses tenants.
 */
export const copilotConversations = pgTable(
  "copilot_conversations",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("userId").notNull(),
    title: varchar("title", { length: 192 }).notNull().default("New chat"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
  }),
);
export type CopilotConversationRow = typeof copilotConversations.$inferSelect;
export type InsertCopilotConversationRow = typeof copilotConversations.$inferInsert;

export const copilotMessages = pgTable(
  "copilot_messages",
  {
    id: serial("id").primaryKey(),
    conversationId: varchar("conversationId", { length: 64 }).notNull(),
    role: copilotRoleEnum("role").notNull(),
    content: text("content").notNull(),
    /** JSON-encoded list of references (table+rowId pairs). */
    references: json("references"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    conversationIdx: index().on(table.conversationId),
  }),
);
export type CopilotMessageRow = typeof copilotMessages.$inferSelect;
export type InsertCopilotMessageRow = typeof copilotMessages.$inferInsert;

/**
 * YAML policy documents authored by a tenant. The compiled JSON is cached
 * alongside the source so the gateway can apply policies without re-parsing.
 */
export const tenantPolicies = pgTable(
  "tenant_policies",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    name: varchar("name", { length: 192 }).notNull(),
    yaml: text("yaml").notNull(),
    compiled: json("compiled").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    appliesTo: varchar("appliesTo", { length: 256 }).notNull().default("all"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    appliesToIdx: index().on(table.appliesTo),
  }),
);
export type TenantPolicyRow = typeof tenantPolicies.$inferSelect;
export type InsertTenantPolicyRow = typeof tenantPolicies.$inferInsert;

/**
 * User-defined alert rules (Sprint 6).
 * `conditions` is the JSON-encoded condition list and `channels` carries
 * the integration credentials (Discord webhook / PagerDuty routing key /
 * webhook endpoint refs). PagerDuty routing keys SHOULD be encrypted at
 * rest when used in production — the gateway accepts both raw and
 * vault-fingerprinted forms so existing deployments aren't broken.
 */
export const alertRules = pgTable(
  "alert_rules",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    name: varchar("name", { length: 192 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    conditions: json("conditions").notNull(),
    window: alertWindowEnum("window").notNull().default("24h"),
    cooldownMinutes: integer("cooldownMinutes").notNull().default(30),
    severity: alertSeverityEnum("severity").notNull().default("medium"),
    channels: json("channels").notNull(),
    lastFiredAt: timestamp("lastFiredAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    enabledIdx: index().on(table.enabled),
  }),
);
export type AlertRuleRow = typeof alertRules.$inferSelect;
export type InsertAlertRuleRow = typeof alertRules.$inferInsert;

/**
 * Append-only event log of fired alerts. One row per dispatch attempt
 * (success or failure). Used to debug "why didn't this fire?" cases and
 * to populate the dashboard's alert-history table.
 */
export const alertEvents = pgTable(
  "alert_events",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    ruleId: integer("ruleId").notNull(),
    severity: alertSeverityEnum("severity").notNull(),
    summary: varchar("summary", { length: 512 }).notNull(),
    matched: json("matched").notNull(),
    snapshots: json("snapshots").notNull(),
    /** "discord" | "pagerduty" | "webhook" */
    channel: varchar("channel", { length: 32 }).notNull(),
    delivered: boolean("delivered").notNull().default(false),
    statusCode: integer("statusCode"),
    errorMessage: varchar("errorMessage", { length: 512 }),
    firedAt: timestamp("firedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    ruleIdIdx: index().on(table.ruleId),
    firedAtIdx: index().on(table.firedAt),
  }),
);
export type AlertEventRow = typeof alertEvents.$inferSelect;
export type InsertAlertEventRow = typeof alertEvents.$inferInsert;

/* ─── SSO providers (Sprint 6 / Domain 5) ──────────────────────────────── */

/**
 * Single sign-on provider configuration. One row per IdP per workspace
 * (workspace scoping is added in Sprint 6 / Domain 6 — for now `userId`
 * pins the provider to the admin who configured it).
 *
 * Stored config per kind:
 *  - kind="oidc":  { issuer, clientId, clientSecret (encrypted), scopes }
 *  - kind="saml":  { entryPoint, issuer, certificate (PEM), audience,
 *                    nameIdFormat, signRequests }
 *
 * The "enabled" flag is what gates whether /auth/sso/{id}/login redirects
 * are accepted — a half-finished provider can sit in the table without
 * unlocking real login.
 */
export const ssoProviders = pgTable(
  "sso_providers",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    name: varchar("name", { length: 192 }).notNull(),
    kind: ssoKindEnum("kind").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    /** JSON-encoded provider-kind-specific config (see comment above). */
    config: json("config").notNull(),
    /**
     * Optional regex/email-domain match used to auto-route users to this
     * provider on the login page. e.g. "@acme\\.com$".
     */
    emailDomain: varchar("emailDomain", { length: 256 }),
    /** Default role for JIT-provisioned users from this IdP. */
    defaultRole: ssoDefaultRoleEnum("defaultRole").notNull().default("viewer"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    kindIdx: index().on(table.kind),
    enabledIdx: index().on(table.enabled),
  }),
);
export type SsoProviderRow = typeof ssoProviders.$inferSelect;
export type InsertSsoProviderRow = typeof ssoProviders.$inferInsert;

/**
 * Pending login attempt — needed for OIDC PKCE state and SAML RelayState
 * round-trips. Rows are short-lived (5 min TTL) and consumed exactly once
 * by the callback endpoint.
 */
export const ssoLoginRequests = pgTable(
  "sso_login_requests",
  {
    id: serial("id").primaryKey(),
    state: varchar("state", { length: 128 }).notNull().unique(),
    providerId: integer("providerId").notNull(),
    /** OIDC: PKCE code_verifier; SAML: the AuthnRequest ID we issued. */
    codeVerifier: varchar("codeVerifier", { length: 256 }),
    nonce: varchar("nonce", { length: 128 }),
    redirectTo: varchar("redirectTo", { length: 512 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
  },
  (table) => ({
    stateIdx: index().on(table.state),
    expiresAtIdx: index().on(table.expiresAt),
  }),
);
export type SsoLoginRequestRow = typeof ssoLoginRequests.$inferSelect;
export type InsertSsoLoginRequestRow = typeof ssoLoginRequests.$inferInsert;

/* ─── Workspaces + RBAC (Sprint 6 / Domain 6) ──────────────────────────── */

/**
 * A workspace is the unit of multi-tenant isolation. Every user has a
 * personal default workspace created at signup (so existing single-user
 * setups continue to work unmodified). Paid customers can create
 * additional workspaces and invite teammates with role-scoped access.
 *
 * The "slug" is human-readable and globally unique; we URL-route to it
 * (/w/<slug>/dashboard) so multi-workspace users can bookmark per-org
 * views.
 */
export const workspaces = pgTable(
  "workspaces",
  {
    id: serial("id").primaryKey(),
    /** URL slug, e.g. "acme-prod". 3-64 chars, [a-z0-9-]. */
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 192 }).notNull(),
    /** User who created the workspace. Auto-granted "owner" membership. */
    ownerUserId: integer("ownerUserId").notNull(),
    /** True for the auto-created per-user workspace; cannot be deleted. */
    isPersonal: boolean("isPersonal").notNull().default(false),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => ({
    ownerIdx: index().on(table.ownerUserId),
    slugIdx: index().on(table.slug),
  }),
);
export type WorkspaceRow = typeof workspaces.$inferSelect;
export type InsertWorkspaceRow = typeof workspaces.$inferInsert;

/** Durable GitHub App installation to workspace mapping. */
export const githubInstallations = pgTable(
  "github_installations",
  {
    id: serial("id").primaryKey(),
    installationId: integer("installationId").notNull().unique(),
    workspaceId: integer("workspaceId").notNull(),
    accountLogin: varchar("accountLogin", { length: 255 }).notNull(),
    accountType: varchar("accountType", { length: 32 }).notNull(),
    permissions: json("permissions").$type<Record<string, unknown>>().notNull().default({}),
    linkedAt: timestamp("linkedAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({ workspaceIdx: index().on(table.workspaceId) }),
);

/**
 * Membership join — one row per (workspace, user) pair. Roles use a
 * strict 4-level hierarchy:
 *
 *   owner   — everything; cannot be removed; transferable
 *   admin   — manage members, billing, settings; everything else
 *   editor  — create/update/delete tenant data; cannot invite
 *   viewer  — read-only
 *
 * The "active" flag lets us soft-suspend a member without losing their
 * audit history; "invitedBy" is who sent the invite (or NULL for the
 * auto-membership on workspace creation).
 */
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspaceId").notNull(),
    userId: integer("userId").notNull(),
    role: workspaceMemberRoleEnum("role").notNull().default("viewer"),
    active: boolean("active").notNull().default(true),
    invitedBy: integer("invitedBy"),
    invitedAt: timestamp("invitedAt"),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  },
  (table) => ({
    workspaceUserUniq: index().on(table.workspaceId, table.userId),
    userIdIdx: index().on(table.userId),
  }),
);
export type WorkspaceMemberRow = typeof workspaceMembers.$inferSelect;
export type InsertWorkspaceMemberRow = typeof workspaceMembers.$inferInsert;

/**
 * Pending workspace invitations. Sent by email; consumed by an
 * accept-token URL. Rows are deleted on accept/decline/expire.
 */
export const workspaceInvitations = pgTable(
  "workspace_invitations",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspaceId").notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    role: workspaceInvitationRoleEnum("role").notNull().default("viewer"),
    token: varchar("token", { length: 128 }).notNull().unique(),
    invitedBy: integer("invitedBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
  },
  (table) => ({
    workspaceIdIdx: index().on(table.workspaceId),
    emailIdx: index().on(table.email),
    tokenIdx: index().on(table.token),
  }),
);
export type WorkspaceInvitationRow = typeof workspaceInvitations.$inferSelect;
export type InsertWorkspaceInvitationRow = typeof workspaceInvitations.$inferInsert;

/**
 * Import History — persisted log of all competitor data imports.
 * Replaces the in-memory array in server/api/import.ts.
 */
export const importHistory = pgTable(
  "import_history",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("userId").notNull(),
    source: varchar("source", { length: 32 }).notNull(),
    recordsImported: integer("recordsImported").default(0).notNull(),
    recordsSkipped: integer("recordsSkipped").default(0).notNull(),
    collectionsCreated: integer("collectionsCreated").default(0).notNull(),
    errors: json("errors"),
    result: json("result"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    sourceIdx: index().on(table.source),
    createdAtIdx: index().on(table.createdAt),
  }),
);
export type ImportHistoryRow = typeof importHistory.$inferSelect;
export type InsertImportHistoryRow = typeof importHistory.$inferInsert;

/**
 * AI Events — persisted telemetry from the Rakshex SDK.
 * One row per LLM call (prompt/response/tool-call/cost/latency).
 * Columnar-friendly indexes for dashboard aggregation queries.
 */
export const aiEvents = pgTable(
  "ai_events",
  {
    id: serial("id").primaryKey(),
    eventId: varchar("eventId", { length: 36 }).notNull().unique(),
    userId: integer("userId").notNull(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    agentId: varchar("agentId", { length: 64 }).notNull(),
    userHash: varchar("userHash", { length: 128 }),
    provider: varchar("provider", { length: 32 }).notNull(),
    model: varchar("model", { length: 128 }).notNull(),
    requestTimestamp: timestamp("requestTimestamp").notNull(),
    latencyMs: integer("latencyMs").notNull(),
    inputTokens: integer("inputTokens").default(0).notNull(),
    outputTokens: integer("outputTokens").default(0).notNull(),
    cachedTokens: integer("cachedTokens").default(0).notNull(),
    costUsd: decimal("costUsd", { precision: 10, scale: 6 }).default("0").notNull(),
    status: aiEventStatusEnum("status").notNull().default("ok"),
    redactionCount: integer("redactionCount").default(0).notNull(),
    promptHash: varchar("promptHash", { length: 64 }).notNull(),
    responseHash: varchar("responseHash", { length: 64 }).notNull(),
    toolCalls: json("toolCalls"),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index().on(table.userId),
    workspaceIdIdx: index().on(table.workspaceId),
    agentIdIdx: index().on(table.agentId),
    createdAtIdx: index().on(table.createdAt),
    providerIdx: index().on(table.provider),
    modelIdx: index().on(table.model),
    statusIdx: index().on(table.status),
    requestTsIdx: index().on(table.requestTimestamp),
  }),
);
export type AiEventRow = typeof aiEvents.$inferSelect;
export type InsertAiEventRow = typeof aiEvents.$inferInsert;

/**
 * Security Events — append-only log of prompt injection / PII leak / policy
 * violation / anomaly events. Never stores raw prompts — only SHA-256 hash.
 */
export const securityEvents = pgTable(
  "security_events",
  {
    eventId: varchar("event_id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspace_id", { length: 64 }).notNull(),
    eventType: securityEventTypeEnum("event_type").notNull(),
    severity: securitySeverityEnum("severity").notNull(),
    threatLevel: varchar("threat_level", { length: 20 }).notNull(),
    detectedPatterns: json("detected_patterns").notNull(),
    promptHash: varchar("prompt_hash", { length: 64 }).notNull(),
    agentId: varchar("agent_id", { length: 64 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
    resolutionNote: text("resolution_note"),
  },
  (table) => ({
    workspaceIdIdx: index().on(table.workspaceId),
    createdAtIdx: index().on(table.createdAt),
    eventTypeIdx: index().on(table.eventType),
  }),
);
export type SecurityEventRow = typeof securityEvents.$inferSelect;
export type InsertSecurityEventRow = typeof securityEvents.$inferInsert;

/**
 * Waitlist — landing page email captures for beta access.
 */
export const waitlist = pgTable(
  "waitlist",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 320 }).notNull().unique(),
    plan: varchar("plan", { length: 64 }).default("Free").notNull(),
    source: varchar("source", { length: 64 }).default("landing_page").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    notifiedAt: timestamp("notified_at"),
  },
  (table) => ({
    emailIdx: index().on(table.email),
    createdAtIdx: index().on(table.createdAt),
  }),
);
export type WaitlistRow = typeof waitlist.$inferSelect;
export type InsertWaitlistRow = typeof waitlist.$inferInsert;

/**
 * Scan Reports — shareable public scan results
 */
export const scanReports = pgTable(
  "scan_reports",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    score: integer("score").notNull(),
    findings: json("findings").notNull().$type<
      Array<{
        title: string;
        severity: "Critical" | "High" | "Medium" | "Low";
        endpoint: string;
        description?: string;
        remediation?: string;
      }>
    >(),
    filename: varchar("filename", { length: 256 }),
    endpoints: json("endpoints").$type<string[]>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    viewCount: integer("view_count").default(0).notNull(),
  },
  (table) => ({
    createdAtIdx: index().on(table.createdAt),
  }),
);
export type ScanReport = typeof scanReports.$inferSelect;
export type InsertScanReport = typeof scanReports.$inferInsert;

// ─── Market-ready foundation tables (additive) ───────────────────────────
export * from "./schema-foundation";

// ─── Rakshex Enterprise Tables ───────────────────────────────────────────
export * from "./schema-enterprise";
