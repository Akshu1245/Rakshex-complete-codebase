-- Scope outbound webhook registrations to a workspace instead of a user.

ALTER TABLE "webhook_endpoints"
  ADD COLUMN IF NOT EXISTS "workspace_id" integer;

-- Preserve legacy endpoints by assigning them to the owner's personal
-- workspace first, or their oldest owned workspace as a fallback.
UPDATE "webhook_endpoints" AS endpoint
SET "workspace_id" = (
  SELECT workspace."id"
  FROM "workspaces" AS workspace
  WHERE workspace."ownerUserId" = endpoint."userId"
  ORDER BY workspace."isPersonal" DESC, workspace."createdAt" ASC
  LIMIT 1
)
WHERE endpoint."workspace_id" IS NULL;

CREATE INDEX IF NOT EXISTS "webhook_endpoints_workspace_id_idx"
  ON "webhook_endpoints" ("workspace_id");
