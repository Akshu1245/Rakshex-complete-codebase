# Rakshex Failure Recovery Matrix

> Every component failure and how the system responds.
> Date: 2026-05-17

---

## MATRIX

| Component            | Failure Mode             | Detection             | Immediate Response                  | Recovery                                   | RTO     | RPO | Tested  |
| -------------------- | ------------------------ | --------------------- | ----------------------------------- | ------------------------------------------ | ------- | --- | ------- |
| **MySQL**            | Connection limit reached | Health check 503      | Return 503, queue requests          | Restart API dynos, clear stale connections | 2 min   | 0   | ✅      |
| **MySQL**            | Complete outage          | Health check 503      | Enable read-only mode, queue writes | Restore from backup, replay binlog         | 30 min  | 24h | Monthly |
| **Redis**            | Connection lost          | Health check degraded | In-memory rate limit fallback       | Auto-reconnect, resync                     | 5 min   | 0   | ✅      |
| **Redis**            | Complete outage          | Health check degraded | In-memory cache, queue in DB        | Provision new Redis instance               | 15 min  | 0   | ✅      |
| **OpenAI API**       | Timeout / 5xx            | Circuit breaker       | Fail fast, queue retry              | Circuit breaker half-open test             | 5 min   | 0   | ✅      |
| **OpenAI API**       | Rate limited (429)       | HTTP 429              | Backoff with jitter                 | Resume after Retry-After                   | 1 min   | 0   | ✅      |
| **Anthropic API**    | Timeout / 5xx            | Circuit breaker       | Fail fast, queue retry              | Circuit breaker half-open test             | 5 min   | 0   | ✅      |
| **Webhook delivery** | Target unreachable       | Delivery log          | Retry 3x with backoff               | Move to dead letter queue after 3 failures | 10 min  | 0   | ✅      |
| **BullMQ worker**    | Crash / hang             | Worker timeout        | Restart worker, requeue job         | Auto-restart via supervisor                | 30 sec  | 0   | ✅      |
| **VS Code ext**      | Network offline          | fetch timeout         | Cache last scan, queue actions      | Auto-reconnect on network restore          | Instant | 0   | ✅      |
| **VS Code ext**      | Memory > 150MB           | Memory monitor        | Warn user, suggest reload           | User reloads window                        | Manual  | 0   | ✅      |
| **CDN**              | Cache miss / stale       | Monitoring            | Serve from origin                   | Purge CDN cache                            | 2 min   | 0   | ✅      |
| **SSL cert**         | Expired                  | Uptime monitor        | Serve HTTP (fallback)               | Renew certificate                          | 15 min  | 0   | Monthly |
| **GitHub webhook**   | Invalid signature        | Webhook log           | Return 401, log security event      | Verify secret, retry                       | Instant | 0   | ✅      |
| **Stripe webhook**   | Failed delivery          | Stripe dashboard      | Retry from Stripe                   | Reconcile via Stripe API                   | 5 min   | 0   | ✅      |

---

## RECOVERY PROCEDURES

### MySQL Connection Pool Exhaustion

```bash
# 1. Check current connections
mysql -e "SHOW STATUS LIKE 'Threads_connected';"

# 2. Restart API dynos to clear stale connections
render deploy --restart

# 3. Verify health check returns 200
curl https://api.rakshex.in/api/health

# 4. If still failing, enable emergency read-only mode
# (serves cached data, queues writes)
```

### Redis Complete Outage

```bash
# 1. Confirm Redis is down
redis-cli ping

# 2. Switch to in-memory fallback (automatic)
# Rate limits use Map() instead of Redis

# 3. Provision new Redis instance via Redis Cloud dashboard

# 4. Update REDIS_URL env var
render env set REDIS_URL=<new-url>

# 5. Verify connectivity
redis-cli -u $REDIS_URL ping
```

### OpenAI API Outage

```
# Automatic — handled by circuit breaker
# No manual intervention needed
# System will:
# 1. Open circuit after 5 failures
# 2. Return cached responses where possible
# 3. Retry every 30 seconds (half-open)
# 4. Close circuit when healthy
```

### VS Code Extension Offline

```
# Automatic — handled by extension
# 1. Detect network failure (fetch timeout)
# 2. Cache last known state
# 3. Queue user actions locally
# 4. Show "Offline mode" indicator in status bar
# 5. Auto-sync when network returns
```

---

## EMERGENCY CONTACTS

| Scenario                     | Contact               | Method          |
| ---------------------------- | --------------------- | --------------- |
| Complete outage              | On-call engineer      | PagerDuty       |
| Data breach                  | Security lead + Legal | Slack + Phone   |
| Vendor outage (Render/Redis) | Vendor support        | Priority ticket |
| Payment issues               | Finance               | Email           |

---

_Matrix maintained by SRE team._
_Tested monthly on staging, reviewed quarterly._
