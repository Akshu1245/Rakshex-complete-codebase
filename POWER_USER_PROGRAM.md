# Rakshex Power User Program

> Turn your best users into advocates.
> Date: 2026-05-17

---

## PROGRAM TIERS

### Tier 1: Rakshex Insider

**Criteria:**

- Active user for 30+ days
- Scanned 20+ times
- Engagement score > 60

**Benefits:**

- Early access to new features
- Private Slack/Discord channel
- Monthly product update call
- Swag (sticker + t-shirt)

**Recognition:**

- "Insider" badge in dashboard
- Listed on "Community" page (opt-in)

---

### Tier 2: Rakshex Champion

**Criteria:**

- Active user for 60+ days
- Scanned 50+ times
- Referred 1+ user
- Gave detailed feedback
- Engagement score > 80

**Benefits:**

- All Insider benefits
- Free Pro plan (lifetime)
- Quarterly 1:1 with founder
- Input on product roadmap
- Speaking opportunities
- Blog feature

**Recognition:**

- "Champion" badge
- Dedicated profile page
- Social media spotlight

---

### Tier 3: Rakshex Ambassador

**Criteria:**

- Active user for 90+ days
- Scanned 100+ times
- Referred 5+ users
- Published content about Rakshex
- Enterprise introduction
- Engagement score > 95

**Benefits:**

- All Champion benefits
- Revenue share on referred customers (10% for 12 months)
- Advisory board invitation
- Annual retreat invitation
- Co-branded content
- Conference sponsorship

**Recognition:**

- "Ambassador" title
- Annual award
- Permanent "Hall of Fame"

---

## RECRUITMENT PROCESS

### Step 1: Identify

```sql
-- Monthly power user identification
SELECT
  user_id,
  COUNT(*) as scan_count,
  MAX(last_scan_at) as last_active,
  COUNT(DISTINCT collection_id) as collections,
  engagement_score
FROM users
WHERE
  created_at < NOW() - INTERVAL 30 DAY
  AND engagement_score > 60
  AND last_scan_at > NOW() - INTERVAL 7 DAY
ORDER BY engagement_score DESC
LIMIT 20;
```

### Step 2: Reach Out

```
Subject: You've been selected for the Rakshex Insider Program

Hi {{name}},

You've been one of our most active users.

We'd like to invite you to the Rakshex Insider Program.

What that means:
- Early access to features
- Direct line to the product team
- Exclusive swag
- Your feedback shapes our roadmap

Interested? [Join here]

— Akshay
```

### Step 3: Onboard

- Send welcome kit (digital + physical)
- Add to private channel
- Schedule intro call (15 min)
- Share roadmap preview
- Assign "buddy" from team

---

## ADVOCACY ACTIVITIES

| Activity                 | Points | Frequency   |
| ------------------------ | ------ | ----------- |
| Refer a user             | 50     | Unlimited   |
| Leave marketplace review | 100    | Once        |
| Write blog post          | 200    | Monthly     |
| Give testimonial         | 150    | Once        |
| Speak at event           | 500    | Per event   |
| Social media post        | 25     | Weekly      |
| Product feedback session | 75     | Monthly     |
| Beta test new feature    | 50     | Per feature |

**Redeem points for:**

- Swag (100 pts)
- Pro plan extension (200 pts)
- Feature priority (500 pts)
- Revenue share tier upgrade (1000 pts)

---

## COMMUNITY CONTENT

### Monthly Champion Spotlight

```
🌟 Rakshex Champion of the Month: {{name}}

{{name}} is a {{role}} at {{company}}.
They've scanned {{count}} times and found {{issues}} security issues.

"{{testimonial}}"

Read their full story: [link]
```

### Weekly Win Sharing

Champions share:

- Security issues found
- Money saved
- Team adoption stories
- Setup tips

---

## PROGRAM METRICS

| Metric                 | Target   | Current |
| ---------------------- | -------- | ------- |
| Insiders enrolled      | 50       | \_\_\_  |
| Champions enrolled     | 20       | \_\_\_  |
| Ambassadors enrolled   | 5        | \_\_\_  |
| Referrals from program | 20/month | \_\_\_  |
| Content from champions | 5/month  | \_\_\_  |
| NPS of program members | > 70     | \_\_\_  |

---

_Program maintained by DevRel + growth team._
_Reviews monthly. Tiers evaluated quarterly._
