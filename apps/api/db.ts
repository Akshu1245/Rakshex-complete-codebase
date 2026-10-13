import crypto from "crypto";
import { eq, and, or, inArray, isNull, desc, gte, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/** Generate a cryptographically secure ID with a prefix — replaces Math.random() */
function secureId(prefix: string): string {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}
import {
  InsertUser,
  users,
  collections,
  scans,
  findings,
  shadowAPIs,
  tokenUsage,
  killSwitchEvents,
  killSwitchSettings,
  complianceReports,
  teamMembers,
  onboardingProgress,
  subscriptions,
  workspaceSubscriptions,
  payments,
  passwordResetTokens,
  userSessions,
  emailPreferences,
  auditLog,
  vscodeActivities,
  webhookEndpoints,
  webhookDeliveries,
  processedWebhookEvents,
  gatewayAudit,
  tokenBudgets,
  shadowAiEvents,
  aiAllowlist,
  redteamRuns,
  redteamFindings,
  redteamSchedules,
  autofixSuggestions,
  copilotConversations,
  copilotMessages,
  tenantPolicies,
  alertRules,
  alertEvents,
  ssoProviders,
  ssoLoginRequests,
  workspaces,
  githubInstallations,
  workspaceMembers,
  workspaceInvitations,
  mcpServers,
  mcpTools,
  mcpInvocationLog,
  importHistory,
  aiEvents,
  type AiEventRow,
  type InsertAiEventRow,
  type TenantPolicyRow,
  type InsertTenantPolicyRow,
  type AlertRuleRow,
  type InsertAlertRuleRow,
  type AlertEventRow,
  type InsertAlertEventRow,
  type SsoProviderRow,
  type InsertSsoProviderRow,
  type SsoLoginRequestRow,
  type InsertSsoLoginRequestRow,
  type WorkspaceRow,
  type InsertWorkspaceRow,
  type WorkspaceMemberRow,
  type InsertWorkspaceMemberRow,
  type WorkspaceInvitationRow,
  type InsertWorkspaceInvitationRow,
  type WorkspaceSubscription,
  type InsertWorkspaceSubscription,
  type WebhookEndpoint,
  type InsertWebhookEndpoint,
  type InsertWebhookDelivery,
  type InsertGatewayAuditRow,
  type GatewayAuditRow,
  type ShadowAiEventRow,
  type InsertShadowAiEventRow,
  type AiAllowlistRow,
  type RedteamRunRow,
  type InsertRedteamRunRow,
  type RedteamFindingRow,
  type InsertRedteamFindingRow,
  type RedteamScheduleRow,
  type AutofixSuggestionRow,
  type InsertAutofixSuggestionRow,
  type CopilotConversationRow,
  type CopilotMessageRow,
  type InsertCopilotMessageRow,
  type McpServer,
  type InsertMcpServer,
  type McpTool,
  type InsertMcpTool,
  type McpInvocation,
  type InsertMcpInvocation,
  waitlist,
  apiKeys,
  scanReports,
  workspaceEntitlements,
  type WaitlistRow,
  type InsertWaitlistRow,
} from "@rakshex/database";
import { ENV } from "./_core/env";
import {
  assertDb,
  ConflictError,
  InternalError,
  NotFoundError,
  ValidationError,
} from "./_core/errors";
import { logger } from "./_core/logger";
import { toNumber } from "./utils/decimal";
import { sendWelcomeEmail } from "./email";
import {
  calculateThinkingCost,
  extractThinkingTokensFromResponse,
} from "./services/thinkingTokens";

// Re-derive the mysqlEnum literal unions from the Drizzle schema so
// callers don't have to pass `string` and trigger an `as any` cast.
type Subscription = typeof subscriptions.$inferSelect;
type Payment = typeof payments.$inferSelect;
export type SubscriptionStatus = Subscription["status"];
export type PaymentStatus = Payment["status"];
export type RefundStatus = NonNullable<Payment["refundStatus"]>;

let _db: NodePgDatabase<Record<string, unknown>> | null = null;
let _dbInitPromise: Promise<NodePgDatabase<Record<string, unknown>> | null> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
// Uses a promise lock to prevent race conditions when multiple requests
// hit the server simultaneously during cold start.
export async function getDb() {
  if (_db) return _db;
  if (!process.env.DATABASE_URL) return null;

  if (!_dbInitPromise) {
    _dbInitPromise = (async () => {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      // node-postgres emits background errors on idle connections whenever
      // the database restarts. Without this handler Node treats an 'error'
      // event as uncaught and terminates the API process during an outage.
      // pg pools discard these clients and reconnect on subsequent queries.
      pool.on("error", (error) => {
        logger.error({ err: error }, "[Database] Idle pool connection lost");
      });
      try {
        // Verify connectivity before allowing this pool onto the hot path.
        await pool.query("SELECT 1");
        _db = drizzle(pool);
        logger.info("[Database] Connection pool initialized");
        return _db;
      } catch (error) {
        logger.warn({ err: error }, "[Database] Failed to connect");
        await pool.end().catch(() => undefined);
        _db = null;
        return null;
      }
    })().then((value) => {
      // The previous rejected/NULL init promise was cached permanently.
     …17767 tokens truncated…true)));
      const personalIds = ownedPersonal.map((row) => row.id);
      if (personalIds.length > 0) {
        await tx.delete(apiKeys).where(inArray(apiKeys.workspaceId, personalIds));
        await tx
          .delete(workspaceEntitlements)
          .where(inArray(workspaceEntitlements.workspaceId, personalIds));
        await tx
          .delete(workspaceInvitations)
          .where(inArray(workspaceInvitations.workspaceId, personalIds));
        await tx.delete(workspaceMembers).where(inArray(workspaceMembers.workspaceId, personalIds));
        await tx.delete(workspaces).where(inArray(workspaces.id, personalIds));
      }
      await tx.delete(workspaceMembers).where(eq(workspaceMembers.userId, userId));

      await tx.delete(users).where(eq(users.id, userId));

      return {
        deleted: true,
        message: "Account and all associated data deleted successfully",
      };
    })
    .catch((error) => {
      logger.error({ err: error }, "[Database] Account deletion failed");
      throw error;
    });
}

// ============================================================================
// USER UTILITIES
// ============================================================================

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

export async function createSubscription(data: {
  id: string;
  userId: number;
  plan: string;
  razorpaySubscriptionId: string;
  razorpayCustomerId: string;
  status: string;
}) {
  const db = await getDb();
  assertDb(db);

  await db.insert(subscriptions).values({
    id: data.id,
    userId: data.userId,
    plan: data.plan as "free" | "pro" | "enterprise",
    razorpaySubscriptionId: data.razorpaySubscriptionId,
    razorpayCustomerId: data.razorpayCustomerId,
    status: data.status as "pending" | "active" | "past_due" | "cancelled" | "halted",
  });

  return data;
}

export async function getSubscriptionByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getSubscriptionByRazorpayId(razorpayId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.razorpaySubscriptionId, razorpayId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateSubscriptionStatus(
  id: string,
  status: SubscriptionStatus,
  cancelAtPeriodEnd: boolean = false,
) {
  const db = await getDb();
  assertDb(db);

  await db
    .update(subscriptions)
    .set({
      status,
      cancelAtPeriodEnd,
      ...(status === "cancelled" ? { cancelledAt: new Date() } : {}),
    })
    .where(eq(subscriptions.id, id));
}

export async function upsertWorkspaceSubscription(
  data: InsertWorkspaceSubscription,
): Promise<WorkspaceSubscription> {
  const db = await getDb();
  assertDb(db);
  const rows = await db
    .insert(workspaceSubscriptions)
    .values(data)
    .onConflictDoUpdate({
      target: workspaceSubscriptions.workspaceId,
      set: {
        billingOwnerUserId: data.billingOwnerUserId,
        plan: data.plan,
        seatCount: data.seatCount,
        unitAmountMinor: data.unitAmountMinor,
        totalAmountMinor: data.totalAmountMinor,
        currency: data.currency,
        provider: data.provider,
        providerSubscriptionId: data.providerSubscriptionId,
        providerCustomerId: data.providerCustomerId,
        status: data.status,
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd,
        cancelledAt: data.cancelledAt,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!rows[0]) throw new InternalError("Workspace subscription write returned no row");
  return rows[0];
}

export async function getWorkspaceSubscription(
  workspaceId: number,
): Promise<WorkspaceSubscription | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(workspaceSubscriptions)
    .where(eq(workspaceSubscriptions.workspaceId, workspaceId))
    .limit(1);
  return rows[0];
}

export async function getWorkspaceSubscriptionByProviderId(
  providerSubscriptionId: string,
): Promise<WorkspaceSubscription | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(workspaceSubscriptions)
    .where(eq(workspaceSubscriptions.providerSubscriptionId, providerSubscriptionId))
    .limit(1);
  return rows[0];
}

export async function updateWorkspaceSubscription(
  id: string,
  patch: Partial<WorkspaceSubscription>,
): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db
    .update(workspaceSubscriptions)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(workspaceSubscriptions.id, id));
}

