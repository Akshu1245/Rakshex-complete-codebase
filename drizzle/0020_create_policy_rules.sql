/**
 * Migration: create policy_rules table for declarative policy engine.
 *
 * Rollback plan:
 *   DROP TABLE IF EXISTS policy_rules;
 */
CREATE TABLE IF NOT EXISTS policy_rules (
  rule_id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  priority INT NOT NULL DEFAULT 0,
  conditions JSON NOT NULL,
  action ENUM('allow','block','redact','alert_only','require_approval') NOT NULL DEFAULT 'allow',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_policy_rules_workspace (workspace_id),
  INDEX idx_policy_rules_priority (workspace_id, priority)
);

/**
 * Migration: create pending_approvals table.
 *
 * Rollback plan:
 *   DROP TABLE IF EXISTS pending_approvals;
 */
CREATE TABLE IF NOT EXISTS pending_approvals (
  approval_id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL,
  rule_id VARCHAR(64) NOT NULL,
  event_snapshot JSON NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  resolved_by VARCHAR(64) NULL,
  resolution_note TEXT NULL,
  INDEX idx_pending_approvals_workspace (workspace_id),
  INDEX idx_pending_approvals_status (workspace_id, status)
);
