import crypto from "crypto";
import { eq, and, desc, gte, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import type { MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

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
  workspaceMembers,
  workspaceInvitations,
  mcpServers,
  mcpTools,
  mcpInvocationLog,
  waitlistSignups,
  type WaitlistSignupRow,
  type InsertWaitlistSignupRow,
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
} from "../drizzle/schema";
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

// Re-derive the mysqlEnum literal unions from the Drizzle schema so
// callers don't have to pass `string` and trigger an `as any` cast.
type Subscription = typeof subscriptions.$inferSelect;
type Payment = typeof payments.$inferSelect;
export type SubscriptionStatus = Subscription["status"];
export type PaymentStatus = Payment["status"];
export type RefundStatus = NonNullable<Payment["refundStatus"]>;

let _db: MySql2Database<Record<string, unknown>> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = mysql.createPool({
        uri: process.env.DATABASE_URL,
        connectionLimit: 20,
        queueLimit: 0,
      });
      _db = drizzle(pool);
    } catch (error) {
      logger.warn({ err: error }, "[Database] Failed to connect");
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<{ isNew: boolean }> {
  if (!user.openId) {
    throw new ValidationError("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    logger.warn("[Database] Cannot upsert user: database not available");
    return { isNew: false };
  }

  try {
    // Check if user exists to detect new signups
    const existingUser = await getUserByOpenId(user.openId);
    const isNewUser = !existingUser;

    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });

    // Send welcome email for new users
    if (isNewUser && user.email) {
      try {
        await sendWelcomeEmail({
          toEmail: user.email,
          userName: user.name || "",
        });
        logger.info(`[User] Welcome email sent to ${user.email}`);
      } catch (emailError) {
        logger.warn({ err: emailError }, "[User] Failed to send welcome email");
        // Don't fail user creation if email fails
      }
    }

    return { isNew: isNewUser };
  } catch (error) {
    logger.error({ err: error }, "[Database] Failed to upsert user");
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    logger.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ──────────────────────────────────────────────────────────────────────────
// In-memory TTL cache for getUserById / getUserPlan.
//
// Every authenticated tRPC request goes through `protectedProcedure`, which
// re-reads the user record from MySQL. On a busy dashboard that's dozens of
// identical SELECTs per page view. The user row is small, bounded, and
// changes infrequently, so a 30-second in-memory cache gives us a visible
// latency win (MySQL round-trip + JSON serialize) at negligible staleness
// risk.
//
// Invalidated explicitly on writes (plan change, password update,
// upsertUser, etc.) via `invalidateUserCache` below.
//
// Bounded at 10k entries with a simple LRU-ish eviction — if we ever serve
// more than 10k concurrent users, Redis is already wired up and we should
// route through that instead.
// ──────────────────────────────────────────────────────────────────────────
const USER_CACHE_TTL_MS = 30_000;
const USER_CACHE_MAX = 10_000;
interface UserCacheEntry {
  expiresAt: number;
  value: any;
}
const userCache = new Map<number, UserCacheEntry>();

function userCacheGet(id: number): any | undefined {
  const entry = userCache.get(id);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    userCache.delete(id);
    return undefined;
  }
  return entry.value;
}

function userCacheSet(id: number, value: any): void {
  if (userCache.size >= USER_CACHE_MAX) {
    // Evict the oldest-inserted entry (Map preserves insertion order).
    const firstKey = userCache.keys().next().value;
    if (firstKey !== undefined) userCache.delete(firstKey);
  }
  userCache.set(id, { expiresAt: Date.now() + USER_CACHE_TTL_MS, value });
}

/**
 * Clear a user from the in-memory cache. Call this after any write that
 * mutates the user row (plan change, password update, lock, unlock, etc.).
 * No-op when the cache is cold — safe to call redundantly.
 *
 * Named distinctly from `_core/cache.ts`'s Redis-backed `invalidateUserCache`
 * (which clears dashboard/collection caches) so the two can coexist.
 */
export function invalidateUserRowCache(userId: number): void {
  userCache.delete(userId);
}

export async function getUserById(id: number) {
  const cached = userCacheGet(id);
  if (cached !== undefined) return cached;

  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const user = result.length > 0 ? result[0] : undefined;
  if (user) userCacheSet(id, user);
  return user;
}

// ============================================================================
// COLLECTIONS
// ============================================================================

export async function createCollection(
  userId: number,
  name: string,
  format: "postman" | "openapi" | "bruno",
  data: any,
  description?: string,
) {
  const db = await getDb();
  assertDb(db);

  const id = secureId("col");
  let totalRequests = 0;
  if (format === "openapi") {
    totalRequests = Object.keys(data.paths || {}).length;
  } else if (format === "bruno") {
    totalRequests = data.item?.length || 0;
  } else {
    totalRequests = data.item?.length || 0;
  }

  await db.insert(collections).values({
    id,
    userId,
    name,
    format,
    data,
    description,
    totalRequests,
  });

  return { id, userId, name, format, totalRequests };
}

export async function updateCollection(
  id: string,
  updates: { name?: string; description?: string },
) {
  const db = await getDb();
  assertDb(db);

  const set: Record<string, unknown> = {};
  if (updates.name !== undefined) set.name = updates.name;
  if (updates.description !== undefined) set.description = updates.description;

  if (Object.keys(set).length > 0) {
    await db.update(collections).set(set).where(eq(collections.id, id));
  }
}

export async function getCollectionsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(collections)
    .where(eq(collections.userId, userId))
    .orderBy(desc(collections.createdAt));
}

/**
 * Get collections accessible to a user in their workspace.
 * Includes:
 * 1. Collections owned by the user
 * 2. Collections owned by workspace owners where user is an accepted team member
 */
