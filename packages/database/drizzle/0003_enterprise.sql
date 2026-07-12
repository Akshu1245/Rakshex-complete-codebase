-- Rakshex Enterprise schema migration
-- Adds Azure connections, key discovery, security analysis, AgentGuard, ISO27001, and usage tracking

-- Enums
DO $$ BEGIN CREATE TYPE azure_resource_type AS ENUM ('keyVault', 'servicePrincipal', 'apiManagement', 'managedIdentity', 'storageAccount'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE discovery_status AS ENUM ('pending', 'running', 'completed', 'failed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE key_rotation_status AS ENUM ('pending', 'approved', 'in_progress', 'completed', 'failed', 'rejected'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE overprivileged_category AS ENUM ('wildcard_permissions', 'unused_permissions', 'too_broad_scope', 'excessive_roles'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE agentguard_action AS ENUM ('revoke', 'rotate', 'alert_only', 'disable'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE agentguard_trigger AS ENUM ('leak_detected', 'overprivileged', 'expired_key', 'shadow_key', 'budget_exceeded', 'manual'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Azure Connections (encrypted SPN credentials per workspace)
CREATE TABLE IF NOT EXISTS azure_connections (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
  tenant_id VARCHAR(64) NOT NULL,
  subscription_id VARCHAR(64) NOT NULL,
  display_name VARCHAR(255),
  encrypted_client_id TEXT NOT NULL,
  encrypted_client_secret TEXT NOT NULL,
  auth_type VARCHAR(32) DEFAULT 'client_secret' NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);
CREATE INDEX idx_azure_connections_workspace ON azure_connections(workspace_id);

-- Discovered Azure Resources
CREATE TABLE IF NOT EXISTS azure_discovered_keys (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  connection_id INTEGER,
  resource_type azure_resource_type NOT NULL,
  resource_name VARCHAR(255) NOT NULL,
  resource_id TEXT,
  key_name VARCHAR(255) NOT NULL,
  key_type VARCHAR(64),
  key_hash VARCHAR(128),
  scopes JSON,
  is_expired BOOLEAN DEFAULT false NOT NULL,
  expires_at TIMESTAMP,
  last_rotated_at TIMESTAMP,
  assigned_to VARCHAR(255),
  status VARCHAR(32) DEFAULT 'active' NOT NULL,
  discovery_run_id VARCHAR(64),
  metadata JSON,
  discovered_at TIMESTAMP DEFAULT now() NOT NULL
);
CREATE INDEX idx_adk_workspace ON azure_discovered_keys(workspace_id);
CREATE INDEX idx_adk_resource_type ON azure_discovered_keys(resource_type);
CREATE INDEX idx_adk_key_hash ON azure_discovered_keys(key_hash);

-- Discovery Runs
CREATE TABLE IF NOT EXISTS discovery_runs (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  connection_id INTEGER,
  status discovery_status NOT NULL,
  resources_found INTEGER DEFAULT 0 NOT NULL,
  keys_found INTEGER DEFAULT 0 NOT NULL,
  error_message TEXT,
  started_at TIMESTAMP DEFAULT now() NOT NULL,
  completed_at TIMESTAMP
);
CREATE INDEX idx_dr_workspace ON discovery_runs(workspace_id);

-- Key Risk Assessments
CREATE TABLE IF NOT EXISTS key_risk_assessments (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  discovered_key_id INTEGER,
  category overprivileged_category NOT NULL,
  severity VARCHAR(16) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  evidence JSON,
  suggested_action TEXT,
  status VARCHAR(32) DEFAULT 'open' NOT NULL,
  acknowledged_at TIMESTAMP,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);
CREATE INDEX idx_kra_workspace ON key_risk_assessments(workspace_id);
CREATE INDEX idx_kra_key ON key_risk_assessments(discovered_key_id);

-- Shadow Keys
CREATE TABLE IF NOT EXISTS shadow_keys (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  key_hash VARCHAR(128) NOT NULL,
  key_prefix VARCHAR(32),
  provider VARCHAR(64) NOT NULL,
  discovered_in VARCHAR(255),
  discovered_by VARCHAR(64),
  risk_level VARCHAR(16) NOT NULL,
  is_in_vault BOOLEAN DEFAULT false NOT NULL,
  suggested_vault VARCHAR(255),
  status VARCHAR(32) DEFAULT 'open' NOT NULL,
  remediated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);
CREATE INDEX idx_sk_workspace ON shadow_keys(workspace_id);
CREATE INDEX idx_sk_key_hash ON shadow_keys(key_hash);

-- AgentGuard Policies
CREATE TABLE IF NOT EXISTS agent_guard_policies (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  triggers JSON NOT NULL,
  action agentguard_action NOT NULL,
  conditions JSON,
  is_enabled BOOLEAN DEFAULT true NOT NULL,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);
CREATE INDEX idx_agp_workspace ON agent_guard_policies(workspace_id);

-- AgentGuard Events
CREATE TABLE IF NOT EXISTS agent_guard_events (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  policy_id INTEGER,
  trigger agentguard_trigger NOT NULL,
  action agentguard_action NOT NULL,
  target_key_id INTEGER,
  target_key_name VARCHAR(255),
  severity VARCHAR(16) NOT NULL,
  reason TEXT NOT NULL,
  result VARCHAR(32),
  executed_at TIMESTAMP DEFAULT now() NOT NULL
);
CREATE INDEX idx_age_workspace ON agent_guard_events(workspace_id);
CREATE INDEX idx_age_policy ON agent_guard_events(policy_id);

-- Key Rotation Requests
CREATE TABLE IF NOT EXISTS key_rotation_requests (
  id VARCHAR(64) PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  discovered_key_id INTEGER NOT NULL,
  key_name VARCHAR(255) NOT NULL,
  key_type VARCHAR(64) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  reason TEXT NOT NULL,
  status key_rotation_status DEFAULT 'pending' NOT NULL,
  requested_by INTEGER NOT NULL,
  approved_by INTEGER,
  approved_at TIMESTAMP,
  rotation_started_at TIMESTAMP,
  rotation_completed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);
CREATE INDEX idx_krr_workspace ON key_rotation_requests(workspace_id);
CREATE INDEX idx_krr_key ON key_rotation_requests(discovered_key_id);
CREATE INDEX idx_krr_status ON key_rotation_requests(status);

-- ISO27001 Control Assessments
CREATE TABLE IF NOT EXISTS iso27001_controls (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  control_id VARCHAR(16) NOT NULL,
  control_name VARCHAR(255) NOT NULL,
  status VARCHAR(32) DEFAULT 'not_assessed' NOT NULL,
  score DECIMAL(3,1),
  evidence JSON,
  findings TEXT,
  remediation TEXT,
  last_assessed_at TIMESTAMP,
  assessed_by INTEGER,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);
CREATE INDEX idx_iso_workspace ON iso27001_controls(workspace_id);
CREATE UNIQUE INDEX idx_iso_control ON iso27001_controls(workspace_id, control_id);

-- Per-Key Usage Metrics
CREATE TABLE IF NOT EXISTS key_usage_metrics (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  discovered_key_id INTEGER,
  key_name VARCHAR(255) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  date TIMESTAMP NOT NULL,
  request_count INTEGER DEFAULT 0 NOT NULL,
  cost_usd DECIMAL(12,6) DEFAULT '0' NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  source VARCHAR(64),
  metadata JSON
);
CREATE INDEX idx_kum_workspace ON key_usage_metrics(workspace_id);
CREATE INDEX idx_kum_key_date ON key_usage_metrics(discovered_key_id, date);
CREATE INDEX idx_kum_date ON key_usage_metrics(date);

-- GitHub Copilot Sync State
CREATE TABLE IF NOT EXISTS copilot_sync_state (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  org_name VARCHAR(255) NOT NULL,
  total_seats INTEGER DEFAULT 0 NOT NULL,
  active_seats INTEGER DEFAULT 0 NOT NULL,
  total_usage_usd DECIMAL(12,2) DEFAULT '0' NOT NULL,
  data JSON,
  synced_at TIMESTAMP DEFAULT now() NOT NULL
);
CREATE INDEX idx_css_workspace ON copilot_sync_state(workspace_id);

-- Org Sync State (Team/Organization Hierarchy Sync)
CREATE TABLE IF NOT EXISTS org_sync_state (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  provider VARCHAR(32) NOT NULL,
  provider_org_id VARCHAR(128) NOT NULL,
  provider_org_name VARCHAR(255),
  last_synced_at TIMESTAMP,
  sync_status VARCHAR(32) DEFAULT 'pending' NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);
CREATE INDEX idx_oss_workspace ON org_sync_state(workspace_id);
