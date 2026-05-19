/**
 * Public marketing waitlist router.
 *
 * Captures email signups from the unauthenticated landing page form,
 * stores them in `waitlist_signups`, and fires an admin notification
 * email when SMTP is configured. Idempotent on email — repeated
 * submissions don't duplicate rows or notifications.
 *
 * Rate-limited at the Express layer (see server/_core/index.ts) so we
 * don't need per-router throttling here.
 */

import { z } from "zod";

import * as db from "../db";
import { logger } from "../_core/logger";
import { sendWaitlistAdminNotification } from "../email";
import { publicProcedure, router } from "../_core/trpc";

const emailSchema = z.string().trim().min(3).max(320).email("Please enter a valid email address.");

export const waitlistRouter = router({
  signup: publicProcedure
    .input(
      z.object({
        email: emailSchema,
        source: z.string().max(64).optional(),
        referrer: z.string().max(1024).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const email = input.email.toLowerCase();
      const userAgent =
        typeof ctx.req.headers["user-agent"] === "string"
          ? ctx.req.headers["user-agent"].slice(0, 512)
          : null;
      const ipAddress = typeof ctx.req.ip === "string" ? ctx.req.ip.slice(0, 64) : null;

      let result: { id: number; created: boolean } | null = null;
      try {
        result = await db.insertWaitlistSignup({
          email,
          source: input.source ?? "landing",
          referrer: input.referrer ?? null,
          userAgent,
          ipAddress,
        });
      } catch (err) {
        logger.warn({ err, email }, "[Waitlist] Failed to persist signup — likely DB unavailable");
        // Still succeed from the user's POV — we don't want a DB outage
        // to break the marketing page. The notification email below
        // will still fire if SMTP is configured.
      }

      if (result?.created) {
        try {
          await sendWaitlistAdminNotification({
            email,
            source: input.source ?? "landing",
            referrer: input.referrer ?? null,
            ipAddress,
          });
        } catch (err) {
          logger.warn({ err, email }, "[Waitlist] Failed to send admin notification (non-fatal)");
        }
      }

      return { success: true, alreadySubscribed: result?.created === false };
    }),
});
