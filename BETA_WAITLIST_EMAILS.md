# Rakshex Beta Email Sequences

> Ready-to-send emails for beta acquisition and retention.
> Date: 2026-05-17

---

## SEQUENCE 1: WAITLIST → BETA INVITE

### Email 1: "You're in!" (Send immediately on invite)

```
Subject: You're in the Rakshex beta 🛡️

Hi {{first_name}},

You're one of 50 developers getting early access to Rakshex.

What is it?
Rakshex is a VS Code extension that stops AI agents from burning
your API budget. It finds hidden reasoning costs, auto-stops
infinite loops, and scans your API collections for vulnerabilities.

Here's your invite code: {{invite_code}}

Get started in 60 seconds:
1. Install from the VS Code Marketplace: [link]
2. Paste your invite code when prompted
3. Import any API collection (Postman, OpenAPI, or Bruno)
4. Run your first scan

Most people find at least 2 issues they didn't know about.

Questions? Reply to this email — I read every one.

Akshay
Founder, Rakshex
```

### Email 2: "How's it going?" (Day 2, only if no scan)

```
Subject: Need help with your first Rakshex scan?

Hi {{first_name}},

I noticed you haven't run your first scan yet. No worries —
here's the fastest way to see value:

Option 1: Use our sample collection
[Download sample-collection.json] — it has 6 intentional
vulnerabilities. Import it and run a scan. Takes 30 seconds.

Option 2: Import your own
Drag any Postman, OpenAPI, or Bruno collection into the
Rakshex sidebar. We'll do the rest.

Stuck? Reply and I'll personally walk you through it.

Akshay
```

### Email 3: "What did you find?" (Day 7, if scan completed)

```
Subject: What did Rakshex find in your API collections?

Hi {{first_name}},

You've been using Rakshex for a week. I'm curious:

1. What's the most surprising thing you found?
2. Did any finding save you money or prevent a security issue?
3. What's the biggest friction you're facing?

Reply directly — I read every response and use them to
prioritize what we build next.

If you found value, would you mind leaving a review on the
VS Code Marketplace? It takes 30 seconds and helps other
developers discover Rakshex.

[Leave a review]

Thanks,
Akshay
```

### Email 4: "Weekly Protection Summary" (Every Monday)

```
Subject: Your Rakshex weekly protection summary

Hi {{first_name}},

Here's what Rakshex protected you from this week:

💰 Hidden costs detected: ${{money_saved}}
🛑 Rogue agents stopped: {{agents_stopped}}
🔓 Exposed secrets found: {{secrets_found}}
🛡️ Threats blocked: {{threats_blocked}}

Your most critical finding:
{{top_finding_title}} — {{top_finding_severity}}

[View full dashboard]

See you next week,
The Rakshex team
```

### Email 5: "We're launching soon" (Day 30, pre-launch)

```
Subject: Rakshex is launching on Product Hunt next week

Hi {{first_name}},

After 6 months of building, we're launching Rakshex publicly
next Tuesday on Product Hunt.

As a beta user, you've shaped the product more than you know.
Your feedback directly influenced {{feature_count}} improvements.

Would you support us on launch day?

1. Upvote us on Product Hunt (link coming Tuesday)
2. Leave a review on the VS Code Marketplace
3. Share with a developer friend who might need this

Beta users get Pro free for 6 months after launch.

Thanks for being an early believer.

Akshay
```

---

## SEQUENCE 2: CHURN RECOVERY

### Email: "We noticed you uninstalled"

```
Subject: What happened?

Hi {{first_name}},

I noticed you uninstalled Rakshex from VS Code. I'm sorry
we didn't meet your expectations.

Mind telling me why? (30 seconds, anonymous)
[Survey link]

Common reasons:
- Couldn't find value
- Too confusing
- Found bugs
- Missing features
- Other

If we fix your issue, would you give us another try?

Akshay
```

---

## SEQUENCE 3: REFERRAL LOOP

### Email: "Know someone who needs this?"

```
Subject: Give $29, get $29

Hi {{first_name}},

Rakshex has saved you ${{total_saved}} so far.

Know another developer building with AI? Gift them a free
month of Rakshex Pro.

[Send a free month]

When they subscribe, you get a free month too.

Win-win.

Akshay
```

---

_Email sequences maintained by growth team._
_A/B test subject lines weekly._
