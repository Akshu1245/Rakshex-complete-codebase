# Onboarding Drip Campaign (5 emails)

> Automated sequence over 14-day trial. Sent via SendGrid / Mailgun automation.

---

## Email 1 — Day 1: Welcome (already above)

---

## Email 2 — Day 3: First Scan

**Subject:** Have you scanned your first API yet?

```
Hi {{name}},

Quick check-in — have you dropped your first API collection into DevPulse yet?

If not, here is a 2-minute walkthrough:

1. Go to https://devpulse.in/dashboard/collections
2. Click "New Collection"
3. Upload your Postman .json or OpenAPI .yaml
4. Click "Scan"
5. See vulnerabilities in 3 seconds

Most users find at least 2 issues they did not know about.

Need help? Reply to this email.

Akshay
```

---

## Email 3 — Day 7: Kill Switch Setup

**Subject:** Protect yourself from a $50K LLM bill

```
Hi {{name}},

One of our early users had a rogue chatbot burn through $12,000 in a weekend.

Their mistake? No budget cap.

DevPulse's kill switch prevents this. Set it up in 30 seconds:

https://devpulse.in/kill-switch

→ Set monthly budget
→ Choose alert channels (Slack/Email)
→ Enable auto-block

You will sleep better.

Akshay
```

---

## Email 4 — Day 10: Team Invite

**Subject:** Your team is missing out

```
Hi {{name}},

Your Pro trial includes 5 team members. Most security issues are found faster with more eyes.

Invite your team:
https://devpulse.in/team

They will get:
• Shared collections
• Role-based access (Admin/Analyst/Viewer)
• Slack alerts for their projects
• Budget visibility per workspace

4 days left in your trial. Make them count.

Akshay
```

---

## Email 5 — Day 13: Trial Ending

**Subject:** Your Pro trial ends tomorrow — here is what happens

```
Hi {{name}},

Your 14-day Pro trial ends tomorrow ({{trial_end_date}}).

Here is what happens:

STAY ON PRO:
→ https://devpulse.in/billing
→ $99/month, cancel anytime
→ Keep unlimited collections + advanced features

DOWNGRADE TO FREE:
→ No action needed — auto-downgrades
→ Keep 2 collections + 3 scans/day
→ All your data stays intact

Questions? Reply to this email. I read every one.

Akshay
```
