import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import {
  getWaitlistGrowthCount,
  registerWaitlistSignup,
  verifyWaitlistEmail,
} from "../services/waitlistGrowth";
import { sendWaitlistVerificationEmail, sendWaitlistVerifiedEmail } from "../waitlistEmail";

function requestIp(req: { ip?: string; headers?: Record<string, unknown> }): string | null {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) return forwarded.split(",")[0]?.trim() ?? null;
  return req.ip ?? null;
}

const shortOptional = (max: number) => z.string().trim().max(max).optional();

export const waitlistRouter = router({
  join: publicProcedure
    .input(
      z.object({
        email: z.string().trim().email().max(320),
        evaluationType: shortOptional(64),
        plan: shortOptional(64),
        role: shortOptional(96),
        company: shortOptional(192),
        agentStage: z.enum(["exploring", "internal", "production"]).optional(),
        providers: z.array(z.string().trim().max(64)).max(12).optional(),
        frameworks: z.array(z.string().trim().max(64)).max(12).optional(),
        monthlySpend: shortOptional(32),
        pain: shortOptional(128),
        pilotInterest: z.enum(["yes", "maybe", "following"]).optional(),
        designPartner: z.boolean().optional(),
        source: shortOptional(128),
        utmSource: shortOptional(128),
        utmMedium: shortOptional(128),
        utmCampaign: shortOptional(192),
        utmContent: shortOptional(192),
        referrer: shortOptional(1024),
        referredByCode: shortOptional(24),
        formStartedAt: z.number().int().positive().optional(),
        website: z.string().max(256).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { plan, ...signupInput } = input;
        const evaluationType = input.evaluationType ?? plan ?? "Private beta";
        const result = await registerWaitlistSignup({
          ...signupInput,
          evaluationType,
          honeypot: input.website,
          ip: requestIp(ctx.req as { ip?: string; headers?: Record<string, unknown> }),
          userAgent:
            typeof ctx.req.headers?.["user-agent"] === "string"
              ? (ctx.req.headers["user-agent"] as string)
              : null,
        });

        if (result.verificationToken && !result.suppressedAsBot) {
          const appUrl = process.env.FRONTEND_URL || process.env.APP_URL || "https://www.rakshex.in";
          const verifyUrl = `${appUrl.replace(/\/$/, "")}/waitlist/verify?token=${encodeURIComponent(result.verificationToken)}`;
          await sendWaitlistVerificationEmail({
            toEmail: result.normalizedEmail,
            verifyUrl,
            evaluationType,
          });
        }

        return { ok: true, pendingVerification: true };
      } catch (error) {
        if (error instanceof Error && error.name === "RateLimitError") {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many waitlist attempts. Please try again shortly.",
          });
        }
        console.error("Waitlist join failed", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to record your request. Please try again shortly.",
        });
      }
    }),

  verify: publicProcedure
    .input(z.object({ token: z.string().min(20).max(256) }))
    .mutation(async ({ input }) => {
      try {
        const result = await verifyWaitlistEmail(input.token);
        const referralUrl = `https://www.rakshex.in/waitlist?ref=${encodeURIComponent(result.referralCode)}&utm_source=referral&utm_medium=member`;

        // Verification is idempotent: side-effect email fires only on the first successful confirm.
        if (!result.alreadyVerified) {
          try {
            await sendWaitlistVerifiedEmail({
              toEmail: result.email,
              referralUrl,
              position: result.position,
            });
          } catch (mailError) {
            console.error("Waitlist verified email failed", mailError);
          }
        }

        return {
          verified: result.verified,
          alreadyVerified: result.alreadyVerified,
          referralCode: result.referralCode,
          referralCount: result.referralCount,
          position: result.position,
          referralUrl,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "INVALID_TOKEN";
        if (message === "EXPIRED_TOKEN") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This verification link has expired. Submit the waitlist form again for a fresh link.",
          });
        }
        if (message === "INVALID_TOKEN") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This verification link is invalid." });
        }
        console.error("Waitlist verification failed", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Unable to verify this request right now.",
        });
      }
    }),

  count: publicProcedure.query(async () => {
    const count = await getWaitlistGrowthCount();
    return { count };
  }),
});
