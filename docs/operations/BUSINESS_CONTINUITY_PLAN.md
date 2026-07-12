# Business Continuity and Recovery Plan

Owner: Platform Lead

## Objectives

Maintain a recoverable hosted control plane, protect credentials and tenant boundaries, communicate honestly during disruption, and restore service from tested infrastructure and backups.

## Recovery Priorities

1. Identity, tenant authorisation, credential vault, and audit integrity.
2. Database, Redis, API health, and secure rate limiting.
3. Customer dashboard, scan and policy workflows, notification paths.
4. Optional provider connectors, analytics, and non-critical integrations.

## Baseline Controls

- Production database backups and restore verification.
- Infrastructure-as-code or documented Railway/Vercel configuration.
- Separate production secrets, least-privilege access, and emergency credential revocation.
- Health checks, deployment rollback, dependency status monitoring, and an incident communications owner.
- Quarterly restore exercise with recorded recovery time and data-loss observations.

## Recovery Procedure

Assess impact; declare an incident; freeze unsafe changes; restore database and secrets from approved sources; deploy a known-good build; verify health, authentication, tenant isolation, audit logging, and critical flows; notify customers as appropriate; and complete a post-incident review.

RTO/RPO commitments are not public guarantees unless specified in an executed enterprise Order Form.
