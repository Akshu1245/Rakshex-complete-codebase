"""
Email Service - SendGrid integration for transactional emails.

Sends:
- Welcome email on signup
- Trial expiring reminder (3 days before)
- Payment failed notification
- Weekly usage digest
"""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy import – graceful fallback
try:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Email, To, Content
    SENDGRID_AVAILABLE = True
except ImportError:
    SENDGRID_AVAILABLE = False
    logger.warning("sendgrid package not installed – emails run in stub mode")

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "hello@devpulse.dev")
FROM_NAME = os.getenv("FROM_NAME", "DevPulse")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


def _send(to_email: str, subject: str, html_content: str) -> bool:
    """Send an email via SendGrid. Returns True on success."""
    if not SENDGRID_AVAILABLE or not SENDGRID_API_KEY:
        logger.info("Email stub → to=%s subject=%s", to_email, subject)
        return True  # stub success

    try:
        message = Mail(
            from_email=Email(FROM_EMAIL, FROM_NAME),
            to_emails=To(to_email),
            subject=subject,
            html_content=Content("text/html", html_content),
        )
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        logger.info("Email sent to %s – status %s", to_email, response.status_code)
        return response.status_code in (200, 201, 202)
    except Exception as e:
        logger.error("SendGrid error: %s", e)
        return False


# ── Email Templates ──────────────────────────────────────────────────────────

def send_welcome_email(to_email: str, username: str) -> bool:
    """Send welcome email after signup."""
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h1 style="color:#7c3aed;">Welcome to DevPulse, {username}! 🚀</h1>
      <p>Your 14-day Pro trial is now active. Here's what you can do:</p>
      <ul>
        <li>✅ Monitor unlimited APIs</li>
        <li>✅ Security scanning & CI/CD gates</li>
        <li>✅ Multi-channel alerts with kill-switch</li>
        <li>✅ Advanced analytics & forecasting</li>
      </ul>
      <a href="{FRONTEND_URL}" style="display:inline-block;background:#7c3aed;color:white;
         padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px;">
        Open Dashboard
      </a>
      <p style="color:#888;margin-top:24px;font-size:12px;">
        Need help? Reply to this email or visit our docs.
      </p>
    </div>
    """
    return _send(to_email, "Welcome to DevPulse – Your Pro Trial is Active!", html)


def send_trial_expiring_email(to_email: str, username: str, days_left: int) -> bool:
    """Send trial expiring reminder."""
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h1 style="color:#f59e0b;">Your Pro Trial Ends in {days_left} Days</h1>
      <p>Hi {username}, your DevPulse Pro trial is expiring soon.</p>
      <p>Upgrade now to keep access to all Pro features:</p>
      <a href="{FRONTEND_URL}/billing" style="display:inline-block;background:#7c3aed;color:white;
         padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:12px;">
        Upgrade to Pro – $29/mo
      </a>
      <p style="color:#888;margin-top:24px;font-size:12px;">
        If you don't upgrade, your account will revert to the Free plan.
      </p>
    </div>
    """
    return _send(to_email, f"DevPulse Pro Trial – {days_left} Days Left", html)


def send_payment_failed_email(to_email: str, username: str) -> bool:
    """Send payment failed notification."""
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h1 style="color:#ef4444;">Payment Failed</h1>
      <p>Hi {username}, we couldn't process your payment for DevPulse Pro.</p>
      <p>Please update your payment method to avoid service interruption:</p>
      <a href="{FRONTEND_URL}/billing" style="display:inline-block;background:#ef4444;color:white;
         padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:12px;">
        Update Payment Method
      </a>
    </div>
    """
    return _send(to_email, "DevPulse – Payment Failed", html)


def send_weekly_digest(
    to_email: str,
    username: str,
    api_count: int,
    uptime: float,
    alerts_fired: int,
    incidents: int,
) -> bool:
    """Send weekly usage digest."""
    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h1 style="color:#7c3aed;">Your Weekly DevPulse Report</h1>
      <p>Hi {username}, here's your API health summary:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">APIs Monitored</td>
            <td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">{api_count}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">Uptime</td>
            <td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">{uptime:.1f}%</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee;">Alerts Fired</td>
            <td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">{alerts_fired}</td></tr>
        <tr><td style="padding:8px;">Incidents</td>
            <td style="padding:8px;font-weight:bold;">{incidents}</td></tr>
      </table>
      <a href="{FRONTEND_URL}" style="display:inline-block;background:#7c3aed;color:white;
         padding:12px 24px;border-radius:8px;text-decoration:none;">
        View Full Dashboard
      </a>
    </div>
    """
    return _send(to_email, "DevPulse – Weekly API Health Digest", html)
