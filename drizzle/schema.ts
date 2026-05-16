import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  decimal,
  boolean,
  index,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 */
export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: mysqlEnum("role", ["user", "editor", "admin"]).default("user").notNull(),
    plan: mysqlEnum("plan", ["free", "pro", "enterprise"]).default("free").notNull(),
    passwordHash: varchar("passwordHash", { length: 512 }),
    apiKey: varchar("apiKey", { length: 64 }),
    scansRemaining: int("scansRemaining").default(10).notNull(),
    onboardingCompleted: boolean("onboardingCompleted").default(false).notNull(),
    failedLoginAttempts: int("failedLoginAttempts").default(0).notNull(),
    lockedUntil: timestamp("lockedUntil"),
    totpSecret: varchar("totpSecret", { length: 64 }),
    pendingTotpSecret: varchar("pendingTotpSecret", { length: 64 }),
    pendingTotpExpiresAt: timestamp("pendingTotpExpiresAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("email_idx").on(table.email),
    apiKeyIdx: index("apiKey_idx").on(table.apiKey),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * VS Code extension activity tracking.
 */
export const vscodeActivities = mysqlTable(
  "vscode_activities",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull(),
    type: varchar("type", { length: 32 }).notNull(),
    data: json("data"),
    timestamp: timestamp("timestamp").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    timestampIdx: index("timestamp_idx").on(table.timestamp),
  }),
);

export type VscodeActivity = typeof vscodeActivities.$inferSelect;
export type InsertVscodeActivity = typeof vscodeActivities.$inferInsert;

/**
 * API Collections - stores imported Postman/OpenAPI collections
 */
export const collections = mysqlTable(
  "collections",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    format: mysqlEnum("format", ["postman", "openapi"]).notNull(),
    data: json("data").notNull(), // Store full collection JSON
    totalRequests: int("totalRequests").default(0).notNull(),
    githubRepo: varchar("githubRepo", { length: 255 }), // Link to GitHub repo (owner/repo format)
    lastScannedAt: timestamp("lastScannedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    githubRepoIdx: index("githubRepo_idx").on(table.githubRepo),
  }),
);

export type Collection = typeof collections.$inferSelect;
export type InsertCollection = typeof collections.$inferInsert;

/**
 * Security Scans - stores scan history and results
 */
export const scans = mysqlTable(
  "scans",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull(),
    collectionId: varchar("collectionId", { length: 64 }).notNull(),
    scanType: mysqlEnum("scanType", ["full", "quick", "shadow_api", "prompt_injection"]).notNull(),
    status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).notNull(),
    riskScore: decimal("riskScore", { precision: 5, scale: 2 }).default("0"),
    riskLevel: mysqlEnum("riskLevel", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]).notNull(),
    totalFindings: int("totalFindings").default(0).notNull(),
    findingsData: json("findingsData"), // Store findings summary
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    collectionIdIdx: index("collectionId_idx").on(table.collectionId),
  }),
);

export type Scan = typeof scans.$inferSelect;
export type InsertScan = typeof scans.$inferInsert;

/**
 * Security Findings - individual vulnerabilities found in scans
 */
export const findings = mysqlTable(
  "findings",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    scanId: varchar("scanId", { length: 64 }).notNull(),
    collectionId: varchar("collectionId", { length: 64 }).notNull(),
    userId: int("userId").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    severity: mysqlEnum("severity", ["Critical", "High", "Medium", "Low"]).notNull(),
    category: varchar("category", { length: 255 }),
    remediation: text("remediation"),
    status: mysqlEnum("status", ["open", "in-progress", "resolved"]).default("open").notNull(),
    cweId: varchar("cweId", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    scanIdIdx: index("scanId_idx").on(table.scanId),
    collectionIdIdx: index("collectionId_idx").on(table.collectionId),
    userIdIdx: index("userId_idx").on(table.userId),
  }),
);

export type Finding = typeof findings.$inferSelect;
export type InsertFinding = typeof findings.$inferInsert;

/**
 * Shadow APIs - undocumented endpoints detected in collections
 */
export const shadowAPIs = mysqlTable(
  "shadow_apis",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    scanId: varchar("scanId", { length: 64 }).notNull(),
    collectionId: varchar("collectionId", { length: 64 }).notNull(),
    userId: int("userId").notNull(),
    endpoint: varchar("endpoint", { length: 255 }).notNull(),
    method: varchar("method", { length: 16 }),
    file: varchar("file", { length: 255 }),
    line: int("line"),
    riskLevel: mysqlEnum("riskLevel", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]).notNull(),
    reason: text("reason"),
    recommendation: text("recommendation"),
    isDocumented: boolean("isDocumented").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    scanIdIdx: index("scanId_idx").on(table.scanId),
    collectionIdIdx: index("collectionId_idx").on(table.collectionId),
    userIdIdx: index("userId_idx").on(table.userId),
  }),
);

