DROP INDEX IF EXISTS "webhook_endpoints_workspace_id_idx";
ALTER TABLE "webhook_endpoints" DROP COLUMN IF EXISTS "workspace_id";
