DROP INDEX IF EXISTS "gateway_audit_workspace_id_idx";
ALTER TABLE "gateway_audit" DROP COLUMN IF EXISTS "workspace_id";
