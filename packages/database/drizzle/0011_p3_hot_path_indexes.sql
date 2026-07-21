-- P3: composite indexes for hot list/filter paths (workspace + time, collection + status).

CREATE INDEX IF NOT EXISTS "collections_workspace_created_idx"
  ON "collections" ("workspace_id", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "findings_workspace_created_idx"
  ON "findings" ("workspace_id", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "findings_collection_status_idx"
  ON "findings" ("collectionId", "status");

CREATE INDEX IF NOT EXISTS "scans_workspace_created_idx"
  ON "scans" ("workspace_id", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "scans_collection_created_idx"
  ON "scans" ("collectionId", "createdAt" DESC);
