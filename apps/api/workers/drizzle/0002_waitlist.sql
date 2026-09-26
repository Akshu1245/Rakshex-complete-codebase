-- RaksHex Workers D1 migration 0002 — waitlist.
--
-- Private-beta waitlist signups collected by POST /v1/waitlist.
-- Email uniqueness is enforced at the DB level; duplicates are reported
-- as alreadyExists instead of resending the welcome email.

CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'Free',
  source TEXT NOT NULL DEFAULT 'web',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist (created_at);
