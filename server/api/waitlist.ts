import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import * as db from "../db";

export const waitlistRouter = router({
  join: publicProcedure
    .input(z.object({ email: z.string().email(), source: z.string().optional() }))
    .mutation(async ({ input }) => {
      const result = await db.addWaitlistEmail(input.email, input.source ?? "landing_page");
      return result;
    }),

  count: publicProcedure.query(async () => {
    const count = await db.getWaitlistCount();
    return { count };
  }),
});
