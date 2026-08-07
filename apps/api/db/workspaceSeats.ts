/**
 * Workspace seat entitlements — members + pending invites vs plan limits.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  workspaceEntitlements,
  workspaceMembers,
  workspaceInvitations,
  type InsertWorkspaceEntitlement,
  type WorkspaceEntitlement,
} from "@rakshex/database";
import { getDb } from "../db";

function assertDb<T>(db: T | null | undefined): asserts db is T {
  if (!db) throw new Error("Database unavailable");
}

export function effectiveSeatLimit(ent: WorkspaceEntitlement): number {
  if (ent.overrideSeats != null && ent.overrideSeats > 0) return ent.overrideSeats;
  return ent.includedSeats + ent.purchasedSeats;
}

export async function getWorkspaceEntitlement(
  workspaceId: number,
): Promise<WorkspaceEntitlement | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(workspaceEntitlements)
    .where(eq(workspaceEntitlements.workspaceId, workspaceId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertWorkspaceEntitlement(row: InsertWorkspaceEntitlement): Promise<void> {
  const db = await getDb();
  assertDb(db);
  await db
    .insert(workspaceEntitlements)
    .values(row)
    .onConflictDoUpdate({
      target: workspaceEntitlements.workspaceId,
      set: {
        plan: row.plan,
        status: row.status,
        includedSeats: row.includedSeats,
        purchasedSeats: row.purchasedSeats,
        overrideSeats: row.overrideSeats,
        billingProvider: row.billingProvider,
        billingCustomerId: row.billingCustomerId,
        billingSubscriptionId: row.billingSubscriptionId,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        graceExpiresAt: row.graceExpiresAt,
        metadata: row.metadata,
        updatedAt: new Date(),
      },
    });
}

export async function countReservedSeats(workspaceId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [memberRows, inviteRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.active, true),
          isNull(workspaceMembers.suspendedAt),
          isNull(workspaceMembers.deactivatedAt),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.workspaceId, workspaceId),
          eq(workspaceInvitations.status, "pending"),
        ),
      ),
  ]);
  return (memberRows[0]?.count ?? 0) + (inviteRows[0]?.count ?? 0);
}

export async function assertSeatAvailable(workspaceId: number): Promise<void> {
  const ent = await getWorkspaceEntitlement(workspaceId);
  const limit = ent ? effectiveSeatLimit(ent) : 1;
  const used = await countReservedSeats(workspaceId);
  if (used >= limit) {
    const err = new Error(`Seat limit reached (${used}/${limit})`);
    (err as Error & { code: string }).code = "SEAT_LIMIT";
    throw err;
  }
}