export type ShadowAPI = typeof shadowAPIs.$inferSelect;
export type InsertShadowAPI = typeof shadowAPIs.$inferInsert;

/**
 * LLM Token Usage - tracks token consumption per model
 */
export const tokenUsage = mysqlTable(
  "token_usage",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull(),
    model: varchar("model", { length: 128 }).notNull(),
    promptTokens: int("promptTokens").default(0).notNull(),
    completionTokens: int("completionTokens").default(0).notNull(),
    thinkingTokens: int("thinkingTokens").default(0).notNull(),
    totalTokens: int("totalTokens").default(0).notNull(),
    costUSD: decimal("costUSD", { precision: 10, scale: 6 }).default("0"),
    date: timestamp("date").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    modelIdx: index("model_idx").on(table.model),
    dateIdx: index("date_idx").on(table.date),
  }),
);

export type TokenUsage = typeof tokenUsage.$inferSelect;
export type InsertTokenUsage = typeof tokenUsage.$inferInsert;

/**
 * Kill Switch Events - audit trail for kill switch triggers and budget management
 */
export const killSwitchEvents = mysqlTable(
  "kill_switch_events",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull(),
    eventType: mysqlEnum("eventType", [
      "budget_set",
      "triggered",
      "auto_triggered",
      "reset",
    ]).notNull(),
    budgetLimit: decimal("budgetLimit", { precision: 10, scale: 2 }),
    currentSpend: decimal("currentSpend", { precision: 10, scale: 2 }),
    reason: text("reason"),
    details: json("details"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
  }),
);

export type KillSwitchEvent = typeof killSwitchEvents.$inferSelect;
export type InsertKillSwitchEvent = typeof killSwitchEvents.$inferInsert;

/**
 * Kill Switch Settings - current budget and status per user
 */
export const killSwitchSettings = mysqlTable(
  "kill_switch_settings",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull().unique(),
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
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
  }),
);

export type KillSwitchSettings = typeof killSwitchSettings.$inferSelect;
export type InsertKillSwitchSettings = typeof killSwitchSettings.$inferInsert;

/**
 * Compliance Reports - PCI DSS compliance assessment results
 */
export const complianceReports = mysqlTable(
  "compliance_reports",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull(),
    collectionId: varchar("collectionId", { length: 64 }).notNull(),
    reportType: mysqlEnum("reportType", ["pci_dss", "owasp", "custom"]).notNull(),
    complianceScore: decimal("complianceScore", {
      precision: 5,
      scale: 2,
    }).notNull(),
    totalRequirements: int("totalRequirements").notNull(),
    metRequirements: int("metRequirements").notNull(),
    requirementsData: json("requirementsData"), // Detailed requirement breakdown
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt"),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    collectionIdIdx: index("collectionId_idx").on(table.collectionId),
  }),
);

export type ComplianceReport = typeof complianceReports.$inferSelect;
export type InsertComplianceReport = typeof complianceReports.$inferInsert;

/**
 * Team Members - users invited to collaborate on workspace
 */
export const teamMembers = mysqlTable(
  "team_members",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull(), // Owner/inviter
    memberEmail: varchar("memberEmail", { length: 320 }).notNull(),
    memberUserId: int("memberUserId"), // Set when member accepts invitation
    role: mysqlEnum("role", ["admin", "editor", "viewer"]).default("viewer").notNull(),
    status: mysqlEnum("status", ["pending", "accepted", "rejected"]).default("pending").notNull(),
    invitedAt: timestamp("invitedAt").defaultNow().notNull(),
    acceptedAt: timestamp("acceptedAt"),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    memberEmailIdx: index("memberEmail_idx").on(table.memberEmail),
  }),
);

export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertTeamMember = typeof teamMembers.$inferInsert;

/**
 * Onboarding Progress - tracks user progress through onboarding wizard
 */
export const onboardingProgress = mysqlTable(
  "onboarding_progress",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull().unique(),
    currentStep: int("currentStep").default(1).notNull(), // 1-5
    importCollectionCompleted: boolean("importCollectionCompleted").default(false).notNull(),
    runScanCompleted: boolean("runScanCompleted").default(false).notNull(),
    reviewFindingsCompleted: boolean("reviewFindingsCompleted").default(false).notNull(),
    inviteTeamCompleted: boolean("inviteTeamCompleted").default(false).notNull(),
    setupComplianceCompleted: boolean("setupComplianceCompleted").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
  }),
);