export async function getWorkspaceCollections(userId: number, userEmail?: string) {
  const db = await getDb();
  if (!db) return [];

  // Get collections owned by the user
  const ownCollections = await db
    .select()
    .from(collections)
    .where(eq(collections.userId, userId))
    .orderBy(desc(collections.createdAt));

  // If user has no email, return only own collections
  if (!userEmail) {
    return ownCollections;
  }

  // Get accepted team memberships for this user
  const memberships = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.memberEmail, userEmail), eq(teamMembers.status, "accepted")));

  if (memberships.length === 0) {
    return ownCollections;
  }

  // Get owner user IDs from memberships
  const ownerIds = memberships.map((m) => m.userId);

  // Get collections from workspace owners
  const sharedCollections = await db
    .select()
    .from(collections)
    .where(sql`${collections.userId} IN (${ownerIds.join(",")})`)
    .orderBy(desc(collections.createdAt));

  // Combine and deduplicate (in case user owns some and is also team member).
  // `isShared` is a view-level annotation, not a column — surface it via an
  // intersection type so callers can distinguish.
  type CollectionWithShared = (typeof ownCollections)[number] & {
    isShared?: boolean;
  };
  const allCollections: CollectionWithShared[] = [...ownCollections];
  const seenIds = new Set(ownCollections.map((c) => c.id));

  for (const collection of sharedCollections) {
    if (!seenIds.has(collection.id)) {
      allCollections.push({ ...collection, isShared: true });
      seenIds.add(collection.id);
    }
  }

  return allCollections;
}

export async function getCollectionById(id: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(collections).where(eq(collections.id, id)).limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function getCollectionsByRepoUrl(repoUrl: string) {
  const db = await getDb();
  if (!db) return [];

  // Extract owner/repo from full URL or handle owner/repo format
  let repoName = repoUrl;
  if (repoUrl.includes("github.com")) {
    const match = repoUrl.match(/github\.com\/([^\/]+\/[^\/]+)/);
    if (match) {
      repoName = match[1].replace(/\.git$/, "");
    }
  }

  return await db
    .select()
    .from(collections)
    .where(eq(collections.githubRepo, repoName))
    .orderBy(desc(collections.createdAt));
}

export async function updateCollectionLastScannedAt(id: string) {
  const db = await getDb();
  if (!db) return;

  await db.update(collections).set({ lastScannedAt: new Date() }).where(eq(collections.id, id));
}

/**
 * Check if a user has access to a collection (as owner or team member)
 */
export async function hasCollectionAccess(
  collectionId: string,
  userId: number,
  userEmail?: string,
): Promise<{ access: true; role: string; collection: any } | { access: false }> {
  const db = await getDb();
  if (!db) return { access: false };

  const collection = await getCollectionById(collectionId);
  if (!collection) return { access: false };

  // User is the owner
  if (collection.userId === userId) {
    return { access: true, role: "owner", collection };
  }

  // Check if user is an accepted team member of the owner
  if (userEmail) {
    const membership = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.userId, collection.userId),
          eq(teamMembers.memberEmail, userEmail),
          eq(teamMembers.status, "accepted"),
        ),
      )
      .limit(1);

    if (membership.length > 0) {
      return { access: true, role: membership[0].role, collection };
    }
  }

  return { access: false };
}

export async function deleteCollection(id: string) {
  const db = await getDb();
  assertDb(db);

  // Cascade delete all orphaned analytical data
  await db.delete(findings).where(eq(findings.collectionId, id));
  await db.delete(shadowAPIs).where(eq(shadowAPIs.collectionId, id));
  await db.delete(scans).where(eq(scans.collectionId, id));
  await db.delete(complianceReports).where(eq(complianceReports.collectionId, id));

  // Finally, delete the collection itself
  await db.delete(collections).where(eq(collections.id, id));
}

// ============================================================================
// SCANS
// ============================================================================

export async function createScan(
  userId: number,
  collectionId: string,
  scanType: "full" | "quick" | "shadow_api" | "prompt_injection",
  status: "pending" | "running" | "completed" | "failed",
  riskScore: number,
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  totalFindings: number,
  findingsData?: any,
) {
  const db = await getDb();
  assertDb(db);

  const id = secureId("scan");

  await db.insert(scans).values({
    id,
    userId,
    collectionId,
    scanType,
    status,
    riskScore: riskScore.toString(),
    riskLevel,
    totalFindings,
    findingsData,
    completedAt: status === "completed" ? new Date() : null,
  });

  return { id };
}

export async function getScansByCollectionId(collectionId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(scans)
    .where(eq(scans.collectionId, collectionId))
    .orderBy(desc(scans.createdAt));
}

