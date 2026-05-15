import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";

export const githubRouter = router({
  listScans: protectedProcedure.query(async ({ ctx }) => {
    const collections = await db.getCollectionsByUserId(ctx.user.id);
    const collectionIds = collections.map((c: any) => c.id);
    const allScans: any[] = [];
    for (const cid of collectionIds) {
      const scans = await db.getScansByCollectionId(cid);
      allScans.push(...scans);
    }
    return allScans
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);
  }),

  getScan: protectedProcedure.input(z.object({ scanId: z.string() })).query(async ({ input }) => {
    const scan = await db.getScanById(input.scanId);
    if (!scan) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Scan not found" });
    }
    return scan;
  }),
});
