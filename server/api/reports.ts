import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { scanReports } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export const reportsRouter = router({
  create: publicProcedure
    .input(
      z.object({
        score: z.number().min(0).max(100),
        findings: z.array(
          z.object({
            title: z.string(),
            severity: z.enum(["Critical", "High", "Medium", "Low"]),
            endpoint: z.string(),
            description: z.string().optional(),
            remediation: z.string().optional(),
          }),
        ),
        filename: z.string().optional(),
        endpoints: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const reportId = nanoid(12);
      await db.insert(scanReports).values({
        id: reportId,
        score: input.score,
        findings: input.findings,
        filename: input.filename ?? null,
        endpoints: input.endpoints ?? null,
      });

      return {
        reportId,
        url: `https://rakshex.in/report/${reportId}`,
      };
    }),

  getById: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    const [report] = await db
      .select()
      .from(scanReports)
      .where(eq(scanReports.id, input.id))
      .limit(1);

    if (!report) {
      return null;
    }

    // Increment view count
    await db
      .update(scanReports)
      .set({ viewCount: (report.viewCount ?? 0) + 1 })
      .where(eq(scanReports.id, input.id));

    return report;
  }),
});
