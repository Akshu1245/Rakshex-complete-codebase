/**
 * POST /v1/waitlist — private-beta waitlist signup.
 *
 * Stores the email in D1 (unique) and sends a welcome email via the
 * MailChannels adapter. Mail failures never fail the signup: the response
 * reports `emailSent` honestly so nothing is ever pretended sent.
 */
import { Hono } from "hono";
import { createDb } from "../db";
import { waitlist } from "../schema";
import { sendMail } from "../adapters/mail";
import type { Env } from "../env";

export const app = new Hono<{ Bindings: Env }>();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Must match EVALUATION_OPTIONS values in apps/web/app/waitlist/page.tsx. */
const PLANS = ["Free", "Pro", "Enterprise"] as const;

export interface ValidWaitlistInput {
  email: string;
  plan: (typeof PLANS)[number];
}

export function validateWaitlistInput(
  body: unknown,
): { ok: true; input: ValidWaitlistInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be JSON" };
  }
  const { email, plan } = body as { email?: unknown; plan?: unknown };
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return { ok: false, error: "A valid email address is required" };
  }
  const validPlan =
    typeof plan === "string" && (PLANS as readonly string[]).includes(plan)
      ? (plan as (typeof PLANS)[number])
      : null;
  if (validPlan === null) {
    return { ok: false, error: `plan must be one of: ${PLANS.join(", ")}` };
  }
  return { ok: true, input: { email: email.trim().toLowerCase(), plan: validPlan } };
}

export interface WelcomeEmail {
  subject: string;
  text: string;
  html: string;
}

/**
 * Welcome email copy. Honest by construction: private beta, no self-serve
 * checkout, no invented users/metrics/testimonials. Keep it that way.
 */
export function buildWelcomeEmail(): WelcomeEmail {
  const subject = "Welcome to the RaksHex family";
  const text = [
    "Hey,",
    "",
    "Thanks for joining the RaksHex waitlist.",
    "",
    "We’re building RaksHex to give teams more control over what AI agents are allowed to do — especially when real actions, permissions, and money are involved.",
    "",
    "We’re still building this carefully, and we’d rather work closely with a small number of teams than rush something out.",
    "",
    "As we open early access, I’ll reach out personally with the details.",
    "",
    "In the meantime, if you’re already running AI agents in production, I’d genuinely love to hear what you’re building and what makes you nervous about giving those agents more autonomy.",
    "",
    "Just reply to this email — I read every response.",
    "",
    "Thanks for being early.",
    "",
    "Akshay",
    "Founder, RaksHex",
    "rakshex.in",
  ].join("\n");
  const html = [
    "<p>Hey,</p>",
    "<p>Thanks for joining the RaksHex waitlist.</p>",
    "<p>We&rsquo;re building RaksHex to give teams more control over what AI agents are allowed to do &mdash; especially when real actions, permissions, and money are involved.</p>",
    "<p>We&rsquo;re still building this carefully, and we&rsquo;d rather work closely with a small number of teams than rush something out.</p>",
    "<p>As we open early access, I&rsquo;ll reach out personally with the details.</p>",
    "<p>In the meantime, if you&rsquo;re already running AI agents in production, I&rsquo;d genuinely love to hear what you&rsquo;re building and what makes you nervous about giving those agents more autonomy.</p>",
    "<p>Just reply to this email &mdash; I read every response.</p>",
    "<p>Thanks for being early.</p>",
    "<p>Akshay<br>Founder, RaksHex<br>rakshex.in</p>",
  ].join("\n");
  return { subject, text, html };
}

/**
 * Abuse guard: the endpoint writes to D1 and spends mail sends, so an
 * unthrottled endpoint is a spam vector. Best-effort per-isolate bucket
 * (10 signups / 60s / client IP), same shape as the demo route.
 */
const JOIN_LIMIT = 10;
const JOIN_WINDOW_MS = 60_000;
const joinHits = new Map<string, number[]>();

function joinRateLimited(ip: string): boolean {
  const now = Date.now();
  const fresh = (joinHits.get(ip) ?? []).filter((t) => now - t < JOIN_WINDOW_MS);
  if (fresh.length >= JOIN_LIMIT) {
    joinHits.set(ip, fresh);
    return true;
  }
  fresh.push(now);
  if (joinHits.size > 5000) joinHits.clear();
  joinHits.set(ip, fresh);
  return false;
}

app.post("/", async (c) => {
  const clientIp = c.req.header("cf-connecting-ip") ?? "unknown";
  if (joinRateLimited(clientIp)) {
    return c.json({ ok: false, error: "Too many requests, try again shortly" }, 429);
  }

  let body: unknown = null;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "Request body must be JSON" }, 400);
  }
  const validated = validateWaitlistInput(body);
  if (!validated.ok) {
    return c.json({ ok: false, error: validated.error }, 400);
  }
  const { email, plan } = validated.input;

  const db = createDb(c.env);
  let alreadyExists = false;
  try {
    const rows = await db
      .insert(waitlist)
      .values({ email, plan, source: "web", createdAt: Date.now() })
      .onConflictDoNothing()
      .returning({ id: waitlist.id });
    alreadyExists = rows.length === 0;
  } catch (err) {
    return c.json({ ok: false, error: "Unable to record your request, please try again" }, 500);
  }

  // Welcome email: best-effort. A mail failure must not lose the signup;
  // emailSent is reported honestly and never pretended.
  let emailSent = false;
  if (!alreadyExists) {
    try {
      const welcome = buildWelcomeEmail();
      await sendMail(c.env, { to: email, ...welcome });
      emailSent = true;
    } catch {
      emailSent = false;
    }
  }

  return c.json({ ok: true, alreadyExists, emailSent, email, plan });
});
