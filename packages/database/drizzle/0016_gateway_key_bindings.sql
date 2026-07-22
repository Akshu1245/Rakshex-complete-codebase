-- Bind gateway API keys to canonical identities/agents when configured.

ALTER TABLE "api_keys"
  ADD COLUMN IF NOT EXISTS "identity_id" integer,
  ADD COLUMN IF NOT EXISTS "agent_id" varchar(128);

CREATE INDEX IF NOT EXISTS "api_keys_workspace_identity_idx"
  ON "api_keys" ("workspace_id", "identity_id")
  WHERE "identity_id" IS NOT NULL;
