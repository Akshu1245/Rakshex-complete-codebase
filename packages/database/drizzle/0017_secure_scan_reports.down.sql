DROP INDEX IF EXISTS "scan_reports_expires_at_idx";
DROP INDEX IF EXISTS "scan_reports_workspace_created_idx";
DROP INDEX IF EXISTS "scan_reports_owner_created_idx";

ALTER TABLE "scan_reports"
  DROP COLUMN IF EXISTS "revoked_at",
  DROP COLUMN IF EXISTS "expires_at",
  DROP COLUMN IF EXISTS "scan_id",
  DROP COLUMN IF EXISTS "workspace_id",
  DROP COLUMN IF EXISTS "owner_user_id";
