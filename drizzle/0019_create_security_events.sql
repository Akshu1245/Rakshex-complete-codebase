/**
 * Migration: create security_events table for prompt injection / PII leak tracking.
 *
 * Rollback plan:
 *   DROP TABLE security_events;
 */

ALTER TABLE security_events ADD CONSTRAINT fk_security_events_workspace
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- Index for querying by workspace + time range
CREATE INDEX idx_security_events_workspace_created
  ON security_events(workspace_id, created_at DESC);
