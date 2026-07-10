/**
 * Email Service
 * Uses nodemailer with SMTP for real email delivery.
 * Falls back to console logging when SMTP is not configured.
 */
import nodemailer from "nodemailer";
import { logger } from "./_core/logger";
import { ENV } from "./_core/env";

interface TeamInviteEmailOptions {
  toEmail: string;
  inviterName: string;
  role: "admin" | "editor" | "viewer";
}

interface PasswordResetEmailOptions {
  toEmail: string;
  resetUrl: string;
  expiresInHours: number;
}

interface WelcomeEmailOptions {
  toEmail: string;
  userName: string;
}

interface ScanCompleteEmailOptions {
  toEmail: string;
  userName: string;
  collectionName: string;
  scanDate: string;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  dashboardUrl: string;
}

interface BudgetWarningEmailOptions {
  toEmail: string;
  userName: string;
  currentSpend: number;
  budgetLimit: number;
  percentUsed: number;
  dashboardUrl: string;
}

interface KillSwitchRecoveryEmailOptions {
  toEmail: string;
  userName: string;
  resetAt: string;
  newBudgetLimit: number;
  dashboardUrl: string;
}

interface PaymentFailedEmailOptions {
  toEmail: string;
  userName: string;
  amount: number;
  currency: string;
  retryUrl: string;
  downgradeWarning: boolean;
}

function createTransport() {
  const smtpHost = ENV.smtpHost;
  const smtpPort = ENV.smtpPort;
  const smtpUser = ENV.smtpUser;
  const smtpPass = ENV.smtpPass;
  const smtpFrom = ENV.smtpFrom || "noreply@devpulse.ai";

  if (!smtpHost || !smtpUser || !smtpPass) {
    return null; // No SMTP configured
  }

  return {
    transport: nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    }),
    from: smtpFrom,
  };
}

export async function sendTeamInviteEmail(
  opts: TeamInviteEmailOptions & { token?: string },
): Promise<void> {
  const appUrl = process.env.APP_URL || "https://devpulse.ai";
  const inviteUrl = opts.token ? `${appUrl}/invite/${opts.token}` : appUrl;
  const subject = `You've been invited to Rakshex by ${opts.inviterName}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Rakshex Invitation</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background:#f9fafb; margin:0; padding:40px 0;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8); padding:32px; text-align:center;">
      <h1 style="color:#fff; margin:0; font-size:24px; letter-spacing:-0.5px;">Rakshex</h1>
      <p style="color:#bfdbfe; margin:8px 0 0; font-size:14px;">API Security & LLM Intelligence Platform</p>
    </div>
    <div style="padding:40px 32px;">
      <h2 style="color:#111827; font-size:20px; margin:0 0 16px;">You've been invited!</h2>
      <p style="color:#374151; line-height:1.6; margin:0 0 24px;">
        <strong>${opts.inviterName}</strong> has invited you to join their Rakshex workspace as a <strong>${opts.role}</strong>.
      </p>
      <div style="background:#f3f4f6; border-radius:8px; padding:16px; margin:0 0 28px;">
        <p style="color:#6b7280; font-size:13px; margin:0 0 4px; text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">Your Role</p>
        <p style="color:#111827; font-size:18px; font-weight:700; margin:0; text-transform:capitalize;">${opts.role}</p>
        <p style="color:#6b7280; font-size:12px; margin:6px 0 0;">
          ${
            opts.role === "admin"
              ? "Full access to all features and team management"
              : opts.role === "editor"
                ? "Manage collections, run scans, and view reports"
                : "Read-only access to collections and reports"
          }
        </p>
      </div>
      <a href="${inviteUrl}" style="display:block; background:#2563eb; color:#fff; text-decoration:none; padding:14px 24px; border-radius:8px; text-align:center; font-weight:600; font-size:16px;">
        Accept Invitation →
      </a>
      <p style="color:#9ca3af; font-size:12px; margin:24px 0 0; text-align:center;">
        If you weren't expecting this invitation, you can safely ignore this email.
      </p>
    </div>
    <div style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:20px 32px; text-align:center;">
      <p style="color:#9ca3af; font-size:12px; margin:0;">
        © ${new Date().getFullYear()} Rakshex. API Security Made Simple.
      </p>
    </div>
  </div>
</body>
</html>`;

  const config = createTransport();

  if (!config) {
    // Log to console when SMTP not configured (dev mode)
    logger.info(`[Email] SMTP not configured. Would have sent invite to: ${opts.toEmail}`);
    logger.info(`[Email] Subject: ${subject}`);
    return;
  }

  await config.transport.sendMail({
    from: `"Rakshex" <${config.from}>`,
    to: opts.toEmail,
    subject,
    html,
  });

  logger.info(`[Email] Invite sent to ${opts.toEmail}`);
}

