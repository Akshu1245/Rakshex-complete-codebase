-- Rollback for 0013_governance_extensions.sql
-- Prefer restore-from-backup for production; this is for staging/dev only.

DROP TABLE IF EXISTS "connector_health_snapshots";
DROP TABLE IF EXISTS "provider_health_incidents";
DROP TABLE IF EXISTS "provider_health_checks";
DROP TABLE IF EXISTS "connector_errors";
DROP TABLE IF EXISTS "connector_checkpoints";
DROP TABLE IF EXISTS "governance_usage_rollups";
DROP TABLE IF EXISTS "identity_resolution_events";
DROP TABLE IF EXISTS "subject_identity_links";
DROP TABLE IF EXISTS "governance_subjects";
DROP TABLE IF EXISTS "workspace_entitlements";

DROP INDEX IF EXISTS "workspace_members_workspace_user_uniq";

ALTER TABLE "workspace_invitations"
  DROP COLUMN IF EXISTS "seat_reserved_at",
  DROP COLUMN IF EXISTS "status";

ALTER TABLE "workspace_members"
  DROP COLUMN IF EXISTS "deactivated_at",
  DROP COLUMN IF EXISTS "suspended_at";

DROP TYPE IF EXISTS "provider_health_status";
DROP TYPE IF EXISTS "identity_link_type";
DROP TYPE IF EXISTS "governance_subject_kind";
