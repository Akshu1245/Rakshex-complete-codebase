-- Workspace tenancy for gateway audit rows.

ALTER TABLE "gateway_audit"
  ADD COLUMN IF NOT EXISTS "workspace_id" integer;

CREATE INDEX IF NOT EXISTS "gateway_audit_workspace_id_idx"
  ON "gateway_audit" ("workspace_id");