export async function sendPasswordResetEmail(opts: PasswordResetEmailOptions): Promise<void> {
  const subject = "Reset your Rakshex password";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Reset Your Password</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background:#f9fafb; margin:0; padding:40px 0;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8); padding:32px; text-align:center;">
      <h1 style="color:#fff; margin:0; font-size:24px; letter-spacing:-0.5px;">Rakshex</h1>
      <p style="color:#bfdbfe; margin:8px 0 0; font-size:14px;">API Security & LLM Intelligence Platform</p>
    </div>
    <div style="padding:40px 32px;">
      <h2 style="color:#111827; font-size:20px; margin:0 0 16px;">Reset your password</h2>
      <p style="color:#374151; line-height:1.6; margin:0 0 24px;">
        We received a request to reset your password. Click the button below to create a new password. This link will expire in <strong>${opts.expiresInHours} hours</strong>.
      </p>
      <a href="${opts.resetUrl}" style="display:block; background:#2563eb; color:#fff; text-decoration:none; padding:14px 24px; border-radius:8px; text-align:center; font-weight:600; font-size:16px;">
        Reset Password →
      </a>
      <p style="color:#6b7280; line-height:1.5; margin:24px 0 0; font-size:14px;">
        If you didn't request a password reset, you can safely ignore this email. Your password won't be changed.
      </p>
      <p style="color:#9ca3af; font-size:12px; margin:16px 0 0;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <span style="word-break:break-all;">${opts.resetUrl}</span>
      </p>
    </div>
    <div style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:20px 32px; text-align:center;">
      <p style="color:#9ca3af; font-size:12px; margin:0;">
        © ${new Date().getFullYear()} Rakshex. API Security Made Simple.
      </p>
    </div>
  </div>
</body>
</html>`;

  const config = createTransport();

  if (!config) {
    logger.info(`[Email] SMTP not configured. Would have sent password reset to: ${opts.toEmail}`);
    logger.info(`[Email] Reset URL: ${opts.resetUrl}`);
    return;
  }

  await config.transport.sendMail({
    from: `"Rakshex" <${config.from}>`,
    to: opts.toEmail,
    subject,
    html,
  });

  logger.info(`[Email] Password reset sent to ${opts.toEmail}`);
}

export async function sendWelcomeEmail(opts: WelcomeEmailOptions): Promise<void> {
  const appUrl = process.env.APP_URL || "https://devpulse.ai";
  const subject = "Welcome to Rakshex!";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Welcome to Rakshex</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background:#f9fafb; margin:0; padding:40px 0;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8); padding:32px; text-align:center;">
      <h1 style="color:#fff; margin:0; font-size:24px; letter-spacing:-0.5px;">Welcome to Rakshex!</h1>
      <p style="color:#bfdbfe; margin:8px 0 0; font-size:14px;">API Security & LLM Intelligence Platform</p>
    </div>
    <div style="padding:40px 32px;">
      <h2 style="color:#111827; font-size:20px; margin:0 0 16px;">Hello ${opts.userName || "there"}!</h2>
      <p style="color:#374151; line-height:1.6; margin:0 0 24px;">
        Thanks for joining Rakshex. You're now part of a community of developers who take API security seriously.
      </p>
      <div style="background:#f3f4f6; border-radius:8px; padding:16px; margin:0 0 28px;">
        <p style="color:#6b7280; font-size:13px; margin:0 0 8px; text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">Quick Start</p>
        <ul style="color:#374151; font-size:14px; margin:0; padding-left:20px; line-height:1.8;">
          <li>Import your first API collection</li>
          <li>Run a security scan</li>
          <li>Set up your kill switch for budget protection</li>
          <li>Invite your team members</li>
        </ul>
      </div>
      <a href="${appUrl}/onboarding" style="display:block; background:#2563eb; color:#fff; text-decoration:none; padding:14px 24px; border-radius:8px; text-align:center; font-weight:600; font-size:16px;">
        Get Started →
      </a>
      <p style="color:#6b7280; line-height:1.5; margin:24px 0 0; font-size:14px;">
        Need help? Reply to this email or visit our <a href="${appUrl}/docs" style="color:#2563eb; text-decoration:none;">documentation</a>.
      </p>
    </div>
    <div style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:20px 32px; text-align:center;">
      <p style="color:#9ca3af; font-size:12px; margin:0;">
        © ${new Date().getFullYear()} Rakshex. API Security Made Simple.
      </p>
    </div>
  </div>
</body>
</html>`;

  const config = createTransport();

  if (!config) {
    logger.info(`[Email] SMTP not configured. Would have sent welcome email to: ${opts.toEmail}`);
    return;
  }

  await config.transport.sendMail({
    from: `"Rakshex" <${config.from}>`,
    to: opts.toEmail,
    subject,
    html,
  });

  logger.info(`[Email] Welcome email sent to ${opts.toEmail}`);
}