export type OnboardingProgress = typeof onboardingProgress.$inferSelect;
export type InsertOnboardingProgress = typeof onboardingProgress.$inferInsert;

/**
 * Subscriptions - Razorpay subscription management
 */
export const subscriptions = mysqlTable(
  "subscriptions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull().unique(),
    plan: mysqlEnum("plan", ["free", "pro", "enterprise"]).default("free").notNull(),
    razorpaySubscriptionId: varchar("razorpaySubscriptionId", {
      length: 255,
    }).unique(),
    razorpayCustomerId: varchar("razorpayCustomerId", { length: 255 }),
    status: mysqlEnum("status", ["active", "paused", "cancelled", "past_due", "pending", "halted"])
      .default("pending")
      .notNull(),
    currentPeriodStart: timestamp("currentPeriodStart"),
    currentPeriodEnd: timestamp("currentPeriodEnd"),
    cancelledAt: timestamp("cancelledAt"),
    cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    razorpaySubscriptionIdIdx: index("razorpaySubscriptionId_idx").on(table.razorpaySubscriptionId),
    statusIdx: index("status_idx").on(table.status),
    currentPeriodEndIdx: index("currentPeriodEnd_idx").on(table.currentPeriodEnd),
  }),
);

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * Payments - Razorpay payment records and invoices
 */
export const payments = mysqlTable(
  "payments",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull(),
    subscriptionId: varchar("subscriptionId", { length: 64 }),
    razorpayPaymentId: varchar("razorpayPaymentId", { length: 255 }).notNull().unique(),
    razorpayOrderId: varchar("razorpayOrderId", { length: 255 }),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("INR").notNull(),
    status: mysqlEnum("status", [
      "created",
      "authorized",
      "captured",
      "failed",
      "refunded",
      "partially_refunded",
    ])
      .default("created")
      .notNull(),
    receipt: varchar("receipt", { length: 255 }),
    description: text("description"),
    metadata: json("metadata"),
    refundAmount: decimal("refundAmount", { precision: 10, scale: 2 }).default("0"),
    refundStatus: mysqlEnum("refundStatus", ["null", "partial", "full"]).default("null"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    subscriptionIdIdx: index("subscriptionId_idx").on(table.subscriptionId),
    razorpayPaymentIdIdx: index("razorpayPaymentId_idx").on(table.razorpayPaymentId),
    statusIdx: index("status_idx").on(table.status),
    createdAtIdx: index("createdAt_idx").on(table.createdAt),
  }),
);

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

/**
 * Password Reset Tokens - secure tokens for password reset flow
 */
export const passwordResetTokens = mysqlTable(
  "password_reset_tokens",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull(),
    token: varchar("token", { length: 255 }).notNull().unique(),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    tokenIdx: index("token_idx").on(table.token),
    expiresAtIdx: index("expiresAt_idx").on(table.expiresAt),
  }),
);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

/**
 * User Sessions - track active sessions for session management
 */
export const userSessions = mysqlTable(
  "user_sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull(),
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
    userIdIdx: index("userId_idx").on(table.userId),
    sessionTokenIdx: index("sessionToken_idx").on(table.sessionToken),
    expiresAtIdx: index("expiresAt_idx").on(table.expiresAt),
    refreshTokenHashIdx: index("refreshTokenHash_idx").on(table.refreshTokenHash),
  }),
);

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = typeof userSessions.$inferInsert;

/**
 * Email Preferences - user notification settings
 */
export const emailPreferences = mysqlTable(
  "email_preferences",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull().unique(),
    unsubscribeToken: varchar("unsubscribeToken", { length: 64 }).unique(),
    scanComplete: boolean("scanComplete").default(true).notNull(),
    budgetAlerts: boolean("budgetAlerts").default(true).notNull(),
    weeklyDigest: boolean("weeklyDigest").default(true).notNull(),
    teamActivity: boolean("teamActivity").default(true).notNull(),
    promotionalEmails: boolean("promotionalEmails").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
  }),
);

export type EmailPreference = typeof emailPreferences.$inferSelect;
export type InsertEmailPreference = typeof emailPreferences.$inferInsert;

/**
 * Audit Log - track important user actions for security
 */
export const auditLog = mysqlTable(
  "audit_log",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull(),
    action: varchar("action", { length: 128 }).notNull(), // password_changed, email_changed, account_deleted, etc.
    details: json("details"),
    ipAddress: varchar("ipAddress", { length: 45 }),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    actionIdx: index("action_idx").on(table.action),
    createdAtIdx: index("createdAt_idx").on(table.createdAt),
  }),
);

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

