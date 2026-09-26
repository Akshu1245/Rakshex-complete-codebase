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
    "Hi there,",
    "",
    "Welcome to the RaksHex family — you're on the private-beta waitlist.",
    "",
    "RaksHex is the Agent Firewall: the enforcement boundary for consequential AI-agent actions. Before your agent executes something that matters — a refund, a deploy, a merge — RaksHex evaluates it against your policy and returns ALLOW, DENY, or APPROVAL_REQUIRED, with signed, tamper-evident receipts for every decision.",
    "",
    "What happens next:",
    "- We'll reach out personally about a scoped evaluation: one agent, one consequential action.",
    "- You don't need to connect any production credentials to evaluate.",
    "- RaksHex is in private beta. There is no self-serve checkout — invited teams get a scoped evaluation workspace.",
    "",
    "Try the public demo in the meantime:",
    "https://rakshex-web.rakshex.workers.dev/demo",
    "",
    "— Akshay",
    "Founder, RaksHex",
  ].join("\n");
  const html = [
    "<p>Hi there,</p>",
    "<p><strong>Welcome to the RaksHex family</strong> — you're on the private-beta waitlist.</p>",
    "<p>RaksHex is the Agent Firewall: the enforcement boundary for consequential AI-agent actions. Before your agent executes something that matters — a refund, a deploy, a merge — RaksHex evaluates it against your policy and returns ALLOW, DENY, or APPROVAL_REQUIRED, with signed, tamper-evident receipts for every decision.</p>",
    "<p><strong>What happens next:</strong></p>",
    "<ul>",
    "<li>We&rsquo;ll reach out personally about a scoped evaluation: one agent, one consequential action.</li>",
    "<li>You don&rsquo;t need to connect any production credentials to evaluate.</li>",
    "<li>RaksHex is in private beta. There is no self-serve checkout &mdash; invited teams get a scoped evaluation workspace.</li>",
    "</ul>",
    '<p>Try the public demo in the meantime:<br><a href="https://rakshex-web.rakshex.workers.dev/demo">rakshex-web.rakshex.workers.dev/demo</a></p>',
    "<p>&mdash; Akshay<br>Founder, RaksHex</p>",
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
