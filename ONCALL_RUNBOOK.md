# DevPulse On-Call Runbook

## Health Check Endpoints

| Endpoint                | Expected                 | Notes                  |
| ----------------------- | ------------------------ | ---------------------- |
| `GET /api/health`       | 200 OK                   | Basic liveness         |
| `GET /api/health/ready` | 200 OK                   | Readiness (DB + Redis) |
| `GET /api/health/db`    | `{"status":"connected"}` | Database connectivity  |
| `GET /api/health/redis` | `{"status":"connected"}` | Redis connectivity     |

## Common Alerts

### High Error Rate (>5% 5xx in 5 min)

```bash
# Check recent errors
ssh deployer@$DEPLOY_HOST
docker logs devpulse-app-1 --tail 200 | grep ERROR

# Check DB connection
docker exec devpulse-app-1 node -e "fetch('http://localhost:3000/api/health/db').then(r=>r.json()).then(console.log)"

# Check Redis
docker exec devpulse-app-1 node -e "fetch('http://localhost:3000/api/health/redis').then(r=>r.json()).then(console.log)"
```

### Payment Webhook Failures

```bash
# Check Razorpay webhook delivery log (in Razorpay dashboard)
# Check app logs for signature errors
docker logs devpulse-app-1 --tail 100 | grep "webhook"

# Verify webhook secret
docker exec devpulse-app-1 printenv RAZORPAY_WEBHOOK_SECRET
```

### Database Connection Pool Exhaustion

```bash
# Check active connections
docker exec devpulse-db-1 psql -U devpulse -d devpulse_db -c "SELECT count(*) FROM pg_stat_activity;"

# Check for long-running queries
docker exec devpulse-db-1 psql -U devpulse -d devpulse_db -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC LIMIT 10;"

# Kill stuck queries by PID
# docker exec devpulse-db-1 psql -U devpulse -d devpulse_db -c "SELECT pg_terminate_backend(<pid>);"
```

### Redis Memory Pressure

```bash
# Check Redis memory
docker exec devpulse-redis-1 redis-cli INFO memory

# Check eviction policy
docker exec devpulse-redis-1 redis-cli CONFIG GET maxmemory-policy
```

### High Latency (>2s p95)

```bash
# Check CPU/memory
docker stats devpulse-app-1 --no-stream

# Check slow DB queries
docker exec devpulse-db-1 psql -U devpulse -d devpulse_db -c "SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

## Restart Procedures

### Graceful Restart (no downtime)

```bash
ssh deployer@$DEPLOY_HOST
cd /opt/devpulse
docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate app
```

### Full Restart

```bash
ssh deployer@$DEPLOY_HOST
cd /opt/devpulse
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

### Database Restore (Emergency)

```bash
ssh deployer@$DEPLOY_HOST
cd /opt/devpulse
docker compose -f docker-compose.prod.yml down app frontend
docker exec -i devpulse-db-1 psql -U devpulse -d devpulse_db < /opt/devpulse/backups/latest.sql
docker compose -f docker-compose.prod.yml up -d
```

## Monitoring Dashboards

- Sentry: `${SENTRY_DSN}`
- Logs: `docker logs devpulse-app-1 --follow`
- GitHub Actions CI: `.github/workflows/ci.yml`

## Escalation

| Tier                  | Contact | When                     |
| --------------------- | ------- | ------------------------ |
| L1 — On-call          | <TBD>   | All P0/P1 alerts         |
| L2 — Engineering Lead | <TBD>   | Unresolved after 30 min  |
| L3 — CTO              | <TBD>   | Unresolved after 2 hours |