/**
 * Lifecycle Webhooks - user-registered HTTP endpoints that DevPulse calls
 * when events fire (scan.complete, finding.discovered, quota.warning,
 * kill_switch.triggered). Generalises what the hard-coded Slack integration
 * already does. Each delivery is signed with an HMAC-SHA256 digest of the
 * body using the per-endpoint `secret`, same shape Razorpay / Stripe use.
 */
export const webhookEndpoints = mysqlTable(
  "webhook_endpoints",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull(),
    url: varchar("url", { length: 1024 }).notNull(),
    // 32-byte random secret, base64-encoded (length 44). Never exposed
    // after creation except in masked form.
    secret: varchar("secret", { length: 128 }).notNull(),
    // Array of event names this endpoint subscribes to. JSON for easy
    // multi-event subscription without a join table.
    events: json("events").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    lastDeliveryAt: timestamp("lastDeliveryAt"),
    lastStatus: int("lastStatus"),
    // Incremented each failed delivery, reset on success. We auto-disable
    // an endpoint once this reaches 20 (~a day of retries) to avoid
    // hammering dead receivers.
    consecutiveFailures: int("consecutiveFailures").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
  }),
);

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type InsertWebhookEndpoint = typeof webhookEndpoints.$inferInsert;

/**
 * Webhook Deliveries - audit trail of every webhook fire. Kept in-table
 * (rather than just logs) so users can inspect history and retry failed
 * ones from the dashboard.
 */
export const webhookDeliveries = mysqlTable(
  "webhook_deliveries",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    webhookId: varchar("webhookId", { length: 64 }).notNull(),
    event: varchar("event", { length: 64 }).notNull(),
    payload: json("payload").notNull(),
    status: int("status"),
    responseBody: text("responseBody"),
    errorMessage: text("errorMessage"),
    deliveredAt: timestamp("deliveredAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    webhookIdIdx: index("webhookId_idx").on(table.webhookId),
    createdAtIdx: index("createdAt_idx").on(table.createdAt),
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
export const processedWebhookEvents = mysqlTable(
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
    providerEventIdx: index("provider_event_idx").on(table.provider, table.eventId),
  }),
);

export type ProcessedWebhookEvent = typeof processedWebhookEvents.$inferSelect;
export type InsertProcessedWebhookEvent = typeof processedWebhookEvents.$inferInsert;

/**
 * MCP Server registry — Sprint 2 scaffolding for "MCP Governance".
 *
 * An MCP server (Model Context Protocol) is a process that exposes one or
 * more *tools* an LLM agent can call. DevPulse models the registry, the
 * permission graph (which user/agent may call which tool on which server),
 * and an immutable audit log of every tool invocation routed through the
 * gateway. The actual MCP transport (stdio / streamable-http / sse) is
 * pluggable; the schema below is transport-agnostic.
 */
export const mcpServers = mysqlTable(
  "mcp_servers",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    url: varchar("url", { length: 1024 }),
    transport: mysqlEnum("transport", ["stdio", "streamable-http", "sse"]).notNull(),
    /**
     * Capability fingerprint — JSON snapshot of the tool list the server
     * advertised at last discovery, used to detect drift / capability
     * additions that may need re-review.
     */
    capabilityFingerprint: json("capabilityFingerprint"),
    riskScore: int("riskScore").default(0).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    discoveredAt: timestamp("discoveredAt").defaultNow().notNull(),
    lastSeenAt: timestamp("lastSeenAt"),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
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
export const mcpTools = mysqlTable(
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
    riskClass: mysqlEnum("riskClass", ["safe", "elevated", "unsafe", "unknown"])
      .default("unknown")
      .notNull(),
    /** Schema for input parameters (JSON Schema). */
    inputSchema: json("inputSchema"),
    isApproved: boolean("isApproved").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    serverIdIdx: index("serverId_idx").on(table.serverId),
  }),
);

export type McpTool = typeof mcpTools.$inferSelect;
export type InsertMcpTool = typeof mcpTools.$inferInsert;

/**
 * MCP Tool Invocation Log — append-only audit trail of every tool call
 * routed through the DevPulse gateway. Source of truth for the "permission
 * graph" view (who used what when), abuse detection, and compliance
 * evidence.
 *
 * NOTE: we log a SHA-256 fingerprint of the `arguments` payload by default,
 * never the raw arguments. The dashboard only fetches raw args on demand
 * and only for users with the `mcp:audit:read-raw` permission.
 */
