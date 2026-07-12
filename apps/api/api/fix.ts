import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";

export const fixRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const collections = await db.getCollectionsByUserId(ctx.user.id);
    if (!collections.length) return [];
    const latestScans = await db.getScansByCollectionId(collections[0].id);
    const scan = latestScans[0];
    if (!scan) return [];
    return db.getFindingsByScanId(scan.id);
  }),

  resolve: protectedProcedure
    .input(z.object({ findingId: z.string() }))
    .mutation(async ({ input }) => {
      await db.updateFindingStatus(input.findingId, "resolved");
      return { success: true };
    }),
});
