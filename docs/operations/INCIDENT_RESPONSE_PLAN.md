# Incident Response Plan

Owner: Security Lead

Review cadence: quarterly and after every P1 incident

## 1. Trigger

Open an incident for confirmed or suspected unauthorised access, credential exposure, personal-data breach, cross-tenant access, provider compromise, material availability failure, active exploitation, or policy failure with material impact.

The incident commander records the time, reporter, affected service, workspace, data classes, severity, decisions, evidence location, and external notifications. Do not place credentials, raw prompts, payment data, or sensitive evidence in general chat.

## 2. Severity

P1: active compromise, confirmed cross-tenant access, material personal-data exposure, global production outage, or provider key exposure with active risk.

P2: confirmed vulnerability or partial outage with a workaround and limited scope.

P3: contained issue, failed control with no confirmed exposure, or low-impact defect.

## 3. First Hour

1. Acknowledge, name an incident commander and communications owner, and open a restricted incident record.
2. Preserve evidence: request IDs, audit events, deployment IDs, provider logs, relevant configuration, and timestamps.
3. Contain: disable affected integration, revoke or rotate credentials, invoke the workspace kill switch, restrict access, roll back deployment, or isolate the workload.
4. Assess scope: affected workspaces, users, data categories, providers, regions, and ongoing attacker activity.
5. Decide whether legal, privacy, payment, provider, law-enforcement, insurer, or CERT-In reporting may be required. Escalate to qualified counsel for regulatory determinations.

## 4. Communication

Use factual, time-stamped updates. State what is known, unknown, actions taken, customer impact, and next update time. Do not speculate, minimise, or promise a root cause before evidence supports it.

For a Customer Data incident, notify the affected Customer without undue delay after confirmation and provide available details needed for its legal response. Follow executed DPA/SLA commitments. The incident commander and counsel determine external notices, including CERT-In or data-protection authority notices.

## 5. Recovery

Remove persistence, rotate credentials, patch and test, restore from clean backups if needed, verify tenant boundaries, monitor for recurrence, and obtain incident-commander approval before closing. Preserve evidence and decision records.

## 6. Post-Incident Review

Within 10 business days, document timeline, impact, cause, detection gap, corrective actions, owner, due date, and customer-facing summary if appropriate. Track actions to completion in the launch or security register.