export async function sendScanCompleteEmail(opts: ScanCompleteEmailOptions): Promise<void> {
  const totalFindings = opts.criticalCount + opts.highCount + opts.mediumCount + opts.lowCount;
  const subject = `Scan Complete: ${opts.criticalCount > 0 ? `${opts.criticalCount} Critical ` : ""}${totalFindings} Findings in ${opts.collectionName}`;

  const severityColor =
    opts.criticalCount > 0 ? "#DC2626" : opts.highCount > 0 ? "#EA580C" : "#16A34A";
  const severityEmoji = opts.criticalCount > 0 ? "🚨" : opts.highCount > 0 ? "⚠️" : "✅";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Scan Complete - Rakshex</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background:#f9fafb; margin:0; padding:40px 0;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8); padding:32px; text-align:center;">
      <h1 style="color:#fff; margin:0; font-size:24px; letter-spacing:-0.5px;">Rakshex</h1>
      <p style="color:#bfdbfe; margin:8px 0 0; font-size:14px;">API Security & LLM Intelligence Platform</p>
    </div>
    <div style="padding:40px 32px;">
      <div style="text-align:center; margin-bottom:28px;">
        <div style="display:inline-block; background:${severityColor}20; color:${severityColor}; padding:12px 20px; border-radius:8px; font-size:18px; font-weight:600;">
          ${severityEmoji} Scan Complete
        </div>
      </div>
      
      <h2 style="color:#111827; font-size:20px; margin:0 0 8px;">Hi ${opts.userName || "there"},</h2>
      <p style="color:#374151; line-height:1.6; margin:0 0 24px;">
        Your security scan for <strong>${opts.collectionName}</strong> has completed. Here's what we found:
      </p>
      
      <div style="background:#f9fafb; border-radius:8px; padding:20px; margin:0 0 28px;">
        <h3 style="color:#111827; font-size:14px; margin:0 0 16px; text-transform:uppercase; letter-spacing:0.5px;">Findings Summary</h3>
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0; color:#DC2626; font-weight:600;">🚨 Critical</td>
            <td style="padding:8px 0; text-align:right; font-weight:700; color:#DC2626;">${opts.criticalCount}</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:8px 0; color:#EA580C; font-weight:600;">⚠️ High</td>
            <td style="padding:8px 0; text-align:right; font-weight:700; color:#EA580C;">${opts.highCount}</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:8px 0; color:#D97706; font-weight:600;">🔶 Medium</td>
            <td style="padding:8px 0; text-align:right; font-weight:700; color:#D97706;">${opts.mediumCount}</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:8px 0; color:#059669; font-weight:600;">🔹 Low</td>
            <td style="padding:8px 0; text-align:right; font-weight:700; color:#059669;">${opts.lowCount}</td>
          </tr>
          <tr style="border-top:2px solid #e5e7eb;">
            <td style="padding:12px 0 0; color:#374151; font-weight:700;">Total</td>
            <td style="padding:12px 0 0; text-align:right; font-weight:700; color:#111827; font-size:18px;">${totalFindings}</td>
          </tr>
        </table>
      </div>
      
      <a href="${opts.dashboardUrl}" style="display:block; background:#2563eb; color:#fff; text-decoration:none; padding:14px 24px; border-radius:8px; text-align:center; font-weight:600; font-size:16px; margin:0 0 16px;">
        View Full Report →
      </a>
      
      <p style="color:#9ca3af; font-size:12px; margin:24px 0 0; text-align:center;">
        Scan completed on ${new Date(opts.scanDate).toLocaleString()}
      </p>
    </div>
    <div style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:20px 32px; text-align:center;">
      <p style="color:#9ca3af; font-size:12px; margin:0;">
        © ${new Date().getFullYear()} Rakshex. API Security Made Simple.
      </p>
    </div>
  </div>
</body>
</html>`;

  const config = createTransport();

  if (!config) {
    logger.info(
      `[Email] SMTP not configured. Would have sent scan complete email to: ${opts.toEmail}`,
    );
    return;
  }

  await config.transport.sendMail({
    from: `"Rakshex" <${config.from}>`,
    to: opts.toEmail,
    subject,
    html,
  });

  logger.info(`[Email] Scan complete email sent to ${opts.toEmail}`);
}

export async function sendBudgetWarningEmail(opts: BudgetWarningEmailOptions): Promise<void> {
  const subject = `⚠️ Rakshex: 80% of your AI budget used`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Budget Warning - Rakshex</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background:#f9fafb; margin:0; padding:40px 0;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#f59e0b,#d97706); padding:32px; text-align:center;">
      <h1 style="color:#fff; margin:0; font-size:24px; letter-spacing:-0.5px;">Rakshex</h1>
      <p style="color:#fef3c7; margin:8px 0 0; font-size:14px;">API Security & LLM Intelligence Platform</p>
    </div>
    <div style="padding:40px 32px;">
      <div style="text-align:center; margin-bottom:28px;">
        <div style="display:inline-block; background:#fef3c7; color:#92400e; padding:12px 20px; border-radius:8px; font-size:18px; font-weight:600;">
          ⚠️ Budget Warning
        </div>
      </div>
      
      <h2 style="color:#111827; font-size:20px; margin:0 0 8px;">Hi ${opts.userName || "there"},</h2>
      <p style="color:#374151; line-height:1.6; margin:0 0 24px;">
        You've used <strong>${opts.percentUsed.toFixed(0)}%</strong> of your AI budget limit. Your LLM operations may be automatically suspended when you reach 100%.
      </p>
      
      <div style="background:#f9fafb; border-radius:8px; padding:20px; margin:0 0 28px;">
        <h3 style="color:#111827; font-size:14px; margin:0 0 16px; text-transform:uppercase; letter-spacing:0.5px;">Budget Status</h3>
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0; color:#6b7280; font-weight:600;">Current Spend</td>
            <td style="padding:8px 0; text-align:right; font-weight:700; color:#111827;">$${opts.currentSpend.toFixed(2)}</td>
          </tr>
          <tr style="border-top:1px solid #e5e7eb;">
            <td style="padding:8px 0; color:#6b7280; font-weight:600;">Budget Limit</td>
            <td style="padding:8px 0; text-align:right; font-weight:700; color:#111827;">$${opts.budgetLimit.toFixed(2)}</td>
          </tr>
          <tr style="border-top:2px solid #e5e7eb;">
            <td style="padding:12px 0 0; color:#92400e; font-weight:700;">Percent Used</td>
            <td style="padding:12px 0 0; text-align:right; font-weight:700; color:#f59e0b; font-size:18px;">${opts.percentUsed.toFixed(1)}%</td>
          </tr>
        </table>
      </div>
      
      <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:16px; margin:0 0 28px;">
        <p style="color:#991b1b; font-size:14px; margin:0;">
          <strong>Action Required:</strong> When you reach 100%, the Kill Switch will automatically block all LLM operations. Consider increasing your budget limit or reviewing your usage patterns.
        </p>
      </div>
      
      <a href="${opts.dashboardUrl}" style="display:block; background:#f59e0b; color:#fff; text-decoration:none; padding:14px 24px; border-radius:8px; text-align:center; font-weight:600; font-size:16px; margin:0 0 16px;">
        Review Budget Settings →
      </a>
    </div>
    <div style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:20px 32px; text-align:center;">
      <p style="color:#9ca3af; font-size:12px; margin:0;">
        © ${new Date().getFullYear()} Rakshex. API Security Made Simple.
      </p>
    </div>
  </div>
</body>
</html>`;

  const config = createTransport();

  if (!config) {
    logger.info(`[Email] SMTP not configured. Would have sent budget warning to: ${opts.toEmail}`);
    return;
  }

  await config.transport.sendMail({
    from: `"Rakshex" <${config.from}>`,
    to: opts.toEmail,
    subject,
    html,
  });

  logger.info(`[Email] Budget warning email sent to ${opts.toEmail}`);
}

