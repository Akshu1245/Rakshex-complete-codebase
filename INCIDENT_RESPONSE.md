# DevPulse Incident Response

## Severity Levels

| Level         | Definition                                     | Response Time | Escalation        |
| ------------- | ---------------------------------------------- | ------------- | ----------------- |
| P0 — Critical | Auth bypass, tenant data leak, payment loss    | 15 min        | Full team + CEO   |
| P1 — High     | Service outage, broken signup, 500s on billing | 30 min        | On-call engineer  |
| P2 — Medium   | Degraded performance, partial feature outage   | 2 hours       | Next business day |
| P3 — Low      | Non-critical bug, cosmetic issue               | 1 week        | Sprint backlog    |

## Incident Commander Role

- Declare severity
- Open incident channel (#inc-xxx)
- Post status updates every 30 min for P0/P1
- Run postmortem within 48 hours of resolution

## Rollback Procedures

### Docker/Deploy Rollback

```bash
ssh deployer@$DEPLOY_HOST
cd /opt/devpulse
# List available images
docker images ghcr.io/akshu1245/devpulse-complete-codebase --format "{{.Tag}}"
# Rollback to known-good SHA
docker compose -f docker-compose.prod.yml down
TAG=sha-<good-sha> docker compose -f docker-compose.prod.yml up -d
```

### Database Rollback

```bash
# List recent backups
ls /opt/devpulse/backups/
# Restore
docker exec -i devpulse-db-1 psql -U devpulse -d devpulse_db < /opt/devpulse/backups/backup_<date>.sql
# Run migrations forward to current
docker exec devpulse-app-1 npx drizzle-kit migrate
```

### Payment Webhook Recovery

If webhooks were missed or idempotency blocked legitimate events:

1. Log into Razorpay dashboard → Webhooks → Pending Deliveries
2. Manually replay failed deliveries
3. Verify state in DB: `SELECT * FROM subscriptions WHERE status != 'active'`

## Contact List

- Engineering lead: <TBD>
- DevOps/SRE: <TBD>
- Product/GTM: <TBD>

## Postmortem Template

See `POSTMORTEM_TEMPLATE.md`
