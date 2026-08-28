# RaksHex Incident Response

Use this process for security, availability, billing, and data-integrity incidents. Hosted-service actions must follow the active production provider and `docs/operations/PRODUCTION_DEPLOYMENT_RUNBOOK.md`; historical DevPulse paths and image names are not valid recovery instructions.

## Severity levels

| Level | Definition | Initial response target |
| --- | --- | --- |
| P0 — Critical | Confirmed auth bypass, cross-tenant data exposure, credential compromise with active abuse, destructive agent action, or material payment/data loss | 15 minutes |
| P1 — High | Major outage, broken authentication/signup, widespread gateway enforcement failure, or billing/webhook failure affecting customers | 30 minutes |
| P2 — Medium | Partial outage, degraded sync/worker operation, isolated incorrect behavior without confirmed exposure | 2 hours |
| P3 — Low | Non-critical bug, cosmetic issue, low-risk documentation/operational defect | Next planned maintenance window |

## Incident commander checklist

1. Assign an incident ID and severity.
2. Record start time, affected services/workspaces, and current evidence.
3. Contain first; do not perform speculative destructive fixes.
4. Preserve relevant application logs, audit records, Action Ledger entries, deployment SHA, and provider delivery IDs.
5. Post regular P0/P1 status updates in the private incident channel.
6. Track every production change made during the incident.
7. Define recovery verification before declaring resolved.
8. Produce a postmortem for P0/P1 incidents.

## Immediate security containment

For a suspected leaked credential, bypass, or unsafe autonomous action:

- Activate the appropriate RaksHex kill switch for routed traffic when safe to do so.
- Revoke/rotate affected provider credentials through the provider's supported control plane.
- Disable compromised workspace/API keys.
- Preserve evidence before cleanup.
- Do not paste raw secrets, prompts, customer payloads, or tokens into tickets or chat.
- Remember the product boundary: RaksHex cannot stop direct provider traffic that bypasses RaksHex unless the provider-native control was successfully configured.

## Application rollback

Rollback the application to a known-good immutable release using the active hosting/deployment system. Record both the bad SHA and the rollback SHA.

For a self-hosted Docker Compose installation, rebuild/redeploy from the known-good repository tag or SHA rather than inventing a new image locally during the incident.

After rollback:

```bash
curl -fsS "$API_URL/api/health"
curl -fsS "$API_URL/api/health/ready"
API_URL="$API_URL" pnpm smoke:test
```

## Database recovery

Database recovery is a controlled operation, not an automatic rollback step.

1. Stop or isolate writes if continuing writes would worsen corruption.
2. Identify the last verified backup and current migration state.
3. Prefer restoring into a separate recovery database first.
4. Verify integrity and required records.
5. Promote only after explicit incident-command approval.
6. Apply repository migrations with the canonical command:

```bash
pnpm db:migrate
```

Do not use ad-hoc `drizzle-kit migrate`, destructive schema edits, or a historical database name from old documentation.

Repository backup/restore verification commands:

```bash
pnpm db:backup
pnpm db:restore-test
```

## Payment webhook recovery

1. Identify affected Stripe/Razorpay event IDs in the provider dashboard.
2. Confirm signature/webhook configuration is correct without exposing the secret.
3. Check whether the event was already processed; preserve idempotency.
4. Replay only provider-supported failed deliveries that are safe to replay.
5. Verify resulting entitlement/subscription state and audit records.
6. Run a controlled test transaction only with explicit operator approval and appropriate test/live mode.

## Queue/worker recovery

- Confirm Redis health first.
- Inspect worker logs and queue failure reasons.
- Fix the underlying dependency or poison job before bulk retries.
- Never switch production to the development in-memory queue to hide Redis failure.

## Customer/data exposure response

If cross-tenant or personal-data exposure is suspected:

- Preserve tenant IDs, request IDs, timestamps, and affected object identifiers without copying unnecessary content.
- Restrict access to evidence.
- Follow `docs/SECURITY.md`, `docs/PRIVACY.md`, and the legal/privacy incident runbooks.
- Any regulatory/customer notification decision must be made by the authorised legal/privacy owner; source code cannot complete that responsibility.

## Recovery criteria

An incident is not resolved merely because the service returns 200. Verify the affected journey, for example:

- authentication and tenant isolation
- gateway allow/deny behavior
- kill-switch propagation
- usage/budget attribution
- worker processing
- payment entitlement state
- audit/Action Ledger persistence
- `/api/health` and `/api/health/ready`

Attach the exact commit/deployment SHA and evidence used to close the incident.

## Postmortem

For P0/P1 incidents, document within 48 hours where practical:

- impact and duration
- detection method
- root cause and contributing factors
- containment and recovery timeline
- what worked / failed in controls
- corrective actions with owners and deadlines
- tests or release gates added to prevent recurrence

Use `POSTMORTEM_TEMPLATE.md` when applicable.

## Ownership

Named engineering, security/privacy, infrastructure, and business escalation owners belong in a private operations/contact system, not hard-coded as personal details in this public repository. Public paid launch remains blocked until those owners are assigned and reachable.