export const mcpInvocationLog = mysqlTable(
  "mcp_invocation_log",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull(),
    serverId: varchar("serverId", { length: 64 }).notNull(),
    toolId: varchar("toolId", { length: 64 }).notNull(),
    /** Gateway request id. Joins back to gateway audit records. */
    requestId: varchar("requestId", { length: 64 }),
    /** SHA-256 fingerprint of input args, base16. */
    argsFingerprint: varchar("argsFingerprint", { length: 64 }),
    decision: mysqlEnum("decision", ["allowed", "blocked", "errored"]).notNull(),
    blockReason: varchar("blockReason", { length: 128 }),
    durationMs: int("durationMs"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    serverIdIdx: index("serverId_idx").on(table.serverId),
    toolIdIdx: index("toolId_idx").on(table.toolId),
    createdAtIdx: index("createdAt_idx").on(table.createdAt),
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
export const gatewayAudit = mysqlTable(
  "gateway_audit",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    requestId: varchar("requestId", { length: 64 }).notNull(),
    model: varchar("model", { length: 96 }).notNull(),
    provider: varchar("provider", { length: 32 }),
    decision: mysqlEnum("decision", ["allowed", "blocked", "errored"]).notNull().default("allowed"),
    blockReason: varchar("blockReason", { length: 96 }),
    promptTokens: int("promptTokens").default(0).notNull(),
    completionTokens: int("completionTokens").default(0).notNull(),
    totalTokens: int("totalTokens").default(0).notNull(),
    estimatedCostUsd: decimal("estimatedCostUsd", { precision: 10, scale: 6 })
      .default("0")
      .notNull(),
    promptFingerprint: varchar("promptFingerprint", { length: 64 }),
    latencyMs: int("latencyMs"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    createdAtIdx: index("createdAt_idx").on(table.createdAt),
    decisionIdx: index("decision_idx").on(table.decision),
    modelIdx: index("model_idx").on(table.model),
  }),
);
export type GatewayAuditRow = typeof gatewayAudit.$inferSelect;
export type InsertGatewayAuditRow = typeof gatewayAudit.$inferInsert;

/**
 * Per-tenant daily token caps. The gateway consults these inline to enforce
 * hard / soft budgets without polling the cost meter on every request.
 */
export const tokenBudgets = mysqlTable("token_budgets", {
  userId: int("userId").primaryKey(),
  dailyTokenLimit: int("dailyTokenLimit"),
  mode: mysqlEnum("mode", ["soft", "hard"]).default("soft").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TokenBudgetRow = typeof tokenBudgets.$inferSelect;
export type InsertTokenBudgetRow = typeof tokenBudgets.$inferInsert;

/**
 * Shadow-AI events — observations of LLM traffic from sources OTHER than the
 * sanctioned gateway. Fed by log ingestion, network taps, or agent telemetry.
 * Events flagged "rogue" are surfaced in the dashboard.
 */
export const shadowAiEvents = mysqlTable(
  "shadow_ai_events",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    source: varchar("source", { length: 64 }).notNull(),
    detectedHost: varchar("detectedHost", { length: 192 }).notNull(),
    detectedModel: varchar("detectedModel", { length: 96 }),
    isAllowlisted: boolean("isAllowlisted").default(false).notNull(),
    severity: mysqlEnum("severity", ["info", "low", "medium", "high", "critical"])
      .default("medium")
      .notNull(),
    rawSignals: json("rawSignals"),
    occurredAt: timestamp("occurredAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    severityIdx: index("severity_idx").on(table.severity),
    detectedHostIdx: index("detectedHost_idx").on(table.detectedHost),
  }),
);
export type ShadowAiEventRow = typeof shadowAiEvents.$inferSelect;
export type InsertShadowAiEventRow = typeof shadowAiEvents.$inferInsert;

/**
 * Allowlist / denylist of LLM hosts and models per tenant. Gates the
 * shadow-AI classifier — if a host isn't here, it's considered "shadow."
 */
export const aiAllowlist = mysqlTable(
  "ai_allowlist",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    /** "host" — match by hostname; "model" — match by model id. */
    kind: mysqlEnum("kind", ["host", "model"]).notNull(),
    pattern: varchar("pattern", { length: 192 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
  }),
);
export type AiAllowlistRow = typeof aiAllowlist.$inferSelect;
export type InsertAiAllowlistRow = typeof aiAllowlist.$inferInsert;

/**
 * Continuous red-team runs — one row per scheduled (or manually triggered)
 * attack simulation against the customer's LLM gateway endpoint. Stores
 * aggregate scores; per-payload outcomes go in `redteamFindings`.
 */
export const redteamRuns = mysqlTable(
  "redteam_runs",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull(),
    target: varchar("target", { length: 192 }).notNull(),
    triggeredBy: mysqlEnum("triggeredBy", ["manual", "schedule", "api"])
      .default("manual")
      .notNull(),
    status: mysqlEnum("status", ["pending", "running", "completed", "failed"])
      .default("pending")
      .notNull(),
    totalPayloads: int("totalPayloads").default(0).notNull(),
    blockedCount: int("blockedCount").default(0).notNull(),
    leakedCount: int("leakedCount").default(0).notNull(),
    erroredCount: int("erroredCount").default(0).notNull(),
    /** Out of 100. */
    securityScore: int("securityScore"),
    durationMs: int("durationMs"),
    startedAt: timestamp("startedAt"),
    finishedAt: timestamp("finishedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    statusIdx: index("status_idx").on(table.status),
    createdAtIdx: index("createdAt_idx").on(table.createdAt),
  }),
);
export type RedteamRunRow = typeof redteamRuns.$inferSelect;
export type InsertRedteamRunRow = typeof redteamRuns.$inferInsert;

export const redteamFindings = mysqlTable(
  "redteam_findings",
  {
    id: int("id").autoincrement().primaryKey(),
    runId: varchar("runId", { length: 64 }).notNull(),
    payloadId: varchar("payloadId", { length: 64 }).notNull(),
    category: varchar("category", { length: 64 }).notNull(),
    severity: mysqlEnum("severity", ["Low", "Medium", "High", "Critical"]).notNull(),
    outcome: mysqlEnum("outcome", ["blocked", "leaked", "errored"]).notNull(),
    /** First 200 chars of the response, sanitized. */
    sample: text("sample"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    runIdIdx: index("runId_idx").on(table.runId),
    outcomeIdx: index("outcome_idx").on(table.outcome),
  }),
);
export type RedteamFindingRow = typeof redteamFindings.$inferSelect;
export type InsertRedteamFindingRow = typeof redteamFindings.$inferInsert;

/**
 * Continuous red-team schedule entries. Fanned out by the cron loop.
 */
export const redteamSchedules = mysqlTable(
  "redteam_schedules",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    target: varchar("target", { length: 192 }).notNull(),
    /** Cron expression (UTC). */
    cron: varchar("cron", { length: 64 }).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    lastRunAt: timestamp("lastRunAt"),
    nextRunAt: timestamp("nextRunAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    activeIdx: index("active_idx").on(table.isActive),
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
export const autofixSuggestions = mysqlTable(
  "autofix_suggestions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    findingType: varchar("findingType", { length: 64 }).notNull(),
    findingRef: varchar("findingRef", { length: 128 }),
    title: varchar("title", { length: 192 }).notNull(),
    rationale: text("rationale"),
    languageHint: varchar("languageHint", { length: 32 }),
    snippet: text("snippet").notNull(),
    status: mysqlEnum("status", ["open", "applied", "dismissed"]).default("open").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    statusIdx: index("status_idx").on(table.status),
    findingTypeIdx: index("findingType_idx").on(table.findingType),
  }),
);
export type AutofixSuggestionRow = typeof autofixSuggestions.$inferSelect;
export type InsertAutofixSuggestionRow = typeof autofixSuggestions.$inferInsert;

/**
 * Security copilot conversations — chat-over-data sessions where the user
 * asks questions about their own runtime data. The conversations are
 * scoped to the user; the retrieval layer never crosses tenants.
 */
export const copilotConversations = mysqlTable(
  "copilot_conversations",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull(),
    title: varchar("title", { length: 192 }).notNull().default("New chat"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
  }),
);
export type CopilotConversationRow = typeof copilotConversations.$inferSelect;
export type InsertCopilotConversationRow = typeof copilotConversations.$inferInsert;

