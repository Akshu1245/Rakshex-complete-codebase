import { z } from "zod";
import { TRPCError } from "@trpc/server";
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
      const email = input.email.trim().toLowerCase();
      const plan = input.plan ?? "Free";
      const source = input.source ?? "landing_page";
      const database = await db.getDb();

      if (!database) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to record your request. Please try again shortly.",
        });
      }

      const { waitlist } = await import("@rakshex/database");
      let alreadyExists = false;

      try {
        await database.insert(waitlist).values({ email, plan, source });
      } catch (err: unknown) {
        // PostgreSQL unique_violation: the address is already on the waitlist.
        // Treat duplicate joins as an idempotent success rather than surfacing
        // the historical MySQL ER_DUP_ENTRY behavior as a 500.
        if ((err as { code?: string } | null)?.code === "23505") {
          alreadyExists = true;
        } else {
          console.error("Error recording waitlist request:", err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Unable to record your request. Please try again shortly.",
          });
        }
      }

      if (!alreadyExists) {
        // Send automated confirmation email to user & internal notification to Akshay.
        // Email is optional during private beta, so a mail failure must not undo
        // a successfully persisted waitlist request.
        try {
          await sendWaitlistConfirmationEmail(email, plan);
        } catch (err) {
          console.error("Error sending waitlist confirmation/notification emails:", err);
        }
      }

      return { success: true, alreadyExists, email };
    }),

  count: publicProcedure.query(async () => {
    const count = await db.getWaitlistCount();
    return { count };
  }),
});