export async function countReservedWorkspaceSeats(workspaceId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [members, invitations] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.active, true))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.workspaceId, workspaceId),
          gte(workspaceInvitations.expiresAt, new Date()),
        ),
      ),
  ]);
  return Number(members[0]?.count ?? 0) + Number(invitations[0]?.count ?? 0);
}

export async function updateUserSubscriptionId(userId: number, subscriptionId: string | null) {
  // Subscription link is in subscriptions table
}

// ============================================================================
// PAYMENT MANAGEMENT
// ============================================================================

export async function getPaymentByRazorpayId(razorpayPaymentId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(payments)
    .where(eq(payments.razorpayPaymentId, razorpayPaymentId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createOrUpdatePayment(data: {
  id: string;
  userId: number;
  subscriptionId?: string;
  razorpayPaymentId: string;
  razorpayOrderId?: string;
  /** Canonical provider amount in paise/cents. */
  amountMinor: number;
  currency: string;
  status: PaymentStatus;
  receipt?: string;
  description?: string;
  createdAt?: Date;
}) {
  const db = await getDb();
  assertDb(db);

  const existing = await db
    .select()
    .from(payments)
    .where(eq(payments.razorpayPaymentId, data.razorpayPaymentId))
    .limit(1);

  if (existing.length > 0) {
    // Update existing
    await db
      .update(payments)
      .set({
        status: data.status,
        amountMinor: data.amountMinor,
        amount: (data.amountMinor / 100).toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, existing[0].id));
    return existing[0];
  } else {
    // Create new
    await db.insert(payments).values({
      id: data.id,
      userId: data.userId,
      subscriptionId: data.subscriptionId || null,
      razorpayPaymentId: data.razorpayPaymentId,
      razorpayOrderId: data.razorpayOrderId || null,
      amountMinor: data.amountMinor,
      amount: (data.amountMinor / 100).toFixed(2),
      currency: data.currency,
      status: data.status,
      receipt: data.receipt || null,
      description: data.description || null,
      createdAt: data.createdAt || new Date(),
    });
    return data;
  }
}

export async function getPaymentsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(desc(payments.createdAt));
}

export async function updatePaymentRefundStatus(
  razorpayPaymentId: string,
  refundAmount: number,
  refundStatus: RefundStatus,
) {
  const db = await getDb();
  assertDb(db);

  await db
    .update(payments)
    .set({
      refundAmount: refundAmount.toString(),
      refundStatus,
      status: refundStatus === "full" ? "refunded" : "partially_refunded",
      updatedAt: new Date(),
    })
    .where(eq(payments.razorpayPaymentId, razorpayPaymentId));
}

// Alias so payments.ts can use the more natural `createPayment` name.
export const createPayment = createOrUpdatePayment;

// ============================================================================
// VS CODE EXTENSION HELPERS
// ============================================================================

export async function getUserByApiKey(apiKey: string) {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database] Cannot validate API key: database not available");
    return undefined;
  }

  const { apiKeyHashCandidates, hashApiKey, verifyApiKeyHash } = await import("./utils/crypto");
  const hashed = hashApiKey(apiKey);
  const hashCandidates = apiKeyHashCandidates(apiKey);

  // Primary lookup accepts the former digest during a rolling migration.
  let result = await db.select().from(users).where(inArray(users.apiKey, hashCandidates)).limit(1);
  if (result.length > 0) {
    const user = result[0]!;
    if (user.apiKey !== hashed) {
      await db
        .update(users)
        .set({ apiKey: hashed, updatedAt: new Date() })
        .where(and(eq(users.id, user.id), eq(users.apiKey, user.apiKey!)));
      return { ...user, apiKey: hashed };
    }
    return user;
  }

  // Legacy fallback: plaintext keys stored before migration (dp_ prefix)
  if (apiKey.startsWith("dp_")) {
    result = await db.select().from(users).where(eq(users.apiKey, apiKey)).limit(1);
    if (result.length > 0) {
      const user = result[0]!;
      if (verifyApiKeyHash(apiKey, user.apiKey ?? "") || user.apiKey === apiKey) {
        await db
          .update(users)
          .set({ apiKey: hashed, updatedAt: new Date() })
          .where(and(eq(users.id, user.id), eq(users.apiKey, user.apiKey!)));
        return { ...user, apiKey: hashed };
      }
    }
  }

  return undefined;
}

export async function updateUserApiKey(userId: number, apiKeyHash: string, apiKeyPrefix?: string) {
  const db = await getDb();
  assertDb(db);
  await db
    .update(users)
    .set({
      apiKey: apiKeyHash,
      ...(apiKeyPrefix ? { apiKeyPrefix } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function updateUser(
  userId: number,
  data: Partial<{
    name: string;
    apiKey: string | null;
    scansRemaining: number;
    onboardingCompleted: boolean;
    plan: "free" | "pro" | "enterprise";
    role: "user" | "editor" | "admin";
    emailVerifiedAt: Date | null;
    recoveryCodesHash: string[] | null;
  }>,
) {
  const db = await getDb();
  assertDb(db);
  await db
    .update(users)
    .set({ ...data, updatedAt: new Date() } as any)
    .where(eq(users.id, userId));
}

// ============================================================================
// VERIFICATION TOKENS (email verify, etc.) — hashed at rest
// ============================================================================

export async function createVerificationToken(
  userId: number,
  tokenHash: string,
  purpose: string,
  expiresAt: Date,
) {
  const db = await getDb();
  assertDb(db);
  const { verificationTokens } = await import("@rakshex/database");
  const id = secureId("vt");
  await db.insert(verificationTokens).values({
    id,
    userId,
    tokenHash,
    purpose,
    expiresAt,
  });
  return { id };
}

/**
 * Single-use consume: returns row if valid, marks usedAt, null if invalid/expired/used.
 */
export async function consumeVerificationToken(tokenHash: string, purpose: string) {
  const db = await getDb();
  if (!db) return null;
  const { verificationTokens } = await import("@rakshex/database");
  const rows = await db
    .select()
    .from(verificationTokens)
    .where(
      and(eq(verificationTokens.tokenHash, tokenHash), eq(verificationTokens.purpose, purpose)),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.usedAt) return null;
  if (new Date(row.expiresAt) < new Date()) return null;
  await db
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(verificationTokens.id, row.id));
  return row;
}

export async function recordVSCodeActivity(
  userId: number,
  type: string,
  data: unknown,
  timestamp: Date,
) {
  const db = await getDb();
  assertDb(db);
  const id = secureId("vsa");
  await db.insert(vscodeActivities).values({
    id,
    userId,
    type,
    data,
    timestamp,
  });
  return { id };
}

// Alias naming for the VS Code router.
export const getRecentScansForUser = getRecentScans;

export async function getOpenFindingsCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 3;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(findings)
    .where(and(eq(findings.userId, userId), eq(findings.status, "open")));
  return Number(result[0]?.count ?? 0);
}

// ============================================================================
// WEBHOOK ENDPOINTS (Phase 25 — lifecycle webhooks)
// ============================================================================

/**
 * Create a webhook endpoint registration. The raw secret is stored as-is
 * (not hashed) because we need to reproduce the HMAC signature to sign
 * outgoing deliveries. It is never returned in full from any query except
 * `getWebhookEndpointById`.
 */
export async function createWebhookEndpoint(input: InsertWebhookEndpoint): Promise<{ id: string }> {
  const db = await getDb();
  assertDb(db);
  await db.insert(webhookEndpoints).values(input);
  return { id: input.id };
}

export async function listWebhookEndpointsByUserId(userId: number): Promise<WebhookEndpoint[]> {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.userId, userId))
    .orderBy(desc(webhookEndpoints.createdAt));
}

