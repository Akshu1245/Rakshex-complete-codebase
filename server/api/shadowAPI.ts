import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, editorProcedure } from "../_core/trpc";
import * as db from "../db";
import { detectShadowAPIs, type CollectionData } from "../utils/scanning";

export const shadowAPIRouter = router({
  scanShadowAPIs: editorProcedure
    .input(z.object({ collectionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const collection = await db.getCollectionById(input.collectionId);
      if (!collection || collection.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Collection not found or access denied",
        });
      }

      const shadowAPIs = detectShadowAPIs(collection.data as CollectionData);

      const scan = await db.createScanWithShadowAPIs(
        ctx.user.id,
        input.collectionId,
        "shadow_api",
        "completed",
        shadowAPIs.length * 10,
        shadowAPIs.length > 0 ? "HIGH" : "LOW",
        shadowAPIs,
      );

      return {
        scanId: scan.id,
        shadowAPIs,
        totalFound: shadowAPIs.length,
      };
    }),

  listShadowAPIs: protectedProcedure
    .input(
      z.object({
        collectionId: z.string(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ input, ctx }) => {
      const collection = await db.getCollectionById(input.collectionId);
      if (!collection || collection.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Collection not found or access denied",
        });
      }

      const allShadowAPIs = await db.getShadowAPIsByCollectionId(input.collectionId);

      const total = allShadowAPIs.length;
      const paginated = allShadowAPIs.slice(
        (input.page - 1) * input.pageSize,
        input.page * input.pageSize,
      );

      return {
        shadowAPIs: paginated.map((api) => ({
          id: api.id,
          endpoint: api.endpoint,
          method: api.method,
          riskLevel: api.riskLevel,
          reason: api.reason,
          recommendation: api.recommendation,
          isDocumented: api.isDocumented,
        })),
        total,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(total / input.pageSize),
      };
    }),

  markAsDocumented: protectedProcedure
    .input(z.object({ shadowApiId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const shadowApi = await db.getShadowAPIById(input.shadowApiId);
      if (!shadowApi || shadowApi.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Shadow API not found or access denied",
        });
      }
      await db.markShadowAPIDocumented(input.shadowApiId);
      return { success: true };
    }),
});
