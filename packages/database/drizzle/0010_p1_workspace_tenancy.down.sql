DROP INDEX IF EXISTS "scans_workspace_id_idx";
DROP INDEX IF EXISTS "findings_workspace_id_idx";
DROP INDEX IF EXISTS "collections_workspace_id_idx";

ALTER TABLE "scans" DROP CONSTRAINT IF EXISTS "scans_workspace_id_fk";
ALTER TABLE "scans" DROP COLUMN IF EXISTS "workspace_id";
