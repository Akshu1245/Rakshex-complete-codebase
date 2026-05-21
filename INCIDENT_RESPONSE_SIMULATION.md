# Rakshex Incident Response Simulation

> Practice before panic.
> Date: 2026-05-17

---

## SIMULATION 1: DATABASE FAILURE

### Scenario

Primary MySQL instance crashes during peak hours (Tuesday 2 PM IST).

### Timeline

**T+0 min — Detection**

- Alert: "MySQL connection errors > 5%"
- On-call receives P0 page
- SRE confirms: database unreachable

**T+2 min — Response**

- SRE checks RDS dashboard: instance status = "Failed"
- Decision: Failover to read replica
- Execute: `aws rds promote-read-replica rakshex-db-replica`

**T+5 min — Assessment**

- Replica promoted, accepting writes
- Check data consistency: ✅ Last transaction 30s ago
- Notify team in #incidents Slack

**T+8 min — Recovery**

- API servers restart connections
- Health checks passing
- Monitor error rates: dropping

**T+15 min — Verification**

- All services green
- Queue processing resumes
- User impact: 8 min of degraded service

**T+30 min — Communication**

- Post-mortem draft started
- User notification: "Brief service interruption resolved"

---

## SIMULATION 2: API PROVIDER OUTAGE

### Scenario

OpenAI API returns 503 errors for 30 minutes. Rakshex users can't validate keys.

### Timeline

**T+0 min — Detection**

- Alert: "OpenAI API error rate > 10%"
- Error classification: provider outage

**T+1 min — Response**

- Circuit breaker trips automatically
- Queue scan jobs with OpenAI dependency
- Show user-friendly message: "OpenAI is experiencing issues. Retrying automatically."

**T+5 min — Assessment**

- Check status.openai.com: confirmed outage
- Evaluate: Can we skip OpenAI-dependent checks?
- Decision: Run non-OpenAI checks, queue OpenAI checks for retry

**T+10 min — Mitigation**

- Resume partial service
- Back off OpenAI requests (exponential)
- Alert users via in-app notification

**T+30 min — Recovery**

- OpenAI service restored
- Circuit breaker closes
- Process queued jobs

**T+35 min — Verification**

- Full service restored
- No data loss
- User impact: 30 min of partial service

---

## SIMULATION 3: MALICIOUS PAYLOAD STORM

### Scenario

Attacker sends 10,000 malformed scan requests / second.

### Timeline

**T+0 min — Detection**

- Alert: "Request rate > 10,000/s from single IP"
- WAF flags: "Potential DDoS"

**T+1 min — Response**

- Rate limiter activates (100 req/min per IP)
- Block offending IP at WAF level
- Alert security team

**T+3 min — Assessment**

- Check if legitimate traffic affected: No
- Review blocked requests: all malformed
- No valid user impact

**T+5 min — Recovery**

- Normal traffic patterns resume
- WAF rule updated for pattern
- Incident logged

---

## INCIDENT RESPONSE PLAYBOOK

### Severity Definitions

| Level | Name     | Examples                                 | Response Time |
| ----- | -------- | ---------------------------------------- | ------------- |
| SEV1  | Critical | Service down, data loss, security breach | 5 min         |
| SEV2  | Major    | Degraded service, partial outage         | 15 min        |
| SEV3  | Minor    | Feature broken, workarounds exist        | 1 hour        |
| SEV4  | Low      | Cosmetic, non-urgent                     | 1 day         |

### Response Roles

| Role               | Responsibility                    | Primary | Backup |
| ------------------ | --------------------------------- | ------- | ------ |
| Incident Commander | Decision authority, communication | Akshay  | \_\_\_ |
| SRE                | Technical response, mitigation    | \_\_\_  | \_\_\_ |
| Engineering        | Code fixes, deployments           | \_\_\_  | \_\_\_ |
| Communications     | User updates, status page         | \_\_\_  | \_\_\_ |

### Communication Templates

**SEV1 — User Notification:**

```
Rakshex is experiencing a service disruption.

Impact: [Brief description]
Started: [Time]
Status: We're actively working on a fix.
ETA: [Time or "Investigating"]

Updates: [status.rakshex.in link]
```

**SEV1 — Internal:**

```
🚨 SEV1 Incident — [Name]
Impact: [Service affected]
Started: [Time]
Commander: [Name]
Status: [Investigating / Mitigating / Resolved]

Thread: [Slack thread link]
```

### Post-Mortem Template

```
# Post-Mortem: [Incident Name]
Date: [Date]
Severity: [SEV1/2/3]
Duration: [X minutes]
Impact: [Description]

## Timeline
[T+0] — [Event]
[T+X] — [Event]

## Root Cause
[What happened and why]

## Resolution
[How we fixed it]

## Prevention
- [Action item 1] (owner, due date)
- [Action item 2] (owner, due date)

## Lessons Learned
[What we learned]
```

---

_Simulations run monthly._
_Playbook reviewed quarterly._
