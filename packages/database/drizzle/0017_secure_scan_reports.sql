-- Secure shareable reports: authenticated creation, ownership, expiry, revocation.

ALTER TABLE "scan_reports"
  ADD COLUMN IF NOT EXISTS "owner_user_id" integer,
  ADD COLUMN IF NOT EXISTS "workspace_id" integer,
  ADD COLUMN IF NOT EXISTS "scan_id" varchar(64),
  ADD COLUMN IF NOT EXISTS "expires_at" timestamp,
  ADD COLUMN IF NOT EXISTS "revoked_at" timestamp;

-- Legacy public reports were created from caller-supplied content and have no
-- trustworthy owner. Expire them immediately rather than continuing to expose
-- potentially forged security results.
UPDATE "scan_reports"
SET "expires_at" = COALESCE("expires_at", now())
WHERE "owner_user_id" IS NULL;

CREATE INDEX IF NOT EXISTS "scan_reports_owner_created_idx"
  ON "scan_reports" ("owner_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "scan_reports_workspace_created_idx"
  ON "scan_reports" ("workspace_id", "created_at");
CREATE INDEX IF NOT EXISTS "scan_reports_expires_at_idx"
  ON "scan_reports" ("expires_at");