export async function listWebhookEndpointsByWorkspaceId(
  workspaceId: number,
): Promise<WebhookEndpoint[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.workspaceId, workspaceId))
    .orderBy(desc(webhookEndpoints.createdAt));
}

export async function getWebhookEndpointById(id: string): Promise<WebhookEndpoint | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getWebhookEndpointByWorkspaceId(
  id: string,
  workspaceId: number,
): Promise<WebhookEndpoint | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.workspaceId, workspaceId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Return active endpoints for a user that subscribe to `event`. Filtering
 * the JSON `events` array happens in app code rather than MySQL because
 * drizzle's MySQL JSON filter story is still rough across versions.
 */
export async function getActiveWebhookEndpoints(
  userId: number,
  event: string,
): Promise<WebhookEndpoint[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.userId, userId), eq(webhookEndpoints.isActive, true)));
  return rows.filter((row) => {
    const events = Array.isArray(row.events) ? row.events : [];
    return events.includes(event);
  });
}

export async function getActiveWebhookEndpointsByWorkspace(
  workspaceId: number,
  event: string,
): Promise<WebhookEndpoint[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.workspaceId, workspaceId), eq(webhookEndpoints.isActive, true)));
  return rows.filter((row) => {
    const events = Array.isArray(row.events) ? row.events : [];
    return events.includes(event);
  });
}

export async function deleteWebhookEndpoint(id: string): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id));
}

export async function deleteWebhookEndpointForWorkspace(
  id: string,
  workspaceId: number,
): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db
    .delete(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.workspaceId, workspaceId)));
}

export async function updateWebhookEndpointActive(id: string, isActive: boolean): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db
    .update(webhookEndpoints)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(webhookEndpoints.id, id));
}

export async function updateWebhookEndpointActiveForWorkspace(
  id: string,
  workspaceId: number,
  isActive: boolean,
): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db
    .update(webhookEndpoints)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.workspaceId, workspaceId)));
}

export async function recordWebhookSuccess(id: string, status: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(webhookEndpoints)
    .set({
      lastDeliveryAt: new Date(),
      lastStatus: status,
      consecutiveFailures: 0,
      updatedAt: new Date(),
    })
    .where(eq(webhookEndpoints.id, id));
}

/**
 * Increment failure counter, optionally auto-disabling after a threshold.
 * The dispatcher computes the new failure count and whether we've crossed
 * the disable threshold, so this function just applies the set.
 */
export async function recordWebhookFailure(
  id: string,
  status: number | null,
  autoDisable: boolean,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(webhookEndpoints)
    .set({
      lastDeliveryAt: new Date(),
      lastStatus: status,
      // Raw SQL increment to stay race-free with concurrent deliveries.
      consecutiveFailures: sql`${webhookEndpoints.consecutiveFailures} + 1`,
      isActive: autoDisable ? false : undefined,
      updatedAt: new Date(),
    })
    .where(eq(webhookEndpoints.id, id));
}

export async function createWebhookDelivery(input: InsertWebhookDelivery): Promise<{ id: string }> {
  const db = await getDb();
  assertDb(db);
  await db.insert(webhookDeliveries).values(input);
  return { id: input.id };
}

export async function listWebhookDeliveries(webhookId: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, webhookId))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit);
}

// ============================================================================
// WEBHOOK IDEMPOTENCY (Phase 26 — inbound webhook deduplication)
// ============================================================================

/**
 * Mark a webhook event as processed. Returns `true` if this is the first
 * time we've seen the event, `false` if a duplicate insert was rejected
 * by the primary-key unique constraint.
 *
 * Razorpay (and Stripe / GitHub) retry the same event id for up to ~24h
 * if our 2xx response is delayed or lost. Without this check, a single
 * payment can upgrade a user's plan, run side effects, or fire outbound
 * webhooks multiple times. The `id` is namespaced as `provider:eventId`
 * so we never have to worry about cross-provider id collisions.
 */
export async function markWebhookEventProcessed(
  provider: string,
  eventId: string,
  eventType: string,
): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    // Fail closed in production — marking "processed" without persistence
    // would skip retries after a crash and lose plan upgrades.
    if (process.env.NODE_ENV === "production") {
      throw new Error("Database unavailable — cannot acknowledge webhook");
    }
    return true;
  }
  const id = `${provider}:${eventId}`;
  try {
    await db.insert(processedWebhookEvents).values({
      id,
      provider,
      eventId,
      eventType,
    });
    return true;
  } catch (err: unknown) {
    // PostgreSQL unique-violation error — already processed.
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") {
      return false;
    }
    throw err;
  }
}

export async function isWebhookEventProcessed(provider: string, eventId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const id = `${provider}:${eventId}`;
  const rows = await db
    .select({ id: processedWebhookEvents.id })
    .from(processedWebhookEvents)
    .where(eq(processedWebhookEvents.id, id))
    .limit(1);
  return rows.length > 0;
}

/**
 * Release a claim so a crashed webhook handler can retry. Only used when
 * side effects fail after `markWebhookEventProcessed` already won the insert.
 */
export async function releaseWebhookEventClaim(provider: string, eventId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(processedWebhookEvents)
    .where(eq(processedWebhookEvents.id, `${provider}:${eventId}`));
}

export async function getRecentFindingsForUser(userId: number, limit = 5) {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database] Cannot list recent findings: database not available");
    return [];
  }
  const rows = await db
    .select({
      id: findings.id,
      title: findings.title,
      severity: findings.severity,
      status: findings.status,
      category: findings.category,
      collectionName: collections.name,
      userId: findings.userId,
    })
    .from(findings)
    .leftJoin(collections, eq(findings.collectionId, collections.id))
    .where(eq(findings.userId, userId))
    .orderBy(desc(findings.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    ...r,
    collectionName: r.collectionName ?? "Unknown",
  }));
}

// ============================================================================
// SPRINT 3: AI Runtime Governance helpers
// ============================================================================

interface GatewayAuditPayload {
  tenantId?: string;
  workspaceId?: number;
  requestId?: string;
  model?: string;
  provider?: string;
  decision: "allowed" | "blocked" | "errored";
  blockReason?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    reasoning_tokens?: number;
    thinking_tokens?: number;
  };
  rawResponse?: unknown;
  promptFingerprint?: string;
  startedAt?: number;
  endedAt?: number;
}

/**
 * Best-effort cost-per-1k-tokens table. Real systems sync this from the
 * provider's pricing page; we ship sensible defaults so the dashboard isn't
 * blank on day one. Numbers are USD per 1,000 tokens, blended.
 */
const COST_TABLE: Record<string, { prompt: number; completion: number }> = {
  "gpt-4o": { prompt: 0.0025, completion: 0.01 },
  "gpt-4o-mini": { prompt: 0.00015, completion: 0.0006 },
  "gpt-4-turbo": { prompt: 0.01, completion: 0.03 },
  "gpt-3.5-turbo": { prompt: 0.0005, completion: 0.0015 },
  "o1-preview": { prompt: 0.015, completion: 0.06 },
  "o1-mini": { prompt: 0.003, completion: 0.012 },
  "claude-3-5-sonnet-20241022": { prompt: 0.003, completion: 0.015 },
  "claude-3-5-haiku-20241022": { prompt: 0.0008, completion: 0.004 },
  "claude-3-opus-20240229": { prompt: 0.015, completion: 0.075 },
};

function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const lookup = COST_TABLE[model] ??
    COST_TABLE[
      Object.keys(COST_TABLE).find((k) => model.startsWith(k.split("-")[0]!)) ?? "gpt-3.5-turbo"
    ] ?? { prompt: 0.0005, completion: 0.0015 };
  return (promptTokens / 1000) * lookup.prompt + (completionTokens / 1000) * lookup.completion;
}

