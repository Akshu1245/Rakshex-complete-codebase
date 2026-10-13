-- P1 / PR #233. Additive only. Run on the isolated RaksHex app D1.
-- Sessions are internal to the future verified authentication adapter.
-- Do not expose a session-creation HTTP endpoint before PR #234.
CREATE TABLE IF NOT EXISTS cf_browser_sessions (
  token_hash TEXT PRIMARY KEY CHECK(length(token_hash) = 64),
  workspace_id INTEGER NOT NULL,
  subject_id TEXT NOT NULL,
  membership_revision INTEGER NOT NULL CHECK(membership_revision >= 1),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (workspace_id, subject_id)
    REFERENCES cf_workspace_memberships (workspace_id, subject_id)
    ON DELETE RESTRICT,
  CHECK(expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS cf_browser_sessions_subject
  ON cf_browser_sessions(workspace_id, subject_id, expires_at);
CREATE INDEX IF NOT EXISTS cf_browser_sessions_live
  ON cf_browser_sessions(expires_at, revoked_at);
