# Welcome Email Template

> Sent immediately after signup confirmation.

---

**Subject:** Welcome to Rakshex — Your 14-day Pro trial starts now 🚀

**From:** Akshay Kammar <akshay@rakshex.in>
**Reply-To:** support@rakshex.in

---

## Plain Text Version

```
Hi {{name}},

Welcome to Rakshex! Your 14-day Pro trial is now active.

Here is what you can do right now:

1. SCAN YOUR FIRST COLLECTION
   Drop a Postman or OpenAPI collection at:
   https://rakshex.in/dashboard/collections

2. SET A BUDGET CAP
   Go to Kill Switch settings and set your monthly LLM budget:
   https://rakshex.in/kill-switch

3. INVITE YOUR TEAM
   Pro includes 5 team members. Invite them from:
   https://rakshex.in/team

Your trial includes:
• Unlimited collections
• Advanced security scanning
• Kill switch & budget caps
• Slack/Discord alerts
• Team collaboration (5 seats)

Need help? Reply to this email or join our community:
https://github.com/Akshu1245/rakshex-complete-codebase/discussions

Best,
Akshay Kammar
Founder, Rakshex
```

## HTML Version

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to Rakshex</title>
  </head>
  <body
    style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"
  >
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <table
            width="600"
            cellpadding="0"
            cellspacing="0"
            style="background:#1e293b;border-radius:12px;overflow:hidden;"
          >
            <!-- Header -->
            <tr>
              <td
                style="padding:30px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);text-align:center;"
              >
                <h1 style="color:#fff;margin:0;font-size:24px;">Welcome to Rakshex</h1>
                <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;">
                  Your 14-day Pro trial is active
                </p>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:30px;color:#e2e8f0;">
                <p style="margin:0 0 20px;">Hi {{name}},</p>
                <p style="margin:0 0 20px;line-height:1.6;">
                  Welcome to Rakshex! Your 14-day Pro trial is now active. Here is what to do first:
                </p>

                <!-- Steps -->
                <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
                  <tr>
                    <td
                      style="padding:15px;background:#0f172a;border-radius:8px;margin-bottom:10px;"
                    >
                      <strong style="color:#3b82f6;">1. Scan Your First Collection</strong>
                      <p style="margin:5px 0 0;color:#94a3b8;font-size:14px;">
                        Drop a Postman or OpenAPI collection and find vulnerabilities in 3 seconds.
                      </p>
                      <a
                        href="https://rakshex.in/dashboard/collections"
                        style="color:#3b82f6;text-decoration:none;font-size:14px;"
                        >Start Scanning →</a
                      >
                    </td>
                  </tr>
                  <tr>
                    <td style="height:10px;"></td>
                  </tr>
                  <tr>
                    <td style="padding:15px;background:#0f172a;border-radius:8px;">
                      <strong style="color:#3b82f6;">2. Set a Budget Cap</strong>
                      <p style="margin:5px 0 0;color:#94a3b8;font-size:14px;">
                        Prevent runaway LLM costs with our autonomous kill switch.
                      </p>
                      <a
                        href="https://rakshex.in/kill-switch"
                        style="color:#3b82f6;text-decoration:none;font-size:14px;"
                        >Configure Kill Switch →</a
                      >
                    </td>
                  </tr>
                  <tr>
                    <td style="height:10px;"></td>
                  </tr>
                  <tr>
                    <td style="padding:15px;background:#0f172a;border-radius:8px;">
                      <strong style="color:#3b82f6;">3. Invite Your Team</strong>
                      <p style="margin:5px 0 0;color:#94a3b8;font-size:14px;">
                        Pro includes 5 team members. Collaboration makes security better.
                      </p>
                      <a
                        href="https://rakshex.in/team"
                        style="color:#3b82f6;text-decoration:none;font-size:14px;"
                        >Manage Team →</a
                      >
                    </td>
                  </tr>
                </table>

                <p style="margin:20px 0;line-height:1.6;">
                  Need help? Reply to this email or join our GitHub Discussions community.
                </p>

                <p style="margin:20px 0 0;">
                  Best,<br />
                  <strong style="color:#fff;">Akshay Kammar</strong><br />
                  <span style="color:#94a3b8;font-size:14px;">Founder, Rakshex</span>
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td
                style="padding:20px 30px;background:#0f172a;text-align:center;border-top:1px solid #334155;"
              >
                <p style="margin:0;color:#64748b;font-size:12px;">
                  Rakshex by Rashi Technologies · Bengaluru, India<br />
                  <a href="https://rakshex.in/privacy" style="color:#64748b;">Privacy</a> ·
                  <a href="https://rakshex.in/terms" style="color:#64748b;">Terms</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## SendGrid Dynamic Template Data

```json
{
  "name": "Akshay",
  "trial_end_date": "May 31, 2026",
  "collections_url": "https://rakshex.in/dashboard/collections",
  "kill_switch_url": "https://rakshex.in/kill-switch",
  "team_url": "https://rakshex.in/team"
}
```