export async function getScanById(id: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(scans).where(eq(scans.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// ============================================================================
// FINDINGS
// ============================================================================

export async function createFinding(
  scanId: string,
  collectionId: string,
  userId: number,
  title: string,
  severity: "Critical" | "High" | "Medium" | "Low",
  description?: string,
  category?: string,
  remediation?: string,
  cweId?: string,
) {
  const db = await getDb();
  assertDb(db);

  const id = secureId("finding");

  await db.insert(findings).values({
    id,
    scanId,
    collectionId,
    userId,
    title,
    severity,
    description,
    category,
    remediation,
    cweId,
  });

  return { id };
}

export async function getFindingsByScanId(scanId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(findings)
    .where(eq(findings.scanId, scanId))
    .orderBy(desc(findings.createdAt));
}

export async function getFindingById(id: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(findings).where(eq(findings.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateFindingStatus(id: string, status: "open" | "in-progress" | "resolved") {
  const db = await getDb();
  assertDb(db);

  await db.update(findings).set({ status }).where(eq(findings.id, id));
}

// ============================================================================
// SHADOW APIs
// ============================================================================

export async function createShadowAPI(
  scanId: string,
  collectionId: string,
  userId: number,
  endpoint: string,
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  method?: string,
  file?: string,
  line?: number,
  reason?: string,
  recommendation?: string,
) {
  const db = await getDb();
  assertDb(db);

  const id = secureId("shadow");

  await db.insert(shadowAPIs).values({
    id,
    scanId,
    collectionId,
    userId,
    endpoint,
    method,
    file,
    line,
    riskLevel,
    reason,
    recommendation,
  });

  return { id };
}

export async function getShadowAPIsByScanId(scanId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(shadowAPIs)
    .where(eq(shadowAPIs.scanId, scanId))
    .orderBy(desc(shadowAPIs.createdAt));
}

export async function getShadowAPIsByCollectionId(collectionId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(shadowAPIs)
    .where(eq(shadowAPIs.collectionId, collectionId))
    .orderBy(desc(shadowAPIs.createdAt));
}

export async function getShadowAPIById(id: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(shadowAPIs).where(eq(shadowAPIs.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function markShadowAPIDocumented(id: string) {
  const db = await getDb();
  assertDb(db);

  await db.update(shadowAPIs).set({ isDocumented: true }).where(eq(shadowAPIs.id, id));
}

// ============================================================================
// TOKEN USAGE
// ============================================================================

export async function recordTokenUsage(
  userId: number,
  model: string,
  promptTokens: number,
  completionTokens: number,
  thinkingTokens: number,
  costUSD: number,
) {
  const db = await getDb();
  assertDb(db);

  const id = secureId("token");
  const totalTokens = promptTokens + completionTokens + thinkingTokens;

  await db.insert(tokenUsage).values({
    id,
    userId,
    model,
    promptTokens,
    completionTokens,
    thinkingTokens,
    totalTokens,
    costUSD: costUSD.toString(),
  });

  // Auto-increment currentSpendUSD in killSwitchSettings
  const ksSettings = await getKillSwitchSettings(userId);
  if (ksSettings) {
    const currentSpend = parseFloat(ksSettings.currentSpendUSD || "0");
    const updatedSpend = currentSpend + costUSD;
    await updateKillSwitchSettings(userId, undefined, undefined, updatedSpend);

    const budgetLimit = parseFloat(ksSettings.budgetLimitUSD || "0");

    // Check for 80% budget warning
    if (budgetLimit > 0) {
      const percentUsed = (updatedSpend / budgetLimit) * 100;
      const wasBelow80 = (currentSpend / budgetLimit) * 100 < 80;
      const isNowAtOrAbove80 = percentUsed >= 80;

      // Send warning if we just crossed 80% and haven't sent warning in last 24 hours
      if (wasBelow80 && isNowAtOrAbove80 && percentUsed < 100) {
        const lastWarning = ksSettings.lastWarningSentAt;
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        if (!lastWarning || new Date(lastWarning) < oneDayAgo) {
          // Get user for email
          const user = await getUserById(userId);
          if (user?.email) {
            // Send budget warning email
            const { sendBudgetWarningEmail } = await import("./email");
            await sendBudgetWarningEmail({
              toEmail: user.email,
              userName: user.name || "",
              currentSpend: updatedSpend,
              budgetLimit,
              percentUsed,
              dashboardUrl: `${process.env.APP_URL || "http://localhost:3000"}/kill-switch`,
            });
          }

          // Send Slack warning
          const { sendSlackBudgetWarning } = await import("./slack");
          await sendSlackBudgetWarning({
            userId,
            userName: user?.name || "Unknown",
            currentSpend: updatedSpend,
            budgetLimit,
            percentUsed,
          });

          // Fire quota.warning webhook for any user-registered endpoints.
          // Dynamic import to avoid a db.ts → webhookDelivery → db.ts cycle.
          try {
            const { deliver } = await import("./services/webhookDelivery");
            await deliver(userId, "quota.warning", {
              currentSpend: updatedSpend,
              budgetLimit,
              percentUsed,
            });
          } catch (err) {
            logger.warn({ err: err }, "[BudgetWarning] webhook dispatch failed");
          }

          // Update last warning timestamp
          await updateKillSwitchWarningSent(userId);
        }
      }

      // Auto-trigger kill switch if budget exceeded and not already active
      if (updatedSpend >= budgetLimit && !ksSettings.isActive) {
        await updateKillSwitchSettings(userId, undefined, true);
        await createKillSwitchEvent(
          userId,
          "auto_triggered",
          budgetLimit,
          updatedSpend,
          `Budget limit of $${budgetLimit.toFixed(2)} exceeded (current spend: $${updatedSpend.toFixed(2)})`,
        );
        try {
          const { deliver } = await import("./services/webhookDelivery");
          await deliver(userId, "kill_switch.triggered", {
            budgetLimit,
            currentSpend: updatedSpend,
            reason: "budget_exceeded",
          });
        } catch (err) {
          logger.warn({ err: err }, "[KillSwitch] webhook dispatch failed");
        }
      }
    }
  }
}

export async function getTokenUsageByUserId(userId: number, days: number = 30) {
  const db = await getDb();
  if (!db) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return await db
    .select()
    .from(tokenUsage)
    .where(and(eq(tokenUsage.userId, userId), gte(tokenUsage.date, startDate)))
    .orderBy(desc(tokenUsage.date));
}

export async function getTokenUsageByModel(userId: number, model: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(tokenUsage)
    .where(and(eq(tokenUsage.userId, userId), eq(tokenUsage.model, model)))
    .orderBy(desc(tokenUsage.date));
}

// ============================================================================
// KILL SWITCH
// ============================================================================

export async function createKillSwitchEvent(
  userId: number,
  eventType: "budget_set" | "triggered" | "auto_triggered" | "reset",
  budgetLimit?: number,
  currentSpend?: number,
  reason?: string,
  details?: any,
) {
  const db = await getDb();
  assertDb(db);

  const id = secureId("ks");

  await db.insert(killSwitchEvents).values({
    id,
    userId,
    eventType,
    budgetLimit: budgetLimit?.toString(),
    currentSpend: currentSpend?.toString(),
    reason,
    details,
  });
}

export async function getKillSwitchSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(killSwitchSettings)
    .where(eq(killSwitchSettings.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function updateKillSwitchSettings(
  userId: number,
  budgetLimitUSD?: number,
  isActive?: boolean,
  currentSpendUSD?: number,
) {
  const db = await getDb();
  assertDb(db);

  const existing = await getKillSwitchSettings(userId);

  if (!existing) {
    const id = secureId("ks_settings");
    await db.insert(killSwitchSettings).values({
      id,
      userId,
      budgetLimitUSD: budgetLimitUSD?.toString(),
      isActive: isActive ?? false,
      currentSpendUSD: currentSpendUSD?.toString(),
    });
  } else {
    const updates: any = {};
    if (budgetLimitUSD !== undefined) updates.budgetLimitUSD = budgetLimitUSD.toString();
    if (isActive !== undefined) updates.isActive = isActive;
    if (currentSpendUSD !== undefined) updates.currentSpendUSD = currentSpendUSD.toString();

    if (Object.keys(updates).length > 0) {
      await db.update(killSwitchSettings).set(updates).where(eq(killSwitchSettings.userId, userId));
    }
  }
}

export async function updateKillSwitchWarningSent(userId: number) {
  const db = await getDb();
  if (!db) return;

  await db
    .update(killSwitchSettings)
    .set({ lastWarningSentAt: new Date() })
    .where(eq(killSwitchSettings.userId, userId));
}

export async function getKillSwitchAuditTrail(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(killSwitchEvents)
    .where(eq(killSwitchEvents.userId, userId))
    .orderBy(desc(killSwitchEvents.createdAt));
}

// ============================================================================
// COMPLIANCE REPORTS
// ============================================================================

export async function createComplianceReport(
  userId: number,
  collectionId: string,
  reportType: "pci_dss" | "owasp" | "custom",
  complianceScore: number,
  totalRequirements: number,
  metRequirements: number,
  requirementsData?: any,
) {
  const db = await getDb();
  assertDb(db);

  const id = secureId("comp");

  await db.insert(complianceReports).values({
    id,
    userId,
    collectionId,
    reportType,
    complianceScore: complianceScore.toString(),
    totalRequirements,
    metRequirements,
    requirementsData,
  });

  return { id };
}

export async function getComplianceReportsByCollectionId(collectionId: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(complianceReports)
    .where(eq(complianceReports.collectionId, collectionId))
    .orderBy(desc(complianceReports.createdAt));
}

export async function getComplianceReportById(id: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(complianceReports)
    .where(eq(complianceReports.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

// ============================================================================
// TEAM MEMBERS
// ============================================================================

export async function inviteTeamMember(
  userId: number,
  memberEmail: string,
  role: "admin" | "editor" | "viewer",
) {
  const db = await getDb();
  assertDb(db);

  const id = secureId("team");

  await db.insert(teamMembers).values({
    id,
    userId,
    memberEmail,
    role,
  });

  return { id };
}

export async function getTeamMemberById(id: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(teamMembers).where(eq(teamMembers.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getTeamMemberByEmail(userId: number, memberEmail: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.userId, userId), eq(teamMembers.memberEmail, memberEmail)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getTeamMembersByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .orderBy(desc(teamMembers.invitedAt));
}

export async function updateTeamMemberRole(id: string, role: "admin" | "editor" | "viewer") {
  const db = await getDb();
  assertDb(db);

  await db.update(teamMembers).set({ role }).where(eq(teamMembers.id, id));
}

export async function removeTeamMember(id: string) {
  const db = await getDb();
  assertDb(db);

  await db.delete(teamMembers).where(eq(teamMembers.id, id));
}

// ============================================================================
// ONBOARDING
// ============================================================================

export async function getOrCreateOnboardingProgress(userId: number) {
  const db = await getDb();
  assertDb(db);

  const existing = await db
    .select()
    .from(onboardingProgress)
    .where(eq(onboardingProgress.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const id = secureId("onb");
  await db.insert(onboardingProgress).values({
    id,
    userId,
  });

  return await db
    .select()
    .from(onboardingProgress)
    .where(eq(onboardingProgress.userId, userId))
    .limit(1)
    .then((r) => r[0]);
}

export async function updateOnboardingStep(
  userId: number,
  step: "importCollection" | "runScan" | "reviewFindings" | "inviteTeam" | "setupCompliance",
) {
  const db = await getDb();
  assertDb(db);

  const updates: any = {};

  if (step === "importCollection") {
    updates.importCollectionCompleted = true;
    updates.currentStep = 2;
  }
  if (step === "runScan") {
    updates.runScanCompleted = true;
    updates.currentStep = 3;
  }
  if (step === "reviewFindings") {
    updates.reviewFindingsCompleted = true;
    updates.currentStep = 4;
  }
  if (step === "inviteTeam") {
    updates.inviteTeamCompleted = true;
    updates.currentStep = 5;
  }
  if (step === "setupCompliance") {
    updates.setupComplianceCompleted = true;
  }

  // Mark completedAt if all steps done
  const progress = await getOrCreateOnboardingProgress(userId);
  const allStepsCompleted =
    (updates.importCollectionCompleted || progress.importCollectionCompleted) &&
    (updates.runScanCompleted || progress.runScanCompleted) &&
    (updates.reviewFindingsCompleted || progress.reviewFindingsCompleted) &&
    (updates.inviteTeamCompleted || progress.inviteTeamCompleted) &&
    (updates.setupComplianceCompleted || progress.setupComplianceCompleted);

  if (allStepsCompleted) {
    updates.completedAt = new Date();
  }

  await db.update(onboardingProgress).set(updates).where(eq(onboardingProgress.userId, userId));
}

export async function completeOnboarding(userId: number) {
  const db = await getDb();
  assertDb(db);

  await db.update(users).set({ onboardingCompleted: true }).where(eq(users.id, userId));

  await db
    .update(onboardingProgress)
    .set({ completedAt: new Date() })
    .where(eq(onboardingProgress.userId, userId));
}

// ============================================================================
// DASHBOARD (Optimized — avoids N+1 queries)
// ============================================================================

export async function getDashboardMetrics(userId: number) {
  const db = await getDb();
  if (!db)
    return {
      totalCollections: 0,
      totalFindings: 0,
      highestRiskScore: 0,
      teamMembers: 0,
    };

  const [collectionsResult, findingsResult, riskResult, teamResult] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(collections)
      .where(eq(collections.userId, userId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(findings)
      .where(eq(findings.userId, userId)),
    db
      .select({ maxScore: sql<string>`MAX(riskScore)` })
      .from(scans)
      .where(eq(scans.userId, userId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId)),
  ]);

  return {
    totalCollections: Number(collectionsResult[0]?.count ?? 0),
    totalFindings: Number(findingsResult[0]?.count ?? 0),
    highestRiskScore: Math.round(parseFloat(riskResult[0]?.maxScore ?? "0")),
    teamMembers: Number(teamResult[0]?.count ?? 0),
  };
}

export async function getRecentScans(userId: number, limit: number = 5) {
  const db = await getDb();
  if (!db) return [];

  const recentScans = await db
    .select({
      id: scans.id,
      collectionId: scans.collectionId,
      collectionName: collections.name,
      scanType: scans.scanType,
      riskScore: scans.riskScore,
      riskLevel: scans.riskLevel,
      totalFindings: scans.totalFindings,
      createdAt: scans.createdAt,
    })
    .from(scans)
    .leftJoin(collections, eq(scans.collectionId, collections.id))
    .where(eq(scans.userId, userId))
    .orderBy(desc(scans.createdAt))
    .limit(limit);

  return recentScans.map((s) => ({
    id: s.id,
    collectionName: s.collectionName ?? "Unknown",
    scanType: s.scanType,
    riskScore: toNumber(s.riskScore),
    riskLevel: s.riskLevel,
    totalFindings: s.totalFindings,
    createdAt: s.createdAt,
  }));
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      plan: users.plan,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .orderBy(desc(users.createdAt));
}

// ============================================================================
// USER PLAN / SUBSCRIPTION
// ============================================================================

export async function updateUserPlan(userId: number, plan: "free" | "pro" | "enterprise") {
  const db = await getDb();
  assertDb(db);

  await db.update(users).set({ plan }).where(eq(users.id, userId));
  invalidateUserRowCache(userId);
}

export async function getUserPlan(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "free";

  const result = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return result.length > 0 ? result[0].plan : "free";
}

const TRIAL_DAYS = 14;

export async function getTrialStatus(userId: number): Promise<{
  isTrial: boolean;
  daysLeft: number;
  totalDays: number;
}> {
  const user = await getUserById(userId);
  if (!user) return { isTrial: false, daysLeft: 0, totalDays: TRIAL_DAYS };

  // Users on paid plans are not in trial
  const plan = user.plan ?? "free";
  if (plan !== "free") {
    return { isTrial: false, daysLeft: 0, totalDays: TRIAL_DAYS };
  }

  const createdAt = user.createdAt ? new Date(user.createdAt) : new Date();
  const trialEnd = new Date(createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const msLeft = trialEnd.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
  const isTrial = msLeft > 0;

  return { isTrial, daysLeft, totalDays: TRIAL_DAYS };
}

export async function getEffectivePlan(userId: number): Promise<"free" | "pro" | "enterprise"> {
  const plan = await getUserPlan(userId);
  if (plan !== "free") return plan as "free" | "pro" | "enterprise";

  const trial = await getTrialStatus(userId);
  return trial.isTrial ? "pro" : "free";
}

// ============================================================================
// TEAM INVITATION ACCEPT / REJECT
// ============================================================================

export async function acceptTeamInvitation(memberId: string, memberUserId: number) {
  const db = await getDb();
  assertDb(db);

  const member = await getTeamMemberById(memberId);
  if (!member) throw new NotFoundError("Invitation not found");
  if (member.status !== "pending") throw new ConflictError("Invitation is no longer pending");

  await db
    .update(teamMembers)
    .set({ status: "accepted", memberUserId, acceptedAt: new Date() })
    .where(eq(teamMembers.id, memberId));
}

export async function rejectTeamInvitation(memberId: string) {
  const db = await getDb();
  assertDb(db);

  const member = await getTeamMemberById(memberId);
  if (!member) throw new NotFoundError("Invitation not found");
  if (member.status !== "pending") throw new ConflictError("Invitation is no longer pending");

  await db.update(teamMembers).set({ status: "rejected" }).where(eq(teamMembers.id, memberId));
}

export async function getPendingInvitationsForUser(email: string) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.memberEmail, email), eq(teamMembers.status, "pending")))
    .orderBy(desc(teamMembers.invitedAt));
}

// ============================================================================
// COST ANOMALY DETECTION
// ============================================================================

export async function detectCostAnomaly(
  userId: number,
  threshold: number = 2.0,
): Promise<{
  isAnomaly: boolean;
  currentCost: number;
  averageCost: number;
  standardDeviation: number;
}> {
  const usage = await getTokenUsageByUserId(userId, 30);

  if (usage.length < 5) {
    return {
      isAnomaly: false,
      currentCost: 0,
      averageCost: 0,
      standardDeviation: 0,
    };
  }

  const costs = usage.map((u) => toNumber(u.costUSD));
  const currentCost = costs[0] ?? 0;
  const averageCost = costs.reduce((a, b) => a + b, 0) / costs.length;
  const variance = costs.reduce((sum, c) => sum + Math.pow(c - averageCost, 2), 0) / costs.length;
  const standardDeviation = Math.sqrt(variance);

  const isAnomaly =
    standardDeviation > 0 && currentCost > averageCost + threshold * standardDeviation;

  return { isAnomaly, currentCost, averageCost, standardDeviation };
}

// ============================================================================
// PASSWORD RESET TOKENS
// ============================================================================

export async function createPasswordResetToken(userId: number, token: string, expiresAt: Date) {
  const db = await getDb();
  assertDb(db);

  const id = secureId("prt");
  await db.insert(passwordResetTokens).values({
    id,
    userId,
    token,
    expiresAt,
  });
  return { id };
}

export async function getPasswordResetToken(token: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function markPasswordResetTokenUsed(tokenId: string) {
  const db = await getDb();
  assertDb(db);

  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, tokenId));
}

export async function cleanupExpiredPasswordResetTokens() {
  const db = await getDb();
  if (!db) return;

  await db.delete(passwordResetTokens).where(sql`${passwordResetTokens.expiresAt} < NOW()`);
}

// ============================================================================
// USER SESSIONS
// ============================================================================

export async function createUserSession(
  userId: number,
  sessionToken: string,
  refreshTokenHash: string | null,
  ipAddress: string | null,
  userAgent: string | null,
  expiresAt: Date,
) {
  const db = await getDb();
  assertDb(db);

  const id = secureId("sess");
  await db.insert(userSessions).values({
    id,
    userId,
    sessionToken,
    refreshTokenHash,
    ipAddress,
    userAgent,
    expiresAt,
  });
  return { id };
}

export async function getUserSessionByRefreshTokenHash(refreshTokenHash: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(userSessions)
    .where(
      and(
        eq(userSessions.refreshTokenHash, refreshTokenHash),
        eq(userSessions.isRevoked, false),
        sql`${userSessions.expiresAt} > NOW()`,
      ),
    )
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function rotateRefreshToken(sessionId: string, newRefreshTokenHash: string) {
  const db = await getDb();
  assertDb(db);

  await db
    .update(userSessions)
    .set({
      refreshTokenHash: newRefreshTokenHash,
      lastUsedAt: new Date(),
    })
    .where(eq(userSessions.id, sessionId));
}
export async function getUserSessions(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(userSessions)
    .where(
      and(
        eq(userSessions.userId, userId),
        sql`${userSessions.expiresAt} > NOW()`,
        eq(userSessions.isRevoked, false),
      ),
    )
    .orderBy(desc(userSessions.createdAt));
}

export async function getUserSessionByToken(sessionToken: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(userSessions)
    .where(
      and(
        eq(userSessions.sessionToken, sessionToken),
        sql`${userSessions.expiresAt} > NOW()`,
        eq(userSessions.isRevoked, false),
      ),
    )
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function revokeUserSession(sessionId: string) {
  const db = await getDb();
  assertDb(db);

  await db
    .update(userSessions)
    .set({ revokedAt: new Date(), isRevoked: true })
    .where(eq(userSessions.id, sessionId));
}

export async function revokeAllUserSessions(userId: number, exceptSessionId?: string) {
  const db = await getDb();
  assertDb(db);

  const conditions = [eq(userSessions.userId, userId), eq(userSessions.isRevoked, false)];
  if (exceptSessionId) {
    conditions.push(sql`${userSessions.id} != ${exceptSessionId}`);
  }

  await db
    .update(userSessions)
    .set({ revokedAt: new Date(), isRevoked: true })
    .where(and(...conditions));
}

export async function updateSessionLastActive(sessionId: string) {
  const db = await getDb();
  if (!db) return;

  await db
    .update(userSessions)
    .set({ lastActiveAt: new Date() })
    .where(eq(userSessions.id, sessionId));
}

export async function cleanupExpiredUserSessions() {
  const db = await getDb();
  if (!db) return;

  await db.delete(userSessions).where(sql`${userSessions.expiresAt} < NOW()`);
}

// ============================================================================
// EMAIL PREFERENCES
// ============================================================================

export async function getOrCreateEmailPreferences(userId: number) {
  const db = await getDb();
  if (!db) {
    return {
      scanComplete: true,
      budgetAlerts: true,
      weeklyDigest: true,
      teamActivity: true,
      promotionalEmails: false,
    };
  }

  const result = await db
    .select()
    .from(emailPreferences)
    .where(eq(emailPreferences.userId, userId))
    .limit(1);

  if (result.length > 0) {
    return result[0];
  }

  // Create default preferences
  const id = secureId("ep");
  await db.insert(emailPreferences).values({
    id,
    userId,
    scanComplete: true,
    budgetAlerts: true,
    weeklyDigest: true,
    teamActivity: true,
    promotionalEmails: false,
  });

  return await db
    .select()
    .from(emailPreferences)
    .where(eq(emailPreferences.id, id))
    .limit(1)
    .then((r) => r[0]);
}

export async function updateEmailPreferences(
  userId: number,
  prefs: {
    scanComplete?: boolean;
    budgetAlerts?: boolean;
    weeklyDigest?: boolean;
    teamActivity?: boolean;
    promotionalEmails?: boolean;
  },
) {
  const db = await getDb();
  assertDb(db);

  const existing = await getOrCreateEmailPreferences(userId);

  await db
    .update(emailPreferences)
    .set({
      ...prefs,
      updatedAt: new Date(),
    })
    .where(eq(emailPreferences.userId, userId));

  return { success: true };
}

// ============================================================================
// AUDIT LOG
// ============================================================================

export async function createAuditLogEntry(
  userId: number,
  action: string,
  details?: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string,
) {
  const db = await getDb();
  if (!db) return;

  const id = secureId("audit");
  await db.insert(auditLog).values({
    id,
    userId,
    action,
    details: details || null,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
  });
}

export async function getAuditLogForUser(userId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.userId, userId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}

// ============================================================================
// USER PROFILE MANAGEMENT
// ============================================================================

export async function updateUserProfile(
  userId: number,
  updates: {
    name?: string;
    email?: string;
  },
) {
  const db = await getDb();
  assertDb(db);

  await db
    .update(users)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  invalidateUserRowCache(userId);
}

export async function updateUserPassword(userId: number, hashedPassword: string) {
  const db = await getDb();
  assertDb(db);

  await db
    .update(users)
    .set({
      passwordHash: hashedPassword,
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  invalidateUserRowCache(userId);
}

/**
 * Update (or clear) the TOTP secret for 2FA.
 * Pass null to disable 2FA.
 */
export async function updateUserTotpSecret(userId: number, totpSecret: string | null) {
  const db = await getDb();
  assertDb(db);

  await db
    .update(users)
    .set({
      totpSecret,
      updatedAt: new Date(),
    } as any)
    .where(eq(users.id, userId));
  invalidateUserRowCache(userId);
}

/**
 * Store or clear a pending TOTP secret for 2FA setup.
 * The secret is temporary and expires after 10 minutes.
 * Pass null for both to clear.
 */
export async function updatePendingTotpSecret(
  userId: number,
  pendingTotpSecret: string | null,
  pendingTotpExpiresAt: Date | null,
) {
  const db = await getDb();
  assertDb(db);

  await db
    .update(users)
    .set({
      pendingTotpSecret,
      pendingTotpExpiresAt,
      updatedAt: new Date(),
    } as any)
    .where(eq(users.id, userId));
  invalidateUserRowCache(userId);
}

/**
 * Get the pending TOTP secret and expiry for a user.
 */
export async function getPendingTotpSecret(
  userId: number,
): Promise<{ pendingTotpSecret: string | null; pendingTotpExpiresAt: Date | null } | null> {
  const db = await getDb();
  assertDb(db);

  const rows = await db
    .select({
      pendingTotpSecret: users.pendingTotpSecret,
      pendingTotpExpiresAt: users.pendingTotpExpiresAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return rows[0] || null;
}

/**
 * Create a new user that signed up via email + password (not OAuth).
 * The `openId` field is still used as the session subject for JWT auth,
 * so we generate a unique "local:" prefix to keep it distinct from
 * OAuth-synced users.
 */
export async function createLocalUser(data: {
  email: string;
  name: string;
  passwordHash: string;
}): Promise<{ id: number; openId: string }> {
  const db = await getDb();
  assertDb(db);

  const openId = `local:${crypto.randomBytes(24).toString("hex")}`;

  await db.insert(users).values({
    openId,
    email: data.email,
    name: data.name,
    loginMethod: "email",
    passwordHash: data.passwordHash,
    lastSignedIn: new Date(),
  });

  const created = await db
    .select({ id: users.id, openId: users.openId })
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  if (created.length === 0) {
    throw new InternalError("Failed to create user", {
      safeMessage: "Could not create your account. Please try again.",
    });
  }

  return created[0];
}

export async function incrementFailedLoginAttempts(
  userId: number,
  lockThreshold = 5,
  lockDurationMs = 15 * 60 * 1000,
): Promise<{ attempts: number; lockedUntil: Date | null }> {
  const db = await getDb();
  assertDb(db);

  const existing = await db
    .select({ attempts: users.failedLoginAttempts })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const attempts = (existing[0]?.attempts ?? 0) + 1;
  const lockedUntil = attempts >= lockThreshold ? new Date(Date.now() + lockDurationMs) : null;

  await db
    .update(users)
    .set({
      failedLoginAttempts: attempts,
      lockedUntil,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  invalidateUserRowCache(userId);

  return { attempts, lockedUntil };
}

export async function resetFailedLoginAttempts(userId: number): Promise<void> {
  const db = await getDb();
  assertDb(db);

  await db
    .update(users)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastSignedIn: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  invalidateUserRowCache(userId);
}

// ============================================================================
// ACCOUNT DELETION - CASCADE DELETE EVERYTHING
// ============================================================================

export async function deleteUserAccount(
  userId: number,
): Promise<{ deleted: boolean; message: string }> {
  const db = await getDb();
  assertDb(db);

  try {
    // Delete in order respecting foreign key relationships
    // 1. Delete audit logs
    await db.delete(auditLog).where(eq(auditLog.userId, userId));

    // 2. Delete password reset tokens
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));

    // 3. Delete user sessions
    await db.delete(userSessions).where(eq(userSessions.userId, userId));

    // 4. Delete email preferences
    await db.delete(emailPreferences).where(eq(emailPreferences.userId, userId));

    // 5. Delete token usage
    await db.delete(tokenUsage).where(eq(tokenUsage.userId, userId));

    // 6. Delete kill switch events and settings
    await db.delete(killSwitchEvents).where(eq(killSwitchEvents.userId, userId));
    await db.delete(killSwitchSettings).where(eq(killSwitchSettings.userId, userId));

    // 7. Delete team memberships (both as owner and member)
    await db.delete(teamMembers).where(
      and(
        eq(teamMembers.userId, userId),
        sql`${teamMembers.memberUserId} IS NULL`, // Only delete where they are the owner
      ),
    );
    await db.delete(teamMembers).where(eq(teamMembers.memberUserId, userId));

    // 8. Delete onboarding progress
    await db.delete(onboardingProgress).where(eq(onboardingProgress.userId, userId));

    // 9. Delete compliance reports
    await db.delete(complianceReports).where(eq(complianceReports.userId, userId));

    // 10. Delete findings (need to get scan IDs first)
    const userScans = await db.select({ id: scans.id }).from(scans).where(eq(scans.userId, userId));
    const scanIds = userScans.map((s) => s.id);
    if (scanIds.length > 0) {
      await db.delete(findings).where(sql`${findings.scanId} IN (${scanIds.join(",")})`);
      await db.delete(shadowAPIs).where(sql`${shadowAPIs.scanId} IN (${scanIds.join(",")})`);
    }

    // 11. Delete scans
    await db.delete(scans).where(eq(scans.userId, userId));

    // 12. Delete collections
    await db.delete(collections).where(eq(collections.userId, userId));

    // 13. Delete subscriptions and payments
    await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
    await db.delete(payments).where(eq(payments.userId, userId));

    // 14. Finally delete the user
    await db.delete(users).where(eq(users.id, userId));

    return {
      deleted: true,
      message: "Account and all associated data deleted successfully",
    };
  } catch (error) {
    logger.error({ err: error }, "[Database] Account deletion failed");
    throw error;
  }
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
  amount: number;
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
        amount: data.amount.toString(),
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
      amount: data.amount.toString(),
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
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.apiKey, apiKey)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserApiKey(userId: number, apiKey: string) {
  const db = await getDb();
  assertDb(db);
  await db.update(users).set({ apiKey, updatedAt: new Date() }).where(eq(users.id, userId));
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
  }>,
) {
  const db = await getDb();
  assertDb(db);
  await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, userId));
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
  if (!db) return 0;
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

export async function getWebhookEndpointById(id: string): Promise<WebhookEndpoint | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, id)).limit(1);
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

export async function deleteWebhookEndpoint(id: string): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id));
}

export async function updateWebhookEndpointActive(id: string, isActive: boolean): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db
    .update(webhookEndpoints)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(webhookEndpoints.id, id));
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
    // No DB available (local tooling). Be permissive — the operator
    // sees the alert via Sentry and the dev environment can move on.
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
    // MySQL duplicate-key error — already processed.
    const code = (err as { code?: string } | null)?.code;
    if (code === "ER_DUP_ENTRY") {
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

export async function getRecentFindingsForUser(userId: number, limit = 5) {
  const db = await getDb();
  if (!db) return [];
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
  requestId?: string;
  model?: string;
  provider?: string;
  decision: "allowed" | "blocked" | "errored";
  blockReason?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
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
  const totalTokens = payload.usage?.total_tokens ?? promptTokens + completionTokens;
  const model = payload.model ?? "unknown";
  const cost = estimateCostUsd(model, promptTokens, completionTokens);
  const latencyMs =
    payload.startedAt && payload.endedAt ? Math.max(0, payload.endedAt - payload.startedAt) : null;
  const row: InsertGatewayAuditRow = {
    userId,
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
      completionTokens,
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
    .onDuplicateKeyUpdate({
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
  const result = await db.insert(tenantPolicies).values(row);
  return Number((result as unknown as { insertId?: number }).insertId ?? 0);
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
  const result = await db.insert(alertRules).values(row);
  return Number((result as unknown as { insertId?: number }).insertId ?? 0);
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
  const result = await db.insert(ssoProviders).values(row);
  return Number((result as unknown as { insertId?: number }).insertId ?? 0);
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
  return Number((result as unknown as { affectedRows?: number }).affectedRows ?? 0);
}

// ── Workspaces + RBAC (Sprint 6 / Domain 6) ──────────────────────────────────

export async function createWorkspace(row: InsertWorkspaceRow): Promise<number> {
  const db = await getDb();
  assertDb(db);
  const result = await db.insert(workspaces).values(row);
  return Number((result as unknown as { insertId?: number }).insertId ?? 0);
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
  await db.delete(workspaces).where(eq(workspaces.id, id));
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
  const result = await db.insert(workspaceInvitations).values(row);
  return Number((result as unknown as { insertId?: number }).insertId ?? 0);
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
  serverId: number,
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
  serverId: number;
  toolId: number;
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

export type { InsertAiEventRow } from "../drizzle/schema";

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
} from "../drizzle/schema";

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

// ============================================================================
// Waitlist signups (public marketing landing form)
// ============================================================================

export async function insertWaitlistSignup(
  row: InsertWaitlistSignupRow,
): Promise<{ id: number; created: boolean }> {
  const db = await getDb();
  assertDb(db);
  // Idempotent: if email already exists, return existing row's id without
  // bumping the timestamp. Lets the FE always show a friendly success
  // message even on duplicate submits.
  const [existing] = await db
    .select({ id: waitlistSignups.id })
    .from(waitlistSignups)
    .where(eq(waitlistSignups.email, row.email))
    .limit(1);
  if (existing) {
    return { id: existing.id, created: false };
  }
  const result = await db.insert(waitlistSignups).values(row);
  const insertId = Number((result as unknown as { insertId?: number }).insertId ?? 0);
  return { id: insertId, created: true };
}

export async function listWaitlistSignups(limit = 100, offset = 0): Promise<WaitlistSignupRow[]> {
  const db = await getDb();
  assertDb(db);
  const rows = await db
    .select()
    .from(waitlistSignups)
    .orderBy(desc(waitlistSignups.createdAt))
    .limit(limit)
    .offset(offset);
  return rows;
}
