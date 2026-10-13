-- Issue #225: additive authorization membership foundation in isolated Cloudflare app D1.
-- This does NOT implement browser authentication, create sessions, or grant access.
-- Do not apply to the original rakshex-firewall D1 or to PostgreSQL.
-- Subject IDs must come from a validated Better Auth/Auth.js session when auth is wired.
CREATE TABLE IF NOT EXISTS cf_workspace_memberships (
  workspace_id INTEGER NOT NULL REFERENCES cf_workspaces(id) ON DELETE RESTRICT,
  subject_id TEXT NOT NULL CHECK (length(subject_id) BETWEEN 1 AND 128),
  role TEXT NOT NULL CHECK (role IN ('owner','admin','member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  PRIMARY KEY (workspace_id, subject_id),
  CHECK (
    (status = 'active' AND revoked_at IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS cf_memberships_subject_status
  ON cf_workspace_memberships(subject_id, status, workspace_id);
