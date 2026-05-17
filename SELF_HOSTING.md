# Self-Hosting Guide

Deploy DevPulse on your own infrastructure. This guide covers Docker Compose, environment setup, and first-run configuration.

## Prerequisites

- Docker 24+ and Docker Compose v2
- 4 GB RAM minimum (8 GB recommended)
- A domain name with DNS access (for HTTPS)
- Linux server (Ubuntu 22.04 LTS recommended)

## Quick Start (10 minutes)

```bash
# 1. Clone
git clone https://github.com/Akshu1245/devpulse-complete-codebase.git
cd devpulse-complete-codebase

# 2. Copy and edit environment
cp .env.example .env
nano .env
```

### Required environment variables

```bash
# Database
DATABASE_URL=mysql://devpulse:your-password@db:3306/devpulse

# Auth
JWT_SECRET=$(openssl rand -hex 32)

# App
APP_URL=https://devpulse.your-company.com
FRONTEND_URL=https://devpulse.your-company.com
NODE_ENV=production

# Payments (optional — leave blank to disable billing)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
STRIPE_SECRET_KEY=

# Redis (optional — improves performance)
REDIS_URL=redis://redis:6379

# Email (optional — needed for team invites, alerts)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=alerts@your-company.com
SMTP_PASS=
SMTP_FROM=DevPulse <alerts@your-company.com>

# GitHub App (optional — for PR scanning)
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=

# LLM providers (at least one required for autofix)
MINIMAX_API_KEY=
# or
ANTHROPIC_API_KEY=
# or
GOOGLE_API_KEY=
```

```bash
# 3. Launch
sudo docker compose -f docker-compose.prod.yml up -d

# 4. Run migrations
sudo docker compose -f docker-compose.prod.yml exec app pnpm run db:migrate

# 5. Create first admin user
sudo docker compose -f docker-compose.prod.yml exec app node scripts/create-admin.js
```

Visit `https://devpulse.your-company.com` and sign in.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Nginx     │────▶│   Next.js   │────▶│   Express   │
│  (reverse   │     │  (frontend) │     │  (tRPC)   │
│   proxy)    │     └─────────────┘     └──────┬──────┘
└─────────────┘                                │
                                               ▼
                                        ┌─────────────┐
                                        │   MySQL 8   │
                                        │  (primary)  │
                                        └─────────────┘
                                               │
                                        ┌─────────────┐
                                        │   Redis 7   │
                                        │  (cache +  │
                                        │   queues)   │
                                        └─────────────┘
```

## SSL / HTTPS

### Option A: Cloudflare (easiest)

Point your domain to Cloudflare, enable "Full (strict)" SSL, and proxy through Cloudflare. No cert management needed.

### Option B: Let's Encrypt

The production compose mounts `nginx/` with a default config. Replace `nginx/default.conf` with:

```nginx
server {
  listen 443 ssl http2;
  server_name devpulse.your-company.com;

  ssl_certificate /etc/letsencrypt/live/devpulse.your-company.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/devpulse.your-company.com/privkey.pem;

  location / {
    proxy_pass http://app:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

Use Certbot to obtain certificates.

## Backup

### Database

```bash
# Automated daily backup (add to crontab)
0 2 * * * docker compose -f docker-compose.prod.yml exec db mysqldump -u root -p devpulse > /backups/devpulse-$(date +\%Y\%m\%d).sql
```

### Redis

```bash
# Save and copy RDB
docker compose -f docker-compose.prod.yml exec redis redis-cli BGSAVE
docker cp devpulse-redis-1:/data/dump.rdb /backups/redis-$(date +%Y%m%d).rdb
```

## Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart (zero-downtime with compose)
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --build

# Run migrations
docker compose -f docker-compose.prod.yml exec app pnpm run db:migrate
```

## Troubleshooting

| Symptom              | Fix                                                            |
| -------------------- | -------------------------------------------------------------- |
| "DB unavailable"     | Check `DATABASE_URL` format; ensure MySQL container is healthy |
| Scans stuck "queued" | Verify Redis is running; check BullMQ worker logs              |
| Email not sending    | Confirm SMTP credentials; check spam folders                   |
| High memory          | Reduce `WEB_CONCURRENCY` in `.env`; add swap                   |

## Enterprise Support

Self-hosted deployments with a DevPulse Enterprise license receive:

- Priority Slack/Teams support channel
- Quarterly security patches
- Custom SAML/SSO integration
- Dedicated onboarding engineer

Contact enterprise@devpulse.in for licensing.
