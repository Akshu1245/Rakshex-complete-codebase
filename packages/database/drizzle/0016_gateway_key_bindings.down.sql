DROP INDEX IF EXISTS "api_keys_workspace_identity_idx";

ALTER TABLE "api_keys"
  DROP COLUMN IF EXISTS "agent_id",
  DROP COLUMN IF EXISTS "identity_id";