export async function recordGatewayAudit(payload: GatewayAuditPayload): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const userId = Number.parseInt(payload.tenantId ?? "0", 10);
  if (!Number.isFinite(userId) || userId <= 0) return;
  const promptTokens = payload.usage?.prompt_tokens ?? 0;
  const completionTokens = payload.usage?.completion_tokens ?? 0;

  // Extract thinking tokens: prefer usage metadata, then provider-specific
  // response extractor when the raw response is available.
  let thinkingTokens =
    payload.usage?.reasoning_tokens ??
    payload.usage?.thinking_tokens ??
    (payload.usage as any)?.completion_tokens_details?.reasoning_tokens ??
    0;

  const model = payload.model ?? "unknown";

  if (thinkingTokens === 0 && payload.rawResponse) {
    const { reasoningTokens } = extractThinkingTokensFromResponse(model, payload.rawResponse);
    if (reasoningTokens > 0) thinkingTokens = reasoningTokens;
  }

  const totalTokens = payload.usage?.total_tokens ?? promptTokens + completionTokens;

  // Calculate cost using thinking tokens breakdown
  // Adjust generation completion tokens (excluding thinking tokens)
  const adjustedCompletion = Math.max(0, completionTokens - thinkingTokens);
  const breakdown = calculateThinkingCost(model, promptTokens, adjustedCompletion, thinkingTokens);
  const cost = breakdown.totalCost;

  const latencyMs =
    payload.startedAt && payload.endedAt ? Math.max(0, payload.endedAt - payload.startedAt) : null;
  const row: InsertGatewayAuditRow = {
    userId,
    workspaceId: payload.workspaceId ?? null,
    requestId: payload.requestId ?? crypto.randomUUID(),
    model,
    decision: payload.decision,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd: cost.toFixed(6),
    ...(payload.provider ? { provider: payload.provider } : {}),
    ...(payload.blockReason ? { blockReason: payload.blockReason } : {}),
    ...(payload.promptFingerprint ? { promptFingerprint: payload.promptFingerprint } : {}),
    ...(latencyMs !== null ? { latencyMs } : {}),
  };
  await db.insert(gatewayAudit).values(row);

  // Mirror into tokenUsage so existing dashboards keep working.
  if (payload.decision === "allowed" && totalTokens > 0) {
    await db.insert(tokenUsage).values({
      id: crypto.randomUUID(),
      userId,
      model,
      promptTokens,
      completionTokens: adjustedCompletion,
      thinkingTokens,
      totalTokens,
      costUSD: cost.toFixed(6),
    });
  }
}

export async function getGatewayAuditRecent(
  userId: number,
  limit = 100,
): Promise<GatewayAuditRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(gatewayAudit)
    .where(eq(gatewayAudit.userId, userId))
    .orderBy(desc(gatewayAudit.createdAt))
    .limit(Math.min(limit, 1000));
}

export async function getGatewayDailyTotals(
  userId: number,
  days = 30,
): Promise<
  Array<{
    date: string;
    totalTokens: number;
    blockedCount: number;
    allowedCount: number;
    estimatedCostUsd: number;
  }>
> {
  const db = await getDb();
  if (!db) return [];
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  const rows = await db
    .select({
      date: sql<string>`DATE(${gatewayAudit.createdAt})`,
      totalTokens: sql<number>`SUM(${gatewayAudit.totalTokens})`,
      blockedCount: sql<number>`SUM(CASE WHEN ${gatewayAudit.decision} = 'blocked' THEN 1 ELSE 0 END)`,
      allowedCount: sql<number>`SUM(CASE WHEN ${gatewayAudit.decision} = 'allowed' THEN 1 ELSE 0 END)`,
      estimatedCostUsd: sql<string>`SUM(${gatewayAudit.estimatedCostUsd})`,
    })
    .from(gatewayAudit)
    .where(and(eq(gatewayAudit.userId, userId), gte(gatewayAudit.createdAt, start)))
    .groupBy(sql`DATE(${gatewayAudit.createdAt})`)
    .orderBy(sql`DATE(${gatewayAudit.createdAt})`);
  return rows.map((r) => ({
    date: r.date,
    totalTokens: Number(r.totalTokens ?? 0),
    blockedCount: Number(r.blockedCount ?? 0),
    allowedCount: Number(r.allowedCount ?? 0),
    estimatedCostUsd: Number(r.estimatedCostUsd ?? 0),
  }));
}

export async function getTokenBudgetState(userId: number): Promise<{
  windowStart: string;
  used: number;
  limit: number | null;
  mode: "soft" | "hard";
}> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  if (!db) {
    return { windowStart: today, used: 0, limit: null, mode: "soft" };
  }
  const cap = await db.select().from(tokenBudgets).where(eq(tokenBudgets.userId, userId)).limit(1);
  const windowStart = today;
  const used = await db
    .select({
      total: sql<number>`COALESCE(SUM(${gatewayAudit.totalTokens}), 0)`,
    })
    .from(gatewayAudit)
    .where(and(eq(gatewayAudit.userId, userId), sql`DATE(${gatewayAudit.createdAt}) = ${today}`));
  const usedTotal = Number(used[0]?.total ?? 0);
  const settings = cap[0];
  return {
    windowStart,
    used: usedTotal,
    limit: settings?.dailyTokenLimit ?? null,
    mode: settings?.mode ?? "soft",
  };
}

export async function setTokenBudget(
  userId: number,
  dailyTokenLimit: number | null,
  mode: "soft" | "hard",
): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db
    .insert(tokenBudgets)
    .values({
      userId,
      dailyTokenLimit,
      mode,
    })
    .onConflictDoUpdate({
      target: tokenBudgets.userId,
      set: { dailyTokenLimit, mode },
    });
}

// ── Shadow AI ────────────────────────────────────────────────────────────────

export async function listAiAllowlist(userId: number): Promise<AiAllowlistRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiAllowlist).where(eq(aiAllowlist.userId, userId));
}

export async function addAiAllowlistEntry(
  userId: number,
  kind: "host" | "model",
  pattern: string,
): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.insert(aiAllowlist).values({ userId, kind, pattern });
}

export async function removeAiAllowlistEntry(userId: number, id: number): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.delete(aiAllowlist).where(and(eq(aiAllowlist.id, id), eq(aiAllowlist.userId, userId)));
}

export async function recordShadowAiEvent(row: InsertShadowAiEventRow): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.insert(shadowAiEvents).values(row);
}

export async function listShadowAiEvents(userId: number, limit = 100): Promise<ShadowAiEventRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(shadowAiEvents)
    .where(eq(shadowAiEvents.userId, userId))
    .orderBy(desc(shadowAiEvents.occurredAt))
    .limit(Math.min(limit, 1000));
}

// ── Red-team ─────────────────────────────────────────────────────────────────

export async function createRedteamRun(row: InsertRedteamRunRow): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.insert(redteamRuns).values(row);
}

export async function updateRedteamRun(id: string, patch: Partial<RedteamRunRow>): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.update(redteamRuns).set(patch).where(eq(redteamRuns.id, id));
}

export async function getRedteamRun(id: string): Promise<RedteamRunRow | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(redteamRuns).where(eq(redteamRuns.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listRedteamRuns(userId: number, limit = 50): Promise<RedteamRunRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(redteamRuns)
    .where(eq(redteamRuns.userId, userId))
    .orderBy(desc(redteamRuns.createdAt))
    .limit(Math.min(limit, 200));
}

export async function recordRedteamFindings(rows: InsertRedteamFindingRow[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDb();
  assertDb(db);
  await db.insert(redteamFindings).values(rows);
}

export async function listRedteamFindings(runId: string): Promise<RedteamFindingRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(redteamFindings)
    .where(eq(redteamFindings.runId, runId))
    .orderBy(desc(redteamFindings.createdAt));
}

export async function listDueRedteamSchedules(): Promise<RedteamScheduleRow[]> {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db
    .select()
    .from(redteamSchedules)
    .where(
      and(
        eq(redteamSchedules.isActive, true),
        sql`(${redteamSchedules.nextRunAt} IS NULL OR ${redteamSchedules.nextRunAt} <= ${now})`,
      ),
    );
}

export async function setRedteamSchedule(
  userId: number,
  target: string,
  cron: string,
  isActive = true,
): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.insert(redteamSchedules).values({
    userId,
    target,
    cron,
    isActive,
  });
}

