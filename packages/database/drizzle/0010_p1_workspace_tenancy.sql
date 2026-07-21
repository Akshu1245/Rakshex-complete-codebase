-- P1: workspace tenancy indexes + scans.workspace_id for tenant-safe buyer journey.
-- Prefer ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS for idempotent deploys.

ALTER TABLE "scans" ADD COLUMN IF NOT EXISTS "workspace_id" INTEGER;

CREATE INDEX IF NOT EXISTS "collections_workspace_id_idx" ON "collections" ("workspace_id");
CREATE INDEX IF NOT EXISTS "findings_workspace_id_idx" ON "findings" ("workspace_id");
CREATE INDEX IF NOT EXISTS "scans_workspace_id_idx" ON "scans" ("workspace_id");

-- Optional FK when workspaces table exists (market-ready foundation).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'workspaces'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'scans_workspace_id_fk'
  ) THEN
    ALTER TABLE "scans"
      ADD CONSTRAINT "scans_workspace_id_fk"
      FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;
