-- STAGING-ONLY Cloudflare-native tables for the first migrated YC #13 workflow.
-- Deliberately NOT a conversion of legacy PostgreSQL business tables.
-- No DROP, DELETE, TRUNCATE, reset or production D1 reference.
CREATE TABLE IF NOT EXISTS contract_diff_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  input_sha256 TEXT NOT NULL CHECK(length(input_sha256) = 64),
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'completed', 'failed')),
  breaking INTEGER CHECK(breaking IN (0, 1)),
  changes_json TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_contract_diff_jobs_status_created
  ON contract_diff_jobs (status, created_at);
