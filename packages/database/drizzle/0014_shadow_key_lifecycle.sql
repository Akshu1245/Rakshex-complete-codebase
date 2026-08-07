-- Tenant-safe shadow-key deduplication and remediation lifecycle.

ALTER TABLE "shadow_keys"
  ADD COLUMN IF NOT EXISTS "assignee_user_id" integer,
  ADD COLUMN IF NOT EXISTS "resolution_note" text,
  ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp DEFAULT now() NOT NULL;

-- Historical runs could create duplicates because key_hash was indexed but
-- not unique. Preserve the oldest canonical row and its lifecycle state.
DELETE FROM "shadow_keys" newer
USING "shadow_keys" canonical
WHERE newer."workspace_id" = canonical."workspace_id"
  AND newer."key_hash" = canonical."key_hash"
  AND newer."id" > canonical."id";

CREATE UNIQUE INDEX IF NOT EXISTS "shadow_keys_workspace_key_uniq"
  ON "shadow_keys" ("workspace_id", "key_hash");

CREATE INDEX IF NOT EXISTS "shadow_keys_workspace_status_idx"
  ON "shadow_keys" ("workspace_id", "status", "last_seen_at");