export async function markRedteamScheduleRan(id: number, nextRunAt: Date): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db
    .update(redteamSchedules)
    .set({ lastRunAt: new Date(), nextRunAt })
    .where(eq(redteamSchedules.id, id));
}

// ── Auto-fix ────────────────────────────────────────────────────────────────

export async function recordAutofix(row: InsertAutofixSuggestionRow): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.insert(autofixSuggestions).values(row);
}

export async function listAutofix(
  userId: number,
  status: "open" | "applied" | "dismissed" | undefined = undefined,
): Promise<AutofixSuggestionRow[]> {
  const db = await getDb();
  if (!db) return [];
  const where = status
    ? and(eq(autofixSuggestions.userId, userId), eq(autofixSuggestions.status, status))
    : eq(autofixSuggestions.userId, userId);
  return db
    .select()
    .from(autofixSuggestions)
    .where(where)
    .orderBy(desc(autofixSuggestions.createdAt));
}

export async function getAutofixById(
  userId: number,
  id: number,
): Promise<AutofixSuggestionRow | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(autofixSuggestions)
    .where(and(eq(autofixSuggestions.id, id), eq(autofixSuggestions.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function updateAutofixStatus(
  userId: number,
  id: number,
  status: "open" | "applied" | "dismissed",
): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db
    .update(autofixSuggestions)
    .set({ status })
    .where(and(eq(autofixSuggestions.id, id), eq(autofixSuggestions.userId, userId)));
}

// ── Security Copilot ────────────────────────────────────────────────────────

export async function createCopilotConversation(
  userId: number,
  id: string,
  title: string,
): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.insert(copilotConversations).values({ id, userId, title });
}

export async function listCopilotConversations(userId: number): Promise<CopilotConversationRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(copilotConversations)
    .where(eq(copilotConversations.userId, userId))
    .orderBy(desc(copilotConversations.updatedAt));
}

export async function appendCopilotMessage(row: InsertCopilotMessageRow): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.insert(copilotMessages).values(row);
}

export async function listCopilotMessages(conversationId: string): Promise<CopilotMessageRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(copilotMessages)
    .where(eq(copilotMessages.conversationId, conversationId))
    .orderBy(copilotMessages.createdAt);
}

// ── Tenant policies (YAML DSL) ───────────────────────────────────────────────

export async function createTenantPolicy(row: InsertTenantPolicyRow): Promise<number> {
  const db = await getDb();
  assertDb(db);
  const [created] = await db
    .insert(tenantPolicies)
    .values(row)
    .returning({ id: tenantPolicies.id });
  if (!created) throw new Error("failed to create tenant policy");
  return created.id;
}

export async function listTenantPolicies(userId: number): Promise<TenantPolicyRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(tenantPolicies)
    .where(eq(tenantPolicies.userId, userId))
    .orderBy(desc(tenantPolicies.updatedAt));
}

export async function getTenantPolicy(userId: number, id: number): Promise<TenantPolicyRow | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(tenantPolicies)
    .where(and(eq(tenantPolicies.userId, userId), eq(tenantPolicies.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateTenantPolicy(
  userId: number,
  id: number,
  patch: Partial<TenantPolicyRow>,
): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db
    .update(tenantPolicies)
    .set(patch)
    .where(and(eq(tenantPolicies.userId, userId), eq(tenantPolicies.id, id)));
}

export async function deleteTenantPolicy(userId: number, id: number): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db
    .delete(tenantPolicies)
    .where(and(eq(tenantPolicies.userId, userId), eq(tenantPolicies.id, id)));
}

// ── Alert rules + events (Sprint 6) ──────────────────────────────────────────

export async function createAlertRule(row: InsertAlertRuleRow): Promise<number> {
  const db = await getDb();
  assertDb(db);
  const [created] = await db.insert(alertRules).values(row).returning({ id: alertRules.id });
  if (!created) throw new Error("failed to create alert rule");
  return created.id;
}

export async function listAlertRules(userId: number): Promise<AlertRuleRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(alertRules)
    .where(eq(alertRules.userId, userId))
    .orderBy(desc(alertRules.updatedAt));
}

export async function listEnabledAlertRules(userId: number): Promise<AlertRuleRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(alertRules)
    .where(and(eq(alertRules.userId, userId), eq(alertRules.enabled, true)));
}

export async function getAlertRule(userId: number, id: number): Promise<AlertRuleRow | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(alertRules)
    .where(and(eq(alertRules.userId, userId), eq(alertRules.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateAlertRule(
  userId: number,
  id: number,
  patch: Partial<AlertRuleRow>,
): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db
    .update(alertRules)
    .set(patch)
    .where(and(eq(alertRules.userId, userId), eq(alertRules.id, id)));
}

export async function deleteAlertRule(userId: number, id: number): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.delete(alertRules).where(and(eq(alertRules.userId, userId), eq(alertRules.id, id)));
}

export async function recordAlertEvent(row: InsertAlertEventRow): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.insert(alertEvents).values(row);
}

export async function listAlertEvents(userId: number, limit = 100): Promise<AlertEventRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(alertEvents)
    .where(eq(alertEvents.userId, userId))
    .orderBy(desc(alertEvents.firedAt))
    .limit(Math.min(limit, 500));
}

// ── SSO providers + pending logins (Sprint 6 / Domain 5) ─────────────────────

export async function createSsoProvider(row: InsertSsoProviderRow): Promise<number> {
  const db = await getDb();
  assertDb(db);
  const [created] = await db.insert(ssoProviders).values(row).returning({ id: ssoProviders.id });
  if (!created) throw new Error("failed to create SSO provider");
  return created.id;
}

export async function listSsoProviders(userId: number): Promise<SsoProviderRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(ssoProviders)
    .where(eq(ssoProviders.userId, userId))
    .orderBy(desc(ssoProviders.updatedAt));
}

export async function getSsoProvider(id: number): Promise<SsoProviderRow | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(ssoProviders).where(eq(ssoProviders.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getSsoProviderForUser(
  userId: number,
  id: number,
): Promise<SsoProviderRow | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(ssoProviders)
    .where(and(eq(ssoProviders.userId, userId), eq(ssoProviders.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateSsoProvider(
  userId: number,
  id: number,
  patch: Partial<SsoProviderRow>,
): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db
    .update(ssoProviders)
    .set(patch)
    .where(and(eq(ssoProviders.userId, userId), eq(ssoProviders.id, id)));
}

export async function deleteSsoProvider(userId: number, id: number): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db
    .delete(ssoProviders)
    .where(and(eq(ssoProviders.userId, userId), eq(ssoProviders.id, id)));
}

export async function createSsoLoginRequest(row: InsertSsoLoginRequestRow): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.insert(ssoLoginRequests).values(row);
}

/**
 * Look up a pending SSO login request by state and atomically delete it
 * so it can be consumed exactly once. Returns null if not found or expired.
 */
export async function consumeSsoLoginRequest(state: string): Promise<SsoLoginRequestRow | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(ssoLoginRequests)
    .where(eq(ssoLoginRequests.state, state))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  await db.delete(ssoLoginRequests).where(eq(ssoLoginRequests.state, state));
  if (row.expiresAt.getTime() < Date.now()) {
    return null;
  }
  return row;
}

/** Background sweeper for expired pending login rows. */
export async function reapExpiredSsoLoginRequests(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .delete(ssoLoginRequests)
    .where(lt(ssoLoginRequests.expiresAt, new Date()));
  return Number((result as unknown as { rowCount?: number }).rowCount ?? 0);
}

// ── Workspaces + RBAC (Sprint 6 / Domain 6) ──────────────────────────────────

export async function createWorkspace(row: InsertWorkspaceRow): Promise<number> {
  const db = await getDb();
  assertDb(db);
  const [created] = await db.insert(workspaces).values(row).returning({ id: workspaces.id });
  if (!created) throw new Error("failed to create workspace");
  return created.id;
}

/**
 * Create a workspace and its owner membership in one transaction.
 *
 * If the membership insert fails after the workspace row commits, the result
 * is a workspace nobody — including its owner — has access to, and which the
 * slug uniqueness check will then block the user from recreating. That is an
 * unrecoverable state for the account, so both rows go in together or
 * neither does.
 */
export async function createWorkspaceWithOwner(
  row: InsertWorkspaceRow,
  ownerUserId: number,
): Promise<number> {
  const db = await getDb();
  assertDb(db);

  return await db.transaction(async (tx) => {
    const [created] = await tx.insert(workspaces).values(row).returning({ id: workspaces.id });
    if (!created) throw new Error("failed to create workspace");

    await tx.insert(workspaceMembers).values({
      workspaceId: created.id,
      userId: ownerUserId,
      role: "owner",
      active: true,
      joinedAt: new Date(),
    });

    return created.id;
  });
}

export async function getWorkspaceById(id: number): Promise<WorkspaceRow | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getWorkspaceBySlug(slug: string): Promise<WorkspaceRow | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getPersonalWorkspaceForUser(userId: number): Promise<WorkspaceRow | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.ownerUserId, userId), eq(workspaces.isPersonal, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertGithubInstallation(input: {
  installationId: number;
  workspaceId: number;
  accountLogin: string;
  accountType: string;
  permissions: Record<string, unknown>;
}): Promise<void> {
  const database = await getDb();
  if (!database) return;
  await database
    .insert(githubInstallations)
    .values(input)
    .onConflictDoUpdate({
      target: githubInstallations.installationId,
      set: { ...input, updatedAt: new Date() },
    });
}

export async function getGithubInstallation(installationId: number) {
  const database = await getDb();
  if (!database) return null;
  const rows = await database
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.installationId, installationId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listWorkspacesForUser(
  userId: number,
): Promise<Array<WorkspaceRow & { role: WorkspaceMemberRow["role"] }>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      ownerUserId: workspaces.ownerUserId,
      isPersonal: workspaces.isPersonal,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.active, true)))
    .orderBy(desc(workspaces.createdAt));
  return rows;
}

