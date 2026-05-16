-- Migration: Policy Rules + Pending Approvals
-- 
-- policy_rules: condition-action rules evaluated in priority order
-- pending_approvals: blocked events awaiting manual review
--
-- Rollback: DROP TABLE pending_approvals; DROP TABLE policy_rules;

CREATE TABLE IF NOT EXISTS policy_rules (
  rule_id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  conditions JSON NOT NULL,
  action ENUM('allow','block','redact','alert_only','require_approval') NOT NULL DEFAULT 'alert_only',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
  deleted_at TIMESTAMP NULL,
  INDEX idx_workspace (workspace_id),
  INDEX idx_enabled_priority (workspace_id, enabled, priority)
);

CREATE TABLE IF NOT EXISTS pending_approvals (
  approval_id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(64) NOT NULL,
  rule_id VARCHAR(64) NOT NULL,
  event_snapshot JSON NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP NULL,
  resolved_by INT NULL,
  resolution_note TEXT,
  INDEX idx_workspace_status (workspace_id, status),
  INDEX idx_status (status)
);
