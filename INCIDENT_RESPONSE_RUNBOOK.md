# DevPulse Incident Response Runbook

> Step-by-step procedures for common production incidents.
> Date: 2026-05-17

---

## INCIDENT SEVERITY LEVELS

| Level | Criteria                                    | Response Time | Escalation       |
| ----- | ------------------------------------------- | ------------- | ---------------- |
| SEV-1 | Complete outage, data loss, security breach | 15 min        | CEO + Legal      |
| SEV-2 | Major feature degraded, partial outage      | 30 min        | Engineering Lead |
| SEV-3 | Minor feature broken, workaround exists     | 2 hours       | On-call engineer |
| SEV-4 | Cosmetic issue, no user impact              | 24 hours      | Next sprint      |

---

## RUNBOOK 1: DATABASE OUTAGE

### Detection

- Health check returns 503 with `database: error`
- Users report "Connection refused" errors
- PagerDuty alert: `mysql connectivity failed`

### Response

1. **Verify:** Check Render MySQL dashboard → Status page
2. **Check connections:** `SHOW STATUS LIKE 'Threads_connected'`
3. **If connection limit reached:**
   - Restart API dynos to clear stale connections
   - Check for connection leaks in recent deploy
4. **If MySQL is down:**
   - Contact Render support (priority ticket)
   - Enable read-only mode if configured
   - Post status page update
5. **Validate:** Health check returns 200

### Rollback

- If issue started after deploy: `git revert <commit>` + redeploy

---

## RUNBOOK 2: REDIS FAILURE

### Detection

- Health check: `redis: error`
- Rate limits fail-open (in-memory fallback activates)
- Sessions may be lost

### Response

1. **Verify:** `redis-cli ping` from dyno
2. **If Redis Cloud down:**
   - Check Redis Cloud status page
   - Rate limits automatically fall back to in-memory
   - No immediate user impact
3. **If connection issue:**
   - Check `REDIS_URL` env var
   - Verify network connectivity
4. **Validate:** Health check returns 200

---

## RUNBOOK 3: SECURITY INCIDENT

### Detection

- Security event spike in logs
- Unusual API key usage patterns
- User reports suspicious activity

### Response

1. **Contain:**
   - Revoke affected API keys immediately
   - Block suspicious IPs at firewall level
2. **Investigate:**
   - Query security events for timeframe
   - Check audit logs for affected users
   - Review access patterns
3. **Notify:**
   - SEV-1: Legal + CEO within 1 hour
   - SEV-2: Engineering lead within 4 hours
   - Users affected within 24 hours (GDPR requirement)
4. **Remediate:**
   - Patch vulnerability
   - Rotate all secrets
   - Force password resets if needed
5. **Document:** Write postmortem within 48 hours

---

## RUNBOOK 4: DEPLOYMENT FAILURE

### Detection

- CI/CD pipeline fails
- Health check fails after deploy
- Error rate spike in Sentry

### Response

1. **Stop deploy:** Cancel any in-progress rollout
2. **Rollback:**
   - Render: `render rollback --id <previous>`
   - Vercel: Instant via dashboard
3. **Verify:** Previous version healthy
4. **Investigate:** Check recent commits, env vars
5. **Fix:** Reproduce in staging, fix, re-deploy

---

## ESCALATION CONTACTS

| Role             | Contact   | Method        |
| ---------------- | --------- | ------------- |
| On-call Engineer | PagerDuty | PagerDuty app |
| Engineering Lead | Akshay    | Slack + Phone |
| Security Lead    | Akshay    | Slack + Phone |
| CEO              | Akshay    | Phone         |
| Legal            | —         | Email         |

---

## POST-INCIDENT REVIEW TEMPLATE

```
## Incident: [Title]
- Date: [YYYY-MM-DD HH:MM UTC]
- Severity: [SEV-1/2/3/4]
- Duration: [X minutes]
- Detected by: [monitoring/user]

## Timeline
- [HH:MM] Detection
- [HH:MM] Response started
- [HH:MM] Mitigation applied
- [HH:MM] Service restored

## Root Cause
[1-2 sentences]

## Impact
[Users affected, data lost, revenue impact]

## Action Items
- [ ] Fix: [owner] [due date]
- [ ] Prevent: [owner] [due date]
- [ ] Monitor: [owner] [due date]
```

---

_Runbook maintained by DevOps team. Reviewed quarterly._
