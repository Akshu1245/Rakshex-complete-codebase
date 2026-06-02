/**
 * Notifications Router — in-app notification feed + unread badge.
 *
 * Backed by the `notifications` table. Other services create notifications via
 * the exported `createNotification` helper (e.g. scan complete, cost anomaly,
 * security alert, billing, team invite).
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { notifications, type InsertNotification } from "../../drizzle/schema";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { logger } from "../_core/logger";

export const NOTIFICATION_TYPES = [
  "scan_complete",
  "anomaly",
  "security",
  "billing",
  "team",
  "system",
] as const;

/**
 * Persist a notification for a user. Safe to call from any service — failures
 * are logged and swallowed so notification writes never break the main flow.
 */
export async function createNotification(input: {
  userId: number;
  type: (typeof NOTIFICATION_TYPES)[number];
  title: string;
  body: string;
  link?: string;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const row: InsertNotification = {
      userId: input.userId,
      type: input.type,
      title: input.title.slice(0, 200),
      body: input.body,
      link: input.link ?? null,
    };
    await db.insert(notifications).values(row);
  } catch (err) {
    logger.warn({ err }, "[Notifications] failed to create notification");
  }
}

export const notificationsRouter = router({
  /** Paginated feed (cursor = id of the last row from the previous page). */
  list: protectedProcedure
    .input(
      z
        .object({
          cursor: z.number().int().positive().optional(),
          limit: z.number().int().min(1).max(50).default(20),
          unreadOnly: z.boolean().default(false),
        })
        .default({ limit: 20, unreadOnly: false }),
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { items: [], nextCursor: undefined as number | undefined };

      const conditions = [eq(notifications.userId, ctx.user.id)];
      if (input.unreadOnly) conditions.push(eq(notifications.read, false));
      if (input.cursor) conditions.push(lt(notifications.id, input.cursor));

      const rows = await db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.id))
        .limit(input.limit + 1);

      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;
      return {
        items,
        nextCursor: hasMore ? items[items.length - 1].id : undefined,
      };
    }),

  /** Count of unread notifications for the bell badge. */
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { count: 0 };
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, ctx.user.id), eq(notifications.read, false)));
    return { count: row?.count ?? 0 };
  }),

  /** Mark a single notification read (scoped to the caller). */
  markRead: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false };
      await db
        .update(notifications)
        .set({ read: true })
        .where(and(eq(notifications.id, input.id), eq(notifications.userId, ctx.user.id)));
      return { success: true };
    }),

  /** Mark all of the caller's notifications read. */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { success: false };
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, ctx.user.id), eq(notifications.read, false)));
    return { success: true };
  }),
});
