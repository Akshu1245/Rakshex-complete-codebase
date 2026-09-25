/**
 * MailChannels via fetch — replaces nodemailer/SMTP (apps/api/email.ts).
 *
 * Fail-closed semantics (mirrors apps/api/email.failClosed.test.ts):
 * if MAILCHANNELS_FROM is not configured, sendMail THROWS instead of
 * silently succeeding. No silent drops, ever.
 */
import type { Env } from "../env";

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendMail(
  env: Env,
  input: SendMailInput,
): Promise<{ ok: true; messageId: string }> {
  const from = env.MAILCHANNELS_FROM?.trim();
  if (!from) {
    throw new Error(
      "Mail is not configured (MAILCHANNELS_FROM unset) — refusing to send fail-open",
    );
  }
  if (!EMAIL_RE.test(input.to)) throw new Error("Invalid recipient email");
  if (!input.subject.trim()) throw new Error("Email subject is required");

  const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to }] }],
      from: { email: from, name: "RaksHex" },
      subject: input.subject,
      content: [
        { type: "text/plain", value: input.text },
        ...(input.html ? [{ type: "text/html", value: input.html }] : []),
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`MailChannels send failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const requestId = res.headers.get("x-message-id") ?? `mc-${Date.now()}`;
  return { ok: true, messageId: requestId };
}
