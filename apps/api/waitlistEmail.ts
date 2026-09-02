import nodemailer from "nodemailer";
import { ENV } from "./_core/env";
import { logger } from "./_core/logger";

function waitlistTransport() {
  if (!ENV.smtpHost || !ENV.smtpUser || !ENV.smtpPass) {
    if (ENV.isProduction) {
      throw new Error("SMTP is not configured for waitlist email delivery");
    }
    return null;
  }
  return {
    from: ENV.smtpFrom || "noreply@rakshex.in",
    transport: nodemailer.createTransport({
      host: ENV.smtpHost,
      port: ENV.smtpPort,
      secure: ENV.smtpPort === 465,
      auth: { user: ENV.smtpUser, pass: ENV.smtpPass },
    }),
  };
}

export async function sendWaitlistVerificationEmail(opts: {
  toEmail: string;
  verifyUrl: string;
  evaluationType: string;
}): Promise<void> {
  const config = waitlistTransport();
  if (!config) {
    logger.info(`[Waitlist] Would send verification email to ${opts.toEmail}: ${opts.verifyUrl}`);
    return;
  }

  const subject = "Confirm your RaksHex private-beta spot";
  const html = `<!doctype html>
<html><body style="margin:0;background:#070a0f;color:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;padding:36px 16px;">
<div style="max-width:560px;margin:0 auto;background:#0b111b;border:1px solid #1f2937;border-radius:14px;overflow:hidden;">
  <div style="padding:28px 30px;border-bottom:1px solid #1f2937;">
    <div style="font-size:21px;font-weight:750;color:#fff;">RaksHex</div>
    <div style="margin-top:6px;font-size:13px;color:#8fe3d8;">Private beta · AI action control plane</div>
  </div>
  <div style="padding:30px;">
    <h1 style="margin:0 0 14px;font-size:23px;color:#fff;">Confirm your beta request</h1>
    <p style="margin:0 0 18px;line-height:1.65;color:#cbd5e1;">We received your request for <strong>${opts.evaluationType}</strong>. Confirm that this email belongs to you before the request counts as verified traction.</p>
    <a href="${opts.verifyUrl}" style="display:inline-block;background:#14b8a6;color:white;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:8px;">Review and confirm my spot →</a>
    <p style="margin:20px 0 0;font-size:13px;line-height:1.55;color:#94a3b8;">The link opens a confirmation page first; it does not confirm you automatically. This protects the link from corporate email scanners and browser prefetchers.</p>
    <p style="margin:14px 0 0;font-size:13px;line-height:1.55;color:#64748b;">Gmail, Outlook, Yahoo, Proton and work email addresses are all welcome. No pricing or checkout is required for the private beta.</p>
  </div>
  <div style="padding:18px 30px;border-top:1px solid #1f2937;color:#64748b;font-size:12px;">If you did not request RaksHex beta access, ignore this message.</div>
</div></body></html>`;

  await config.transport.sendMail({
    from: `"RaksHex" <${config.from}>`,
    to: opts.toEmail,
    subject,
    html,
  });
  logger.info(`[Waitlist] Verification email sent to ${opts.toEmail}`);
}

export async function sendWaitlistVerifiedEmail(opts: {
  toEmail: string;
  referralUrl: string;
  position: number;
}): Promise<void> {
  const config = waitlistTransport();
  if (!config) return;
  const subject = "Your RaksHex beta request is verified";
  const html = `<!doctype html><html><body style="margin:0;background:#070a0f;color:#e5e7eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;padding:36px 16px;">
<div style="max-width:560px;margin:0 auto;background:#0b111b;border:1px solid #1f2937;border-radius:14px;padding:30px;">
<h1 style="margin:0 0 14px;color:#fff;font-size:23px;">You're verified.</h1>
<p style="line-height:1.65;color:#cbd5e1;">Your current verified queue position is <strong>#${opts.position}</strong>. We prioritize production-agent teams and high-signal design-partner requests, not just raw referral counts.</p>
<p style="line-height:1.65;color:#cbd5e1;">If another relevant AI/agent builder would genuinely benefit from RaksHex, you can share your referral link:</p>
<p style="word-break:break-all;background:#0f172a;border:1px solid #1e293b;padding:12px;border-radius:8px;color:#8fe3d8;">${opts.referralUrl}</p>
<p style="margin-top:22px;color:#94a3b8;font-size:13px;">Next step: explore the public demo or docs at rakshex.in. We will contact strong-fit beta requests directly. There is no pricing link in this beta email.</p>
</div></body></html>`;
  await config.transport.sendMail({
    from: `"RaksHex" <${config.from}>`,
    to: opts.toEmail,
    subject,
    html,
  });
}
