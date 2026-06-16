import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import * as db from "../db";
import { sendWaitlistConfirmationEmail } from "../email";

export const waitlistRouter = router({
  join: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        plan: z.string().optional(),
        source: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const plan = input.plan ?? "Free";
      const source = input.source ?? "landing_page";
      const result = await db.addWaitlistEmail(input.email, plan, source);

      if (result.success && !result.alreadyExists) {
        // Send automated confirmation email to user & internal notification to Akshay
        try {
          await sendWaitlistConfirmationEmail(input.email, plan);
        } catch (err) {
          console.error("Error sending waitlist confirmation/notification emails:", err);
        }
      }
      return result;
    }),

  count: publicProcedure.query(async () => {
    const count = await db.getWaitlistCount();
    return { count };
  }),
});
