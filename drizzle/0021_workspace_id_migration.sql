/**
 * Migration: add workspace_id to user-owned tables (dual-write pattern).
 *
 * Rollback plan per migration:
 *   Mig 1: DROP TABLE workspaces (only if no other refs)
 *   Mig 2: DROP TABLE workspace_members
 *   Mig 3: ALTER TABLE DROP COLUMN workspace_id on each table
 *   Mig 4: (no rollback for backfill — data already migrated)
 *   Mig 5: (no rollback for NOT NULL — constraint only)
 *
 * NOTE: workspaces + workspace_members tables already exist in the schema.
 * This migration adds workspace_id columns to existing resource tables.
 */

-- Mig 3: add workspace_id (nullable) to user-owned tables
ALTER TABLE scans ADD COLUMN workspace_id VARCHAR(64) NULL;
ALTER TABLE api_collections ADD COLUMN workspace_id VARCHAR(64) NULL;
ALTER TABLE security_events ADD COLUMN workspace_id VARCHAR(64) NULL;
ALTER TABLE ai_events ADD COLUMN workspace_id VARCHAR(64) NULL;
ALTER TABLE compliance_reports ADD COLUMN workspace_id VARCHAR(64) NULL;
ALTER TABLE audit_log ADD COLUMN workspace_id VARCHAR(64) NULL;
ALTER TABLE webhook_endpoints ADD COLUMN workspace_id VARCHAR(64) NULL;
ALTER TABLE token_usage ADD COLUMN workspace_id VARCHAR(64) NULL;
ALTER TABLE api_keys ADD COLUMN workspace_id VARCHAR(64) NULL;

-- Mig 4: backfill — create default workspace for every user, copy IDs
-- (handled in application code via ensurePersonalWorkspace)

-- Mig 5: make workspace_id NOT NULL after backfill verified
-- ALTER TABLE scans MODIFY workspace_id VARCHAR(64) NOT NULL;
-- ALTER TABLE api_collections MODIFY workspace_id VARCHAR(64) NOT NULL;
-- ... etc.
