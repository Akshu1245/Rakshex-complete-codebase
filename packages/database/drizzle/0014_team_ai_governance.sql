-- Team AI governance: identities, usage events, budgets, kill switches, sync runs.

DO $$ BEGIN CREATE TYPE team_ai_identity_status AS ENUM (
  'active', 'inactive', 'suspended', 'unknown'
); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE team_ai_usage_source AS ENUM (
  'gateway', 'admin_api', 'analytics_api', 'cloud_billing', 'otel', 'csv', 'manual'
); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE team_ai_budget_period AS ENUM ('monthly');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE team_ai_enforcement_mode AS ENUM (
  'gateway', 'provider_native', 'monitor_only'
); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE runtime_kill_scope_type AS ENUM (
  'workspace', 'identity', 'project', 'agent'
); EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE provider_sync_run_status AS ENUM (
  'pending', 'running', 'success', 'partial', 'failed', 'not_configured', 'not_implemented'
); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS team_ai_identities (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  workspace_user_id INTEGER,
  provider control_plane_provider NOT NULL,
  external_user_id VARCHAR(255) NOT NULL,
  email VARCHAR(320),
  display_name VARCHAR(255),
  subscription_seat_id INTEGER,
  status team_ai_identity_status NOT NULL DEFAULT 'active',
  metadata JSON,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS team_ai_identities_ws_provider_ext_uniq
  ON team_ai_identities (workspace_id, provider, external_user_id);
CREATE INDEX IF NOT EXISTS team_ai_identities_workspace_idx ON team_ai_identities (workspace_id);
CREATE INDEX IF NOT EXISTS team_ai_identities_email_idx ON team_ai_identities (email);
CREATE INDEX IF NOT EXISTS team_ai_identities_workspace_user_idx ON team_ai_identities (workspace_user_id);

CREATE TABLE IF NOT EXISTS team_ai_usage_events (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  identity_id INTEGER,
  provider_account_id INTEGER,
  provider control_plane_provider NOT NULL,
  source team_ai_usage_source NOT NULL,
  external_event_id VARCHAR(255) NOT NULL,
  occurred_at TIMESTAMP NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd DECIMAL(18, 8) NOT NULL DEFAULT 0,
  model VARCHAR(128),
  product VARCHAR(128),
  confidence control_plane_evidence_confidence NOT NULL DEFAULT 'imported',
  metadata JSON,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS team_ai_usage_events_ws_ext_uniq
  ON team_ai_usage_events (workspace_id, external_event_id);
CREATE INDEX IF NOT EXISTS team_ai_usage_events_ws_occurred_idx
  ON team_ai_usage_events (workspace_id, occurred_at);
CREATE INDEX IF NOT EXISTS team_ai_usage_events_identity_idx ON team_ai_usage_events (identity_id);
CREATE INDEX IF NOT EXISTS team_ai_usage_events_provider_idx ON team_ai_usage_events (provider);

CREATE TABLE IF NOT EXISTS team_ai_budgets (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  identity_id INTEGER,
  period team_ai_budget_period NOT NULL DEFAULT 'monthly',
  limit_usd DECIMAL(18, 4) NOT NULL,
  warning_pct INTEGER NOT NULL DEFAULT 80,
  hard_limit BOOLEAN NOT NULL DEFAULT false,
  enforcement_mode team_ai_enforcement_mode NOT NULL DEFAULT 'monitor_only',
  current_spend_usd DECIMAL(18, 8) NOT NULL DEFAULT 0,
  period_start TIMESTAMP,
  metadata JSON,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS team_ai_budgets_ws_default_period_uniq
  ON team_ai_budgets (workspace_id, period) WHERE identity_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS team_ai_budgets_ws_identity_period_uniq
  ON team_ai_budgets (workspace_id, identity_id, period) WHERE identity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS team_ai_budgets_workspace_idx ON team_ai_budgets (workspace_id);

CREATE TABLE IF NOT EXISTS runtime_kill_switches (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  scope_type runtime_kill_scope_type NOT NULL,
  scope_id VARCHAR(128) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  set_by INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS runtime_kill_switches_ws_scope_uniq
  ON runtime_kill_switches (workspace_id, scope_type, scope_id);
CREATE INDEX IF NOT EXISTS runtime_kill_switches_workspace_idx ON runtime_kill_switches (workspace_id);
CREATE INDEX IF NOT EXISTS runtime_kill_switches_active_idx
  ON runtime_kill_switches (workspace_id, active);

CREATE TABLE IF NOT EXISTS provider_sync_runs (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  provider control_plane_provider NOT NULL,
  provider_account_id INTEGER,
  status provider_sync_run_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP NOT NULL DEFAULT now(),
  finished_at TIMESTAMP,
  latency_ms INTEGER,
  seats_synced INTEGER DEFAULT 0,
  usage_events_synced INTEGER DEFAULT 0,
  error_code VARCHAR(64),
  error_message TEXT,
  metadata JSON,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provider_sync_runs_ws_provider_idx
  ON provider_sync_runs (workspace_id, provider);
CREATE INDEX IF NOT EXISTS provider_sync_runs_started_idx
  ON provider_sync_runs (workspace_id, started_at);