// ============================================================================
// WEEKLY DIGEST EMAIL
// ============================================================================

interface WeeklyDigestEmailOptions {
  toEmail: string;
  userName: string;
  weeklyScans: number;
  newFindings: number;
  criticalFindings: number;
  totalCost: number;
  topCollection: string;
  dashboardUrl: string;
}

export async function sendWeeklyDigestEmail(opts: WeeklyDigestEmailOptions): Promise<void> {
  const subject = `📊 Your Rakshex Weekly Security Digest`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Weekly Digest</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background:#f9fafb; margin:0; padding:40px 0;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8); padding:32px; text-align:center;">
      <h1 style="color:#fff; margin:0; font-size:24px;">📊 Weekly Security Digest</h1>
      <p style="color:#bfdbfe; margin:8px 0 0; font-size:14px;">Rakshex Security Platform</p>
    </div>
    <div style="padding:40px 32px;">
      <h2 style="color:#111827; font-size:20px; margin:0 0 16px;">Hi ${opts.userName || "there"},</h2>
      <p style="color:#374151; line-height:1.6; margin:0 0 24px;">
        Here's your weekly security summary for Rakshex.
      </p>
      
      <div style="background:#f3f4f6; border-radius:8px; padding:20px; margin:0 0 28px;">
        <p style="color:#6b7280; font-size:13px; margin:0 0 12px; text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">Weekly Stats</p>
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0; color:#374151;">Scans Run</td>
            <td style="padding:8px 0; text-align:right; font-weight:700;">${opts.weeklyScans}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; color:#374151;">New Findings</td>
            <td style="padding:8px 0; text-align:right; font-weight:700; color:${opts.newFindings > 0 ? "#dc2626" : "#16a34a"};">${opts.newFindings}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; color:#374151;">Critical Issues</td>
            <td style="padding:8px 0; text-align:right; font-weight:700; color:${opts.criticalFindings > 0 ? "#dc2626" : "#16a34a"};">${opts.criticalFindings}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; color:#374151;">Top Collection</td>
            <td style="padding:8px 0; text-align:right; font-weight:600;">${opts.topCollection}</td>
          </tr>
        </table>
      </div>
      
      <a href="${opts.dashboardUrl}" style="display:block; background:#2563eb; color:#fff; text-decoration:none; padding:14px 24px; border-radius:8px; text-align:center; font-weight:600; font-size:16px;">
        View Dashboard →
      </a>
    </div>
    <div style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:20px 32px; text-align:center;">
      <p style="color:#9ca3af; font-size:12px; margin:0;">
        © ${new Date().getFullYear()} Rakshex. API Security Made Simple.
      </p>
    </div>
  </div>
</body>
</html>`;

  const config = createTransport();

  if (!config) {
    logger.info(`[Email] SMTP not configured. Would have sent weekly digest to: ${opts.toEmail}`);
    return;
  }

  await config.transport.sendMail({
    from: `"Rakshex" <${config.from}>`,
    to: opts.toEmail,
    subject,
    html,
  });

  logger.info(`[Email] Weekly digest email sent to ${opts.toEmail}`);
}

// ============================================================================
// KILL SWITCH RECOVERY EMAIL
// ============================================================================

interface KillSwitchRecoveryEmailOptions {
  toEmail: string;
  userName: string;
  resetAt: string;
  newBudgetLimit: number;
  dashboardUrl: string;
}

export async function sendKillSwitchRecoveryEmail(
  opts: KillSwitchRecoveryEmailOptions,
): Promise<void> {
  const subject = `✅ Rakshex Kill Switch Reset — AI calls resumed`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Kill Switch Reset</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background:#f9fafb; margin:0; padding:40px 0;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#16a34a,#15803d); padding:32px; text-align:center;">
      <h1 style="color:#fff; margin:0; font-size:24px;">✅ Kill Switch Reset</h1>
      <p style="color:#bbf7d0; margin:8px 0 0; font-size:14px;">AI operations have resumed</p>
    </div>
    <div style="padding:40px 32px;">
      <h2 style="color:#111827; font-size:20px; margin:0 0 16px;">Hi ${opts.userName || "there"},</h2>
      <p style="color:#374151; line-height:1.6; margin:0 0 24px;">
        Your Rakshex AI operations have been <strong>successfully resumed</strong> after the kill switch was triggered.
      </p>
      
      <div style="background:#f0fdf4; border-radius:8px; padding:20px; margin:0 0 28px; border-left:4px solid #16a34a;">
        <p style="color:#6b7280; font-size:13px; margin:0 0 12px; text-transform:uppercase; letter-spacing:0.5px; font-weight:600;">Reset Details</p>
        <div style="margin-bottom:12px;">
          <span style="color:#374151;">Reset at: </span>
          <span style="font-weight:600;">${opts.resetAt}</span>
        </div>
        <div>
          <span style="color:#374151;">New budget limit: </span>
          <span style="font-weight:600;">$${opts.newBudgetLimit.toFixed(2)}</span>
        </div>
      </div>
      
      <a href="${opts.dashboardUrl}" style="display:block; background:#2563eb; color:#fff; text-decoration:none; padding:14px 24px; border-radius:8px; text-align:center; font-weight:600; font-size:16px;">
        Go to Dashboard →
      </a>
    </div>
    <div style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:20px 32px; text-align:center;">
      <p style="color:#9ca3af; font-size:12px; margin:0;">
        © ${new Date().getFullYear()} Rakshex. API Security Made Simple.
      </p>
    </div>
  </div>
</body>
</html>`;

  const config = createTransport();

  if (!config) {
    logger.info(
      `[Email] SMTP not configured. Would have sent kill switch recovery email to: ${opts.toEmail}`,
    );
    return;
  }

  await config.transport.sendMail({
    from: `"Rakshex" <${config.from}>`,
    to: opts.toEmail,
    subject,
    html,
  });

  logger.info(`[Email] Kill switch recovery email sent to ${opts.toEmail}`);
}

