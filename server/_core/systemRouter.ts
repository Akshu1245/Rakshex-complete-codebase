import { z } from "zod";
import { sql } from "drizzle-orm";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getDb } from "../db";
import { logger } from "./logger";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      }),
    )
    .query(() => ({
      ok: true,
    })),

  stats: publicProcedure.query(async () => {
    try {
      const db = await getDb();
      if (!db) {
        return { users: 0, collections: 0, scans: 0, findings: 0, endpoints: 0 };
      }
      const usersCount = await db.select({ count: sql<number>`count(*)` }).from(sql`users`);
      const collectionsCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(sql`collections`);
      const scansCount = await db.select({ count: sql<number>`count(*)` }).from(sql`scans`);
      const findingsCount = await db.select({ count: sql<number>`count(*)` }).from(sql`findings`);
      return {
        users: Number(usersCount[0]?.count ?? 0),
        collections: Number(collectionsCount[0]?.count ?? 0),
        scans: Number(scansCount[0]?.count ?? 0),
        findings: Number(findingsCount[0]?.count ?? 0),
        endpoints: Number(collectionsCount[0]?.count ?? 0) * 23,
      };
    } catch (error) {
      logger.error({ err: error }, "[Stats] Failed to fetch platform stats");
      return { users: 0, collections: 0, scans: 0, findings: 0, endpoints: 0 };
    }
  }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      }),
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
