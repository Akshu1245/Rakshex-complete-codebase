-- Agent Firewall v0.1: identity, attenuating authority, action ledger and exact approvals.
-- Renumbered from the release-candidate ZIP's 0021_agent_firewall.sql to 0022 because
-- this live branch already used 0021 for mcp_server_command (stdio MCP invocation fix).

DO $$ BEGIN CREATE TYPE agent_identity_status AS ENUM ('active', 'paused', 'revoked');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE agent_firewall_mode AS ENUM ('shadow', 'enforce');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE action_decision AS ENUM (
  'ALLOW', 'DENY', 'APPROVAL_REQUIRED', 'LIMIT', 'REDACT', 'SANDBOX', 'PAUSE', 'FREEZE'
); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE action_effective_decision AS ENUM ('ALLOW', 'DENY', 'PENDING_APPROVAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE action_approval_status AS ENUM (
  'pending', 'approved', 'rejected', 'expired', 'consumed'
); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS agent_identities (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  agent_key VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  owner_user_id INTEGER NOT NULL,
  framework VARCHAR(64),
  model VARCHAR(128),
  environment VARCHAR(32) NOT NULL DEFAULT 'production',
  version VARCHAR(64) NOT NULL DEFAULT '1',
  mode agent_firewall_mode NOT NULL DEFAULT 'shadow',
  status agent_identity_status NOT NULL DEFAULT 'active',
  capabilities JSON NOT NULL DEFAULT '[]'::json,
  policy_config JSON,
  metadata JSON,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS agent_identities_ws_key_uniq
  ON agent_identities (workspace_id, agent_key);
CREATE INDEX IF NOT EXISTS agent_identities_workspace_idx ON agent_identities (workspace_id);
CREATE INDEX IF NOT EXISTS agent_identities_owner_idx ON agent_identities (owner_user_id);

CREATE TABLE IF NOT EXISTS delegated_authorities (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  agent_id VARCHAR(64) NOT NULL,
  principal_user_id INTEGER NOT NULL,
  issued_by_user_id INTEGER NOT NULL,
  parent_authority_id VARCHAR(64),
  scope JSON NOT NULL,
  scope_hash VARCHAR(64) NOT NULL,
  capability_token_hash VARCHAR(64) NOT NULL,
  capability_prefix VARCHAR(20) NOT NULL,
  depth INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  use_count INTEGER NOT NULL DEFAULT 0,
  amount_used_minor NUMERIC(20, 0) NOT NULL DEFAULT 0,
  valid_from TIMESTAMP NOT NULL DEFAULT now(),
  expires_at TIMESTAMP,
  revoked_at TIMESTAMP,
  revoked_by_user_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS delegated_authorities_workspace_idx ON delegated_authorities (workspace_id);
CREATE INDEX IF NOT EXISTS delegated_authorities_agent_idx ON delegated_authorities (agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS delegated_authorities_cap_hash_uniq
  ON delegated_authorities (capability_token_hash);
CREATE INDEX IF NOT EXISTS delegated_authorities_active_idx
  ON delegated_authorities (workspace_id, agent_id, status);

CREATE TABLE IF NOT EXISTS action_ledger (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  project_id VARCHAR(64),
  agent_id VARCHAR(64) NOT NULL,
  principal_user_id INTEGER NOT NULL,
  authority_id VARCHAR(64),
  trace_id VARCHAR(128) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  mode agent_firewall_mode NOT NULL,
  semantic_action VARCHAR(128) NOT NULL,
  action_version VARCHAR(16) NOT NULL DEFAULT '0.1',
  domain VARCHAR(32) NOT NULL,
  effect VARCHAR(32) NOT NULL,
  parameters_redacted JSON NOT NULL,
  resource VARCHAR(512),
  environment VARCHAR(32),
  raw_reference JSON NOT NULL,
  policy_version VARCHAR(128) NOT NULL,
  decision action_decision NOT NULL,
  effective_decision action_effective_decision NOT NULL,
  reasons JSON NOT NULL,
  amount_minor NUMERIC(20, 0),
  currency VARCHAR(3),
  approval_id VARCHAR(64),
  outcome_status VARCHAR(32) NOT NULL DEFAULT 'not_executed',
  outcome JSON,
  previous_hash VARCHAR(64),
  record_hash VARCHAR(64) NOT NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT now(),
  completed_at TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS action_ledger_ws_idempotency_uniq
  ON action_ledger (workspace_id, idempotency_key);
CREATE INDEX IF NOT EXISTS action_ledger_ws_occurred_idx
  ON action_ledger (workspace_id, occurred_at);
CREATE INDEX IF NOT EXISTS action_ledger_agent_occurred_idx
  ON action_ledger (agent_id, occurred_at);
CREATE INDEX IF NOT EXISTS action_ledger_trace_idx ON action_ledger (trace_id);

CREATE TABLE IF NOT EXISTS action_approvals (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  ledger_id VARCHAR(64) NOT NULL,
  requested_by_agent_id VARCHAR(64) NOT NULL,
  semantic_action VARCHAR(128) NOT NULL,
  resource VARCHAR(512),
  amount_minor NUMERIC(20, 0),
  currency VARCHAR(3),
  status action_approval_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP NOT NULL,
  resolved_at TIMESTAMP,
  resolved_by_user_id INTEGER,
  resolution_note TEXT,
  consumed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS action_approvals_ledger_uniq ON action_approvals (ledger_id);
CREATE INDEX IF NOT EXISTS action_approvals_ws_status_idx
  ON action_approvals (workspace_id, status);

-- Compatibility for the older telemetry policy middleware. New Agent Firewall
-- approvals use action_approvals, but this prevents legacy policy requests from
-- failing at runtime while they are migrated.
CREATE TABLE IF NOT EXISTS pending_approvals (
  approval_id VARCHAR(64) PRIMARY KEY,
  workspace_id VARCHAR(128) NOT NULL,
  rule_id VARCHAR(128),
  event_snapshot JSON NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(64),
  resolution_note TEXT
);
CREATE INDEX IF NOT EXISTS pending_approvals_ws_status_idx
  ON pending_approvals (workspace_id, status, requested_at);