export async function sendPaymentFailedEmail(opts: PaymentFailedEmailOptions): Promise<void> {
  const subject = opts.downgradeWarning
    ? `⚠️ Rakshex: Payment failed — account will be downgraded`
    : `⚠️ Rakshex: Payment failed — please update your billing`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Payment Failed</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background:#f9fafb; margin:0; padding:40px 0;">
  <div style="max-width:520px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#ef4444,#dc2626); padding:32px; text-align:center;">
      <h1 style="color:#fff; margin:0; font-size:24px;">Payment Failed</h1>
      <p style="color:#fecaca; margin:8px 0 0; font-size:14px;">We could not process your subscription payment</p>
    </div>
    <div style="padding:40px 32px;">
      <h2 style="color:#111827; font-size:20px; margin:0 0 16px;">Hi ${opts.userName || "there"},</h2>
      <p style="color:#374151; line-height:1.6; margin:0 0 24px;">
        We were unable to process your Rakshex subscription payment of <strong>${opts.currency} ${opts.amount.toFixed(2)}</strong>.
      </p>
      ${
        opts.downgradeWarning
          ? `
      <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:16px; margin:0 0 28px;">
        <p style="color:#991b1b; font-size:14px; margin:0;">
          <strong>Warning:</strong> One more failed payment will downgrade your account to the Free plan. You will lose access to Pro features.
        </p>
      </div>
      `
          : ""
      }
      <a href="${opts.retryUrl}" style="display:block; background:#2563eb; color:#fff; text-decoration:none; padding:14px 24px; border-radius:8px; text-align:center; font-weight:600; font-size:16px; margin:0 0 16px;">
        Update Payment Method →
      </a>
      <p style="color:#9ca3af; font-size:12px; text-align:center; margin:0;">
        Questions? Reply to this email or contact support@devpulse.ai
      </p>
    </div>
    <div style="background:#f9fafb; border-top:1px solid #e5e7eb; padding:20px 32px; text-align:center;">
      <p style="color:#9ca3af; font-size:12px; margin:0;">
        © ${new Date().getFullYear()} Rakshex. API Security Made Simple.
      </p>
    </div>
  </div>
</body>
</html>`;

  const config = createTransport();

  if (!config) {
    logger.info(
      `[Email] SMTP not configured. Would have sent payment failed email to: ${opts.toEmail}`,
    );
    return;
  }

  await config.transport.sendMail({
    from: `"Rakshex" <${config.from}>`,
    to: opts.toEmail,
    subject,
    html,
  });

  logger.info(`[Email] Payment failed email sent to ${opts.toEmail}`);
}

export async function sendWaitlistConfirmationEmail(toEmail: string, plan: string): Promise<void> {
  const subject = "You're on the RakshEx waitlist 🔒";
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>RakshEx Waitlist</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background:#0b0f19; margin:0; padding:40px 0; color: #f3f4f6;">
  <div style="max-width:520px; margin:0 auto; background:#111827; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.4); border: 1px solid #1f2937;">
    <div style="background:linear-gradient(135deg,#3b82f6,#1d4ed8); padding:32px; text-align:center;">
      <h1 style="color:#fff; margin:0; font-size:24px; font-weight:700; letter-spacing:-0.025em;">🔒 RakshEx AI Governance</h1>
    </div>
    <div style="padding:40px 32px;">
      <h2 style="color:#60a5fa; font-size:20px; font-weight:600; margin:0 0 16px;">Welcome to the Waitlist!</h2>
      <p style="font-size:16px; line-height:1.6; margin:0 0 24px; color: #d1d5db;">
        Thank you for joining the RakshEx waitlist. We have recorded your interest in the <strong>${plan}</strong> plan.
      </p>
      <p style="font-size:16px; line-height:1.6; margin:0 0 24px; color: #d1d5db;">
        We are granting access in rolling batches to ensure maximum stability and support for our users. You will be notified as soon as an opening becomes available for your slot.
      </p>
      <div style="border-top:1px solid #374151; padding-top:20px; margin-top:20px;">
        <p style="font-size:14px; color:#9ca3af; margin:0 0 8px;">
          Website: <a href="https://devpulse.ai" style="color:#60a5fa; text-decoration:none;">rakshex.in</a>
        </p>
        <p style="font-size:14px; color:#9ca3af; margin:0;">
          For direct inquiries, feel free to reach out to Akshay Kammar at <a href="mailto:akshay@devpulse.ai" style="color:#60a5fa; text-decoration:none;">akshay@devpulse.ai</a>.
        </p>
      </div>
    </div>
    <div style="background:#1f2937; border-top:1px solid #374151; padding:20px 32px; text-align:center;">
      <p style="color:#9ca3af; font-size:12px; margin:0;">
        © ${new Date().getFullYear()} RakshEx. AI Runtime Governance.
      </p>
    </div>
  </div>
</body>
</html>`;

  const config = createTransport();
  if (!config) {
    logger.info(`[Email] SMTP not configured. Would have sent waitlist user email to: ${toEmail}`);
  } else {
    try {
      await config.transport.sendMail({
        from: `"RakshEx" <${config.from}>`,
        to: toEmail,
        subject,
        html,
      });
      logger.info(`[Email] Waitlist confirmation email sent to ${toEmail}`);
    } catch (err) {
      logger.error({ err }, `[Email] Failed to send waitlist user email to: ${toEmail}`);
    }
  }

  // Send internal notification to akshay@devpulse.ai
  const internalSubject = `New RakshEx waitlist signup: ${toEmail} - ${plan}`;
  const internalHtml = `
<!DOCTYPE html>
<html>
<body>
  <h2>New Waitlist Sign-up Details:</h2>
  <ul>
    <li><strong>Email:</strong> ${toEmail}</li>
    <li><strong>Interested Plan:</strong> ${plan}</li>
    <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
  </ul>
</body>
</html>`;

  if (!config) {
    logger.info(
      `[Email] SMTP not configured. Would have sent waitlist internal alert for: ${toEmail}`,
    );
  } else {
    try {
      await config.transport.sendMail({
        from: `"RakshEx System" <${config.from}>`,
        to: "akshay@devpulse.ai",
        subject: internalSubject,
        html: internalHtml,
      });
      logger.info(`[Email] Waitlist internal notification sent to akshay@devpulse.ai`);
    } catch (err) {
      logger.error({ err }, `[Email] Failed to send waitlist internal notification for ${toEmail}`);
    }
  }
}