export async function updateWorkspace(id: number, patch: Partial<WorkspaceRow>): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.update(workspaces).set(patch).where(eq(workspaces.id, id));
}

export async function deleteWorkspace(id: number): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.transaction(async (tx) => {
    await tx.delete(apiKeys).where(eq(apiKeys.workspaceId, id));
    await tx.delete(workspaceEntitlements).where(eq(workspaceEntitlements.workspaceId, id));
    await tx.delete(scanReports).where(eq(scanReports.workspaceId, id));
    await tx.delete(webhookEndpoints).where(eq(webhookEndpoints.workspaceId, id));
    await tx.delete(workspaceInvitations).where(eq(workspaceInvitations.workspaceId, id));
    await tx.delete(workspaceMembers).where(eq(workspaceMembers.workspaceId, id));
    await tx.delete(githubInstallations).where(eq(githubInstallations.workspaceId, id));
    await tx.delete(collections).where(eq(collections.workspaceId, id));
    await tx.delete(scans).where(eq(scans.workspaceId, id));
    await tx.delete(findings).where(eq(findings.workspaceId, id));
    await tx.delete(workspaces).where(eq(workspaces.id, id));
  });
}

export async function addWorkspaceMember(row: InsertWorkspaceMemberRow): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.insert(workspaceMembers).values(row);
}

export async function getWorkspaceMembership(
  workspaceId: number,
  userId: number,
): Promise<WorkspaceMemberRow | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listWorkspaceMembers(workspaceId: number): Promise<WorkspaceMemberRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(desc(workspaceMembers.joinedAt));
}

export async function listWorkspaceMembersDetailed(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: workspaceMembers.id,
      workspaceId: workspaceMembers.workspaceId,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      active: workspaceMembers.active,
      invitedBy: workspaceMembers.invitedBy,
      invitedAt: workspaceMembers.invitedAt,
      joinedAt: workspaceMembers.joinedAt,
      email: users.email,
      name: users.name,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(desc(workspaceMembers.joinedAt));
}

export async function updateWorkspaceMember(
  workspaceId: number,
  userId: number,
  patch: Partial<WorkspaceMemberRow>,
): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db
    .update(workspaceMembers)
    .set(patch)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
}

export async function removeWorkspaceMember(workspaceId: number, userId: number): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db
    .delete(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
}

/**
 * Find workspace owner user IDs whose members include users with the
 * given email domain. Used by the SSO email-domain resolver to scope
 * provider visibility to the correct workspace boundary.
 *
 * Returns the distinct set of `ownerUserId` values from workspaces
 * where any member's email ends with `@${domain}`.
 */
