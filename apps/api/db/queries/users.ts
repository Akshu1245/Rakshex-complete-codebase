import { eq } from "drizzle-orm";
import { users, type InsertUser } from "@rakshex/database";
import { getDb } from "..";
import { assertDb, ValidationError } from "../../_core/errors";
import { logger } from "../../_core/logger";
import { sendWelcomeEmail } from "../../email";
import crypto from "crypto";

export async function upsertUser(user: InsertUser): Promise<{ isNew: boolean }> {
  if (!user.openId) {
    throw new ValidationError("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    logger.warn("[Database] Cannot upsert user: database not available");
    return { isNew: false };
  }

  const existing = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);

  if (existing.length > 0) {
    await db
      .update(users)
      .set({
        name: user.name,
        email: user.email,
        lastSignedIn: new Date(),
      })
      .where(eq(users.openId, user.openId));
    return { isNew: false };
  }

  await db.insert(users).values(user);

  if (user.email) {
    sendWelcomeEmail({
      toEmail: user.email,
      userName: user.name || "there",
    }).catch((err) => logger.warn({ err }, "[Email] Failed to send welcome email"));
  }

  return { isNew: true };
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

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserPassword(userId: number, hashedPassword: string) {
  const db = await getDb();
  assertDb(db, "updateUserPassword");

  await db
    .update(users)
    .set({ passwordHash: hashedPassword, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function updateUserPlan(userId: number, plan: "free" | "pro" | "enterprise") {
  const db = await getDb();
  assertDb(db, "updateUserPlan");

  await db.update(users).set({ plan, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(users);
}

/**
 * Look up a user by their Rakshex API key (as used by the VS Code
 * extension and any `Bearer dp_*` / `x-api-key` callers).
 */
export async function getUserByApiKey(apiKey: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.apiKey, apiKey)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Overwrite a user's API key. Pair with a rotation flow in the dashboard.
 */
export async function updateUserApiKey(userId: number, apiKey: string) {
  const db = await getDb();
  assertDb(db, "updateUserApiKey");

  await db.update(users).set({ apiKey, updatedAt: new Date() }).where(eq(users.id, userId));
}

/**
 * Record an activity event from the VS Code extension. The `data` blob is
 * stored as JSON and must never contain file contents.
 */
export async function recordVSCodeActivity(
  userId: number,
  type: string,
  data: Record<string, unknown>,
  timestamp: Date,
) {
  const db = await getDb();
  assertDb(db, "recordVSCodeActivity");

  // `vscodeActivities` is re-exported from server/db/index.ts
  const { vscodeActivities } = await import("@rakshex/database");

  const id = `vsa_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
  await db.insert(vscodeActivities).values({
    id,
    userId,
    type,
    data: data as unknown,
    timestamp,
  });
  return { id };
}