export const copilotMessages = mysqlTable(
  "copilot_messages",
  {
    id: int("id").autoincrement().primaryKey(),
    conversationId: varchar("conversationId", { length: 64 }).notNull(),
    role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
    content: text("content").notNull(),
    /** JSON-encoded list of references (table+rowId pairs). */
    references: json("references"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    conversationIdx: index("conversation_idx").on(table.conversationId),
  }),
);
export type CopilotMessageRow = typeof copilotMessages.$inferSelect;
export type InsertCopilotMessageRow = typeof copilotMessages.$inferInsert;

/**
 * YAML policy documents authored by a tenant. The compiled JSON is cached
 * alongside the source so the gateway can apply policies without re-parsing.
 */
export const tenantPolicies = mysqlTable(
  "tenant_policies",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    name: varchar("name", { length: 192 }).notNull(),
    yaml: text("yaml").notNull(),
    compiled: json("compiled").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    appliesTo: varchar("appliesTo", { length: 256 }).notNull().default("all"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    appliesToIdx: index("appliesTo_idx").on(table.appliesTo),
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
export const alertRules = mysqlTable(
  "alert_rules",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    name: varchar("name", { length: 192 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    conditions: json("conditions").notNull(),
    window: mysqlEnum("window", ["1h", "24h", "7d"]).notNull().default("24h"),
    cooldownMinutes: int("cooldownMinutes").notNull().default(30),
    severity: mysqlEnum("severity", ["low", "medium", "high", "critical"])
      .notNull()
      .default("medium"),
    channels: json("channels").notNull(),
    lastFiredAt: timestamp("lastFiredAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    enabledIdx: index("enabled_idx").on(table.enabled),
  }),
);
export type AlertRuleRow = typeof alertRules.$inferSelect;
export type InsertAlertRuleRow = typeof alertRules.$inferInsert;

/**
 * Append-only event log of fired alerts. One row per dispatch attempt
 * (success or failure). Used to debug "why didn't this fire?" cases and
 * to populate the dashboard's alert-history table.
 */
export const alertEvents = mysqlTable(
  "alert_events",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    ruleId: int("ruleId").notNull(),
    severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).notNull(),
    summary: varchar("summary", { length: 512 }).notNull(),
    matched: json("matched").notNull(),
    snapshots: json("snapshots").notNull(),
    /** "discord" | "pagerduty" | "webhook" */
    channel: varchar("channel", { length: 32 }).notNull(),
    delivered: boolean("delivered").notNull().default(false),
    statusCode: int("statusCode"),
    errorMessage: varchar("errorMessage", { length: 512 }),
    firedAt: timestamp("firedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    ruleIdIdx: index("ruleId_idx").on(table.ruleId),
    firedAtIdx: index("firedAt_idx").on(table.firedAt),
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
export const ssoProviders = mysqlTable(
  "sso_providers",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    name: varchar("name", { length: 192 }).notNull(),
    kind: mysqlEnum("kind", ["oidc", "saml"]).notNull(),
    enabled: boolean("enabled").notNull().default(false),
    /** JSON-encoded provider-kind-specific config (see comment above). */
    config: json("config").notNull(),
    /**
     * Optional regex/email-domain match used to auto-route users to this
     * provider on the login page. e.g. "@acme\\.com$".
     */
    emailDomain: varchar("emailDomain", { length: 256 }),
    /** Default role for JIT-provisioned users from this IdP. */
    defaultRole: mysqlEnum("defaultRole", ["admin", "editor", "viewer"])
      .notNull()
      .default("viewer"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    kindIdx: index("kind_idx").on(table.kind),
    enabledIdx: index("enabled_idx").on(table.enabled),
  }),
);
export type SsoProviderRow = typeof ssoProviders.$inferSelect;
export type InsertSsoProviderRow = typeof ssoProviders.$inferInsert;

/**
 * Pending login attempt — needed for OIDC PKCE state and SAML RelayState
 * round-trips. Rows are short-lived (5 min TTL) and consumed exactly once
 * by the callback endpoint.
 */
export const ssoLoginRequests = mysqlTable(
  "sso_login_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    state: varchar("state", { length: 128 }).notNull().unique(),
    providerId: int("providerId").notNull(),
    /** OIDC: PKCE code_verifier; SAML: the AuthnRequest ID we issued. */
    codeVerifier: varchar("codeVerifier", { length: 256 }),
    nonce: varchar("nonce", { length: 128 }),
    redirectTo: varchar("redirectTo", { length: 512 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
  },
  (table) => ({
    stateIdx: index("state_idx").on(table.state),
    expiresAtIdx: index("expiresAt_idx").on(table.expiresAt),
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
export const workspaces = mysqlTable(
  "workspaces",
  {
    id: int("id").autoincrement().primaryKey(),
    /** URL slug, e.g. "acme-prod". 3-64 chars, [a-z0-9-]. */
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 192 }).notNull(),
    /** User who created the workspace. Auto-granted "owner" membership. */
    ownerUserId: int("ownerUserId").notNull(),
    /** True for the auto-created per-user workspace; cannot be deleted. */
    isPersonal: boolean("isPersonal").notNull().default(false),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    ownerIdx: index("ownerUserId_idx").on(table.ownerUserId),
    slugIdx: index("slug_idx").on(table.slug),
  }),
);
export type WorkspaceRow = typeof workspaces.$inferSelect;
export type InsertWorkspaceRow = typeof workspaces.$inferInsert;

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
export const workspaceMembers = mysqlTable(
  "workspace_members",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull(),
    userId: int("userId").notNull(),
    role: mysqlEnum("role", ["owner", "admin", "editor", "viewer"]).notNull().default("viewer"),
    active: boolean("active").notNull().default(true),
    invitedBy: int("invitedBy"),
    invitedAt: timestamp("invitedAt"),
    joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  },
  (table) => ({
    workspaceUserUniq: index("workspaceId_userId_idx").on(table.workspaceId, table.userId),
    userIdIdx: index("userId_idx").on(table.userId),
  }),
);
export type WorkspaceMemberRow = typeof workspaceMembers.$inferSelect;
export type InsertWorkspaceMemberRow = typeof workspaceMembers.$inferInsert;

/**
 * Pending workspace invitations. Sent by email; consumed by an
 * accept-token URL. Rows are deleted on accept/decline/expire.
 */
export const workspaceInvitations = mysqlTable(
  "workspace_invitations",
  {
    id: int("id").autoincrement().primaryKey(),
    workspaceId: int("workspaceId").notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    role: mysqlEnum("role", ["admin", "editor", "viewer"]).notNull().default("viewer"),
    token: varchar("token", { length: 128 }).notNull().unique(),
    invitedBy: int("invitedBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
  },
  (table) => ({
    workspaceIdIdx: index("workspaceId_idx").on(table.workspaceId),
    emailIdx: index("email_idx").on(table.email),
    tokenIdx: index("token_idx").on(table.token),
  }),
);
export type WorkspaceInvitationRow = typeof workspaceInvitations.$inferSelect;
export type InsertWorkspaceInvitationRow = typeof workspaceInvitations.$inferInsert;

/**
 * Import History — persisted log of all competitor data imports.
 * Replaces the in-memory array in server/api/import.ts.
 */
export const importHistory = mysqlTable(
  "import_history",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("userId").notNull(),
    source: varchar("source", { length: 32 }).notNull(),
    recordsImported: int("recordsImported").default(0).notNull(),
    recordsSkipped: int("recordsSkipped").default(0).notNull(),
    collectionsCreated: int("collectionsCreated").default(0).notNull(),
    errors: json("errors"),
    result: json("result"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    sourceIdx: index("source_idx").on(table.source),
    createdAtIdx: index("createdAt_idx").on(table.createdAt),
  }),
);
export type ImportHistoryRow = typeof importHistory.$inferSelect;
export type InsertImportHistoryRow = typeof importHistory.$inferInsert;

/**
 * AI Events — persisted telemetry from the DevPulse SDK.
 * One row per LLM call (prompt/response/tool-call/cost/latency).
 * Columnar-friendly indexes for dashboard aggregation queries.
 */
export const aiEvents = mysqlTable(
  "ai_events",
  {
    id: int("id").autoincrement().primaryKey(),
    eventId: varchar("eventId", { length: 36 }).notNull().unique(),
    userId: int("userId").notNull(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    agentId: varchar("agentId", { length: 64 }).notNull(),
    userHash: varchar("userHash", { length: 128 }),
    provider: varchar("provider", { length: 32 }).notNull(),
    model: varchar("model", { length: 128 }).notNull(),
    requestTimestamp: timestamp("requestTimestamp").notNull(),
    latencyMs: int("latencyMs").notNull(),
    inputTokens: int("inputTokens").default(0).notNull(),
    outputTokens: int("outputTokens").default(0).notNull(),
    cachedTokens: int("cachedTokens").default(0).notNull(),
    costUsd: decimal("costUsd", { precision: 10, scale: 6 }).default("0").notNull(),
    status: mysqlEnum("status", ["ok", "error", "timeout", "blocked"]).notNull().default("ok"),
    redactionCount: int("redactionCount").default(0).notNull(),
    promptHash: varchar("promptHash", { length: 64 }).notNull(),
    responseHash: varchar("responseHash", { length: 64 }).notNull(),
    toolCalls: json("toolCalls"),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("userId_idx").on(table.userId),
    workspaceIdIdx: index("workspaceId_idx").on(table.workspaceId),
    agentIdIdx: index("agentId_idx").on(table.agentId),
    createdAtIdx: index("createdAt_idx").on(table.createdAt),
    providerIdx: index("provider_idx").on(table.provider),
    modelIdx: index("model_idx").on(table.model),
    statusIdx: index("status_idx").on(table.status),
    requestTsIdx: index("requestTs_idx").on(table.requestTimestamp),
  }),
);
export type AiEventRow = typeof aiEvents.$inferSelect;
export type InsertAiEventRow = typeof aiEvents.$inferInsert;