export async function getWorkspaceOwnerIdsByEmailDomain(domain: string): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  // Find users whose email matches the given domain
  const matchingUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.email} LIKE ${"%" + "@" + domain}`);

  if (matchingUsers.length === 0) return [];

  const userIds = matchingUsers.map((u) => u.id);

  // Find workspace memberships for those users (they are members)
  const memberships = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(
      and(
        sql`${workspaceMembers.userId} IN (${userIds.join(",")})`,
        eq(workspaceMembers.active, true),
      ),
    );

  if (memberships.length === 0) return [];

  const workspaceIds = [...new Set(memberships.map((m) => m.workspaceId))];

  // Get the owner user IDs for those workspaces
  const matchingWorkspaces = await db
    .select({ ownerUserId: workspaces.ownerUserId })
    .from(workspaces)
    .where(sql`${workspaces.id} IN (${workspaceIds.join(",")})`);

  return [...new Set(matchingWorkspaces.map((w) => w.ownerUserId))];
}

export async function createWorkspaceInvitation(
  row: InsertWorkspaceInvitationRow,
): Promise<number> {
  const db = await getDb();
  assertDb(db);
  const [created] = await db
    .insert(workspaceInvitations)
    .values(row)
    .returning({ id: workspaceInvitations.id });
  if (!created) throw new Error("failed to create workspace invitation");
  return created.id;
}

export async function getWorkspaceInvitationByToken(
  token: string,
): Promise<WorkspaceInvitationRow | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(workspaceInvitations)
    .where(eq(workspaceInvitations.token, token))
    .limit(1);
  return rows[0] ?? null;
}

export async function getWorkspaceInvitationForWorkspace(
  id: number,
  workspaceId: number,
): Promise<WorkspaceInvitationRow | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(workspaceInvitations)
    .where(and(eq(workspaceInvitations.id, id), eq(workspaceInvitations.workspaceId, workspaceId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listWorkspaceInvitations(
  workspaceId: number,
): Promise<WorkspaceInvitationRow[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(workspaceInvitations)
    .where(eq(workspaceInvitations.workspaceId, workspaceId))
    .orderBy(desc(workspaceInvitations.createdAt));
}

export async function deleteWorkspaceInvitation(id: number): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.delete(workspaceInvitations).where(eq(workspaceInvitations.id, id));
}

export async function deleteWorkspaceInvitationForWorkspace(
  id: number,
  workspaceId: number,
): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db
    .delete(workspaceInvitations)
    .where(and(eq(workspaceInvitations.id, id), eq(workspaceInvitations.workspaceId, workspaceId)));
}

export async function reapExpiredWorkspaceInvitations(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .delete(workspaceInvitations)
    .where(lt(workspaceInvitations.expiresAt, new Date()));
  return Number((result as unknown as { affectedRows?: number }).affectedRows ?? 0);
}

// ── Shadow AI event queries ─────────────────────────────────────────────────

export async function getShadowAiEvents(
  userId: number,
  limit = 50,
  severity?: string,
): Promise<ShadowAiEventRow[]> {
  const db = await getDb();
  if (!db) return [];
  const where = severity
    ? and(
        eq(shadowAiEvents.userId, userId),
        eq(shadowAiEvents.severity, severity as ShadowAiEventRow["severity"]),
      )
    : eq(shadowAiEvents.userId, userId);
  return db
    .select()
    .from(shadowAiEvents)
    .where(where)
    .orderBy(desc(shadowAiEvents.occurredAt))
    .limit(Math.min(limit, 200));
}

export async function getShadowAiEventById(
  userId: number,
  id: number,
): Promise<ShadowAiEventRow | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(shadowAiEvents)
    .where(and(eq(shadowAiEvents.userId, userId), eq(shadowAiEvents.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getShadowAiSummary(
  userId: number,
): Promise<{ bySeverity: Record<string, number>; total: number }> {
  const db = await getDb();
  if (!db) return { bySeverity: {}, total: 0 };
  const rows = await db
    .select({
      severity: shadowAiEvents.severity,
      count: sql<number>`COUNT(*)`,
    })
    .from(shadowAiEvents)
    .where(eq(shadowAiEvents.userId, userId))
    .groupBy(shadowAiEvents.severity);
  const bySeverity: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    bySeverity[r.severity] = Number(r.count);
    total += Number(r.count);
  }
  return { bySeverity, total };
}

// ── MCP Governance DB helpers ───────────────────────────────────────────────

export async function listMcpServers(userId: number): Promise<McpServer[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.userId, userId))
    .orderBy(desc(mcpServers.lastSeenAt));
}

export async function getMcpToolByName(
  serverId: string,
  toolName: string,
): Promise<McpTool | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(mcpTools as any)
    .where(and(eq((mcpTools as any).serverId, serverId), eq((mcpTools as any).name, toolName)))
    .limit(1);
  return (rows[0] ?? null) as McpTool | null;
}

export async function recordMcpInvocation(row: {
  userId: number;
  serverId: string;
  toolId: string;
  requestId: string;
  argsFingerprint: string;
  decision: "allowed" | "blocked" | "errored";
  durationMs?: number;
}): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.insert(mcpInvocationLog as any).values({
    userId: row.userId,
    serverId: row.serverId,
    toolId: row.toolId,
    requestId: row.requestId,
    argsFingerprint: row.argsFingerprint,
    decision: row.decision,
    ...(row.durationMs ? { durationMs: row.durationMs } : {}),
  });
}

// ── TODO: MCP Server / Tool types now imported at top of file ─────────────

// ── Per-model daily totals for forecasting ──────────────────────────────────

export async function getGatewayDailyTotalsByModel(
  userId: number,
  days = 30,
): Promise<{
  aggregate: Array<{ date: string; totalTokens: number; estimatedCostUsd: number }>;
  byModel: Record<string, Array<{ date: string; totalTokens: number; estimatedCostUsd: number }>>;
}> {
  const db = await getDb();
  if (!db) return { aggregate: [], byModel: {} };

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  cutoff.setUTCHours(0, 0, 0, 0);

  const rows = await db
    .select({
      date: sql<string>`DATE(${gatewayAudit.createdAt})`,
      model: gatewayAudit.model,
      totalTokens: sql<number>`SUM(${gatewayAudit.totalTokens})`,
      estimatedCostUsd: sql<number>`SUM(${gatewayAudit.estimatedCostUsd})`,
    })
    .from(gatewayAudit)
    .where(and(eq(gatewayAudit.userId, userId), gte(gatewayAudit.createdAt, cutoff)))
    .groupBy(sql`DATE(${gatewayAudit.createdAt})`, gatewayAudit.model)
    .orderBy(sql`DATE(${gatewayAudit.createdAt})`);

  // Aggregate totals
  const aggregateMap = new Map<string, { totalTokens: number; estimatedCostUsd: number }>();
  const byModelMap = new Map<
    string,
    Map<string, { totalTokens: number; estimatedCostUsd: number }>
  >();

  for (const r of rows) {
    const d = r.date as string;
    // Aggregate
    const agg = aggregateMap.get(d) ?? { totalTokens: 0, estimatedCostUsd: 0 };
    agg.totalTokens += Number(r.totalTokens);
    agg.estimatedCostUsd += Number(r.estimatedCostUsd);
    aggregateMap.set(d, agg);

    // Per-model
    const model = (r.model as string) ?? "unknown";
    if (!byModelMap.has(model)) byModelMap.set(model, new Map());
    const modelMap = byModelMap.get(model)!;
    const m = modelMap.get(d) ?? { totalTokens: 0, estimatedCostUsd: 0 };
    m.totalTokens += Number(r.totalTokens);
    m.estimatedCostUsd += Number(r.estimatedCostUsd);
    modelMap.set(d, m);
  }

  const aggregate = [...aggregateMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  const byModel: Record<
    string,
    Array<{ date: string; totalTokens: number; estimatedCostUsd: number }>
  > = {};
  for (const [model, modelMap] of byModelMap.entries()) {
    byModel[model] = [...modelMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));
  }

  return { aggregate, byModel };
}

// ── Import History ──────────────────────────────────────────────────────────

export async function recordImportHistory(row: {
  id: string;
  userId: number;
  source: string;
  recordsImported: number;
  recordsSkipped: number;
  collectionsCreated: number;
  errors: string[];
  result: unknown;
}): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.insert(importHistory).values({
    id: row.id,
    userId: row.userId,
    source: row.source,
    recordsImported: row.recordsImported,
    recordsSkipped: row.recordsSkipped,
    collectionsCreated: row.collectionsCreated,
    errors: row.errors,
    result: row.result,
  });
}

export async function getImportHistory(
  userId: number,
  limit = 50,
): Promise<Array<typeof importHistory.$inferSelect>> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(importHistory)
    .where(eq(importHistory.userId, userId))
    .orderBy(desc(importHistory.createdAt))
    .limit(Math.min(limit, 200));
}

// ── AI Events (telemetry) queries ─────────────────────────────────────────

export type { InsertAiEventRow } from "@rakshex/database";

export async function insertAiEvents(rows: InsertAiEventRow[]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(aiEvents).values(rows);
}

export async function listAiEvents(
  userId: number,
  options: {
    limit?: number;
    offset?: number;
    provider?: string;
    status?: string;
    agentId?: string;
  } = {},
): Promise<{ events: AiEventRow[]; total: number }> {
  const db = await getDb();
  if (!db) return { events: [], total: 0 };

  const { limit = 50, offset = 0, provider, status, agentId } = options;

  const conditions = [eq(aiEvents.userId, userId)];
  if (provider) conditions.push(eq(aiEvents.provider, provider));
  if (status) conditions.push(eq(aiEvents.status, status as AiEventRow["status"]));
  if (agentId) conditions.push(eq(aiEvents.agentId, agentId));

  const where = conditions.length === 1 ? conditions[0] : and(...conditions);

  const rows = await db
    .select()
    .from(aiEvents)
    .where(where)
    .orderBy(desc(aiEvents.requestTimestamp))
    .limit(Math.min(limit, 500))
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(aiEvents)
    .where(where);

  return { events: rows, total: countResult[0]?.count ?? 0 };
}

export async function getAiEventStats(
  userId: number,
  days = 30,
): Promise<{
  totalCalls: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  errorRate: number;
  byProvider: Record<string, number>;
  byStatus: Record<string, number>;
  byModel: Record<string, { calls: number; cost: number }>;
  recentLatency: Array<{ ts: string; ms: number }>;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalCalls: 0,
      totalCostUsd: 0,
      avgLatencyMs: 0,
      errorRate: 0,
      byProvider: {},
      byStatus: {},
      byModel: {},
      recentLatency: [],
    };
  }

  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db
    .select()
    .from(aiEvents)
    .where(and(eq(aiEvents.userId, userId), gte(aiEvents.requestTimestamp, since)))
    .orderBy(desc(aiEvents.requestTimestamp))
    .limit(5000);

  if (rows.length === 0) {
    return {
      totalCalls: 0,
      totalCostUsd: 0,
      avgLatencyMs: 0,
      errorRate: 0,
      byProvider: {},
      byStatus: {},
      byModel: {},
      recentLatency: [],
    };
  }

  const totalCost = rows.reduce((s, e) => s + Number(e.costUsd), 0);
  const totalLatency = rows.reduce((s, e) => s + e.latencyMs, 0);
  const errors = rows.filter((e) => e.status !== "ok");

  const byProvider: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byModel: Record<string, { calls: number; cost: number }> = {};

  for (const e of rows) {
    byProvider[e.provider] = (byProvider[e.provider] || 0) + 1;
    byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    byModel[e.model] = byModel[e.model] || { calls: 0, cost: 0 };
    byModel[e.model].calls += 1;
    byModel[e.model].cost += Number(e.costUsd);
  }

  const recentLatency = rows.slice(0, 50).map((e) => ({
    ts: e.requestTimestamp.toISOString(),
    ms: e.latencyMs,
  }));

  return {
    totalCalls: rows.length,
    totalCostUsd: Math.round(totalCost * 1_000_000) / 1_000_000,
    avgLatencyMs: Math.round(totalLatency / rows.length),
    errorRate: Math.round((errors.length / rows.length) * 10000) / 100,
    byProvider,
    byStatus,
    byModel,
    recentLatency,
  };
}

// ── Security Events (Prompt 9 — Agent Guard) ───────────────────────────────

import {
  securityEvents,
  type InsertSecurityEventRow,
  type SecurityEventRow,
} from "@rakshex/database";

export async function insertSecurityEvent(
  row: Omit<InsertSecurityEventRow, "eventId">,
): Promise<string> {
  const db = await getDb();
  assertDb(db);
  const eventId = crypto.randomUUID();
  await db.insert(securityEvents).values({
    eventId,
    ...row,
  });
  return eventId;
}

/** Batch-insert up to N security events in one round-trip. Silently no-ops if DB unavailable. */
export async function insertSecurityEvents(
  rows: Array<Omit<InsertSecurityEventRow, "eventId">>,
): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDb();
  if (!db) return;
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH).map((r) => ({ eventId: crypto.randomUUID(), ...r }));
    await db.insert(securityEvents).values(chunk);
  }
}

export async function listSecurityEvents(
  workspaceId: string,
  opts: {
    limit?: number;
    offset?: number;
    eventType?: string;
    severity?: string;
  } = {},
): Promise<SecurityEventRow[]> {
  const db = await getDb();
  if (!db) return [];
  const { limit = 20, offset = 0, eventType, severity } = opts;

  const conditions = [eq(securityEvents.workspaceId, workspaceId)];
  if (eventType) {
    conditions.push(eq(securityEvents.eventType, eventType as SecurityEventRow["eventType"]));
  }
  if (severity) {
    conditions.push(eq(securityEvents.severity, severity as SecurityEventRow["severity"]));
  }

  const where = conditions.length === 1 ? conditions[0] : and(...conditions);

  return db
    .select()
    .from(securityEvents)
    .where(where)
    .orderBy(desc(securityEvents.createdAt))
    .limit(Math.min(limit, 100))
    .offset(offset);
}

export async function getSecurityEventById(eventId: string): Promise<SecurityEventRow | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(securityEvents)
    .where(eq(securityEvents.eventId, eventId))
    .limit(1);
  return rows[0] ?? null;
}

export async function resolveSecurityEvent(eventId: string, note?: string): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db
    .update(securityEvents)
    .set({
      resolvedAt: new Date(),
      ...(note ? { resolutionNote: note } : {}),
    })
    .where(eq(securityEvents.eventId, eventId));
}

// ── Policy Rules & Pending Approvals (Prompt 10) ──────────────────────────

export interface PolicyRuleRow {
  ruleId: string;
  workspaceId: string;
  name: string;
  description: string | null;
  enabled: boolean;
  priority: number;
  conditions: unknown;
  action: "allow" | "block" | "redact" | "alert_only" | "require_approval";
  createdAt: Date;
  updatedAt: Date;
}

export async function listPolicyRules(workspaceId: string): Promise<PolicyRuleRow[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(
    sql`SELECT rule_id, workspace_id, name, description, enabled, priority, conditions, action, created_at, updated_at FROM policy_rules WHERE workspace_id = ${workspaceId} AND enabled = true ORDER BY priority ASC, created_at ASC`,
  );
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    ruleId: r.rule_id as string,
    workspaceId: r.workspace_id as string,
    name: r.name as string,
    description: r.description as string | null,
    enabled: !!r.enabled,
    priority: Number(r.priority),
    conditions: r.conditions,
    action: r.action as PolicyRuleRow["action"],
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
  }));
}

export async function getPolicyRule(ruleId: string): Promise<PolicyRuleRow | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.execute(
    sql`SELECT rule_id, workspace_id, name, description, enabled, priority, conditions, action, created_at, updated_at FROM policy_rules WHERE rule_id = ${ruleId} LIMIT 1`,
  );
  if ((rows as unknown as Array<unknown>).length === 0) return null;
  const r = (rows as unknown as Array<Record<string, unknown>>)[0];
  return {
    ruleId: r.rule_id as string,
    workspaceId: r.workspace_id as string,
    name: r.name as string,
    description: r.description as string | null,
    enabled: !!r.enabled,
    priority: Number(r.priority),
    conditions: r.conditions,
    action: r.action as PolicyRuleRow["action"],
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
  };
}

export async function insertPolicyRule(params: {
  ruleId: string;
  workspaceId: string;
  name: string;
  description?: string;
  enabled?: boolean;
  priority: number;
  conditions: unknown;
  action: string;
}): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.execute(
    sql`INSERT INTO policy_rules (rule_id, workspace_id, name, description, enabled, priority, conditions, action) VALUES (${params.ruleId}, ${params.workspaceId}, ${params.name}, ${params.description ?? null}, ${params.enabled ?? true}, ${params.priority}, ${JSON.stringify(params.conditions)}, ${params.action})`,
  );
}

export async function updatePolicyRule(
  ruleId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const db = await getDb();
  assertDb(db);
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    const col = snakeCase(key);
    if (col === "rule_id" || col === "workspace_id") continue;
    sets.push(`${col} = ?`);
    values.push(key === "conditions" ? JSON.stringify(value) : value);
  }
  if (sets.length === 0) return;
  values.push(ruleId);
  const rawSql = `UPDATE policy_rules SET ${sets.join(", ")} WHERE rule_id = '${ruleId}'`;
  await db.execute(sql.raw(rawSql));
}

export async function deletePolicyRule(ruleId: string): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.execute(sql`DELETE FROM policy_rules WHERE rule_id = ${ruleId}`);
}

export async function insertPendingApproval(params: {
  approvalId: string;
  workspaceId: string;
  ruleId: string;
  eventSnapshot: unknown;
}): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.execute(
    sql`INSERT INTO pending_approvals (approval_id, workspace_id, rule_id, event_snapshot) VALUES (${params.approvalId}, ${params.workspaceId}, ${params.ruleId}, ${JSON.stringify(params.eventSnapshot)})`,
  );
}

export async function listPendingApprovals(
  workspaceId: string,
): Promise<Array<Record<string, unknown>>> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.execute(
    sql`SELECT approval_id, workspace_id, rule_id, event_snapshot, status, requested_at, resolved_at, resolved_by, resolution_note FROM pending_approvals WHERE workspace_id = ${workspaceId} AND status = 'pending' ORDER BY requested_at DESC LIMIT 100`,
  );
  return rows as unknown as Array<Record<string, unknown>>;
}

export async function resolvePendingApproval(
  approvalId: string,
  status: string,
  resolvedBy: string,
  note?: string,
): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.execute(
    sql`UPDATE pending_approvals SET status = ${status}, resolved_at = NOW(), resolved_by = ${resolvedBy}, resolution_note = ${note ?? null} WHERE approval_id = ${approvalId}`,
  );
}

function snakeCase(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`).replace(/^_/, "");
}

export async function addWaitlistEmail(
  email: string,
  plan = "Free",
  source = "landing_page",
): Promise<{ success: boolean; alreadyExists: boolean }> {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database] Cannot add waitlist email: database not available");
    return { success: false, alreadyExists: false };
  }
  try {
    await db.insert(waitlist).values({ email, plan, source });
    return { success: true, alreadyExists: false };
  } catch (err: any) {
    if (
      err?.code === "23505" ||
      err?.code === "ER_DUP_ENTRY" ||
      err?.message?.includes("Duplicate entry")
    ) {
      return { success: true, alreadyExists: true };
    }
    logger.error({ err }, "[Database] Failed to insert waitlist email");
    return { success: false, alreadyExists: false };
  }
}

export async function getWaitlistCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.execute(sql`SELECT COUNT(*) as count FROM waitlist`);
  return Number((rows as unknown as Array<Record<string, unknown>>)[0]?.count ?? 0);
}

export async function getAllWaitlistEntries(): Promise<
  Array<{ id: number; email: string; plan: string; source: string; createdAt: Date }>
> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(waitlist).orderBy(desc(waitlist.createdAt));
}
