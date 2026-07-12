/**
 * Collections, scans, findings and token-usage queries.
 *
 * This file is part of the `server/db/queries/*` split; `server/db.ts`
 * retains the canonical implementations for callers that import from
 * `../db`. Both paths are kept in sync and delegate to the same Drizzle
 * tables.
 */
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { collections, findings, scans, tokenUsage } from "@rakshex/database";
import { getDb } from "..";
import { assertDb, ForbiddenError, NotFoundError } from "../../_core/errors";

/**
 * All collections owned by a user, newest first.
 */
export async function getCollectionsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(collections)
    .where(eq(collections.userId, userId))
    .orderBy(desc(collections.createdAt));
}

/**
 * Recent scans across all collections the user owns, newest first.
 * Joins against `collections` so we can scope by `collections.userId`.
 */
export async function getRecentScansForUser(userId: number, limit: number) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      id: scans.id,
      collectionId: scans.collectionId,
      status: scans.status,
      totalFindings: scans.totalFindings,
      riskScore: scans.riskScore,
      riskLevel: scans.riskLevel,
      completedAt: scans.completedAt,
      createdAt: scans.createdAt,
    })
    .from(scans)
    .innerJoin(collections, eq(scans.collectionId, collections.id))
    .where(eq(collections.userId, userId))
    .orderBy(desc(scans.createdAt))
    .limit(limit);

  return rows;
}

/**
 * Per-day token usage for a user over the last `days` days.
 */
export async function getTokenUsageByUserId(userId: number, days: number) {
  const db = await getDb();
  if (!db) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return db
    .select()
    .from(tokenUsage)
    .where(and(eq(tokenUsage.userId, userId), gte(tokenUsage.date, startDate)))
    .orderBy(desc(tokenUsage.date));
}

/**
 * Count of open findings for a user across all of their collections.
 */
export async function getOpenFindingsCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(findings)
    .where(and(eq(findings.userId, userId), eq(findings.status, "open")));

  return Number(result[0]?.count ?? 0);
}

/**
 * Recent findings for a user, newest first. Joins `collections` so callers
 * can render the collection name alongside each finding. Filters to
 * `open` and `in-progress` so "resolved" findings stay out of the
 * status-bar / tree-view surfaces.
 */
export async function getRecentFindingsForUser(userId: number, limit: number) {
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
      createdAt: findings.createdAt,
    })
    .from(findings)
    .leftJoin(collections, eq(findings.collectionId, collections.id))
    .where(eq(findings.userId, userId))
    .orderBy(desc(findings.createdAt))
    .limit(limit);

  return rows
    .filter((r) => r.status === "open" || r.status === "in-progress")
    .map((r) => ({
      ...r,
      collectionName: r.collectionName ?? "Unknown",
    }));
}

/**
 * Update a finding's status, enforcing that `userId` actually owns the
 * finding (by joining through `collections` → `scans` → `findings` via
 * the `findings.userId` column that we already denormalize on insert).
 */
export async function updateFindingStatus(
  findingId: string,
  status: "open" | "in-progress" | "resolved",
  userId: number,
) {
  const db = await getDb();
  assertDb(db, "updateFindingStatus");

  const existing = await db
    .select({ id: findings.id, userId: findings.userId })
    .from(findings)
    .where(eq(findings.id, findingId))
    .limit(1);

  if (existing.length === 0) {
    throw new NotFoundError("Finding not found");
  }
  if (existing[0].userId !== userId) {
    // Don't leak existence — same response as not-found from the client
    // perspective, but logged distinctly.
    throw new ForbiddenError("Access denied", {
      context: { findingId, userId },
    });
  }

  await db.update(findings).set({ status }).where(eq(findings.id, findingId));

  return { success: true };
}
