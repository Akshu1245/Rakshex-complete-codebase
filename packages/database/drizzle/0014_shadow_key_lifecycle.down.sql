-- Rollback for 0014_shadow_key_lifecycle.sql
-- Drops uniqueness; does not recreate deleted duplicate rows.
-- Prefer restore-from-backup for production.

DROP INDEX IF EXISTS "shadow_keys_workspace_status_idx";
DROP INDEX IF EXISTS "shadow_keys_workspace_key_uniq";

ALTER TABLE "shadow_keys"
  DROP COLUMN IF EXISTS "last_seen_at",
  DROP COLUMN IF EXISTS "resolution_note",
  DROP COLUMN IF EXISTS "assignee_user_id";
