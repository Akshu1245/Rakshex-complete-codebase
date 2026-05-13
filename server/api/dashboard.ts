import { router, protectedProcedure } from "../_core/trpc";
import * as db from "../db";
import {
  getOrSetCache,
  CACHE_TTL,
  cacheKeys,
  invalidateUserCache,
} from "../_core/cache";

export const dashboardRouter = router({
  getMetrics: protectedProcedure.query(async ({ ctx }) => {
    const cacheKey = cacheKeys.dashboardStats(ctx.user.id);

    const metrics = await getOrSetCache(
      cacheKey,
      CACHE_TTL.DASHBOARD_STATS,
      () => db.getDashboardMetrics(ctx.user.id)
    );
    return metrics;
  }),

  getRecentScans: protectedProcedure.query(async ({ ctx }) => {
    const recentScans = await db.getRecentScans(ctx.user.id, 5);
    return { scans: recentScans };
  }),
});
