-- Universal AI Control Plane: provider inventory, encrypted credentials,
-- subscription governance, and metadata-only discovery findings.
DO $$ BEGIN CREATE TYPE control_plane_provider AS ENUM (
  'openai', 'anthropic', 'azure_openai', 'bedrock', 'vertex',
  'github_copilot', 'claude_teams', 'cursor', 'windsurf', 'ollama',
  'vllm', 'lm_studio', 'openai_compatible'
); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE control_plane_credential_status AS ENUM ('active', 'revoked', 'expired'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE control_plane_finding_status AS ENUM ('open', 'acknowledged', 'remediated'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE control_plane_sync_status AS ENUM ('healthy', 'degraded', 'failed', 'not_connected'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE control_plane_evidence_confidence AS ENUM ('verified', 'imported', 'estimated', 'inferred'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS provider_accounts (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
  provider control_plane_provider NOT NULL,
  account_type VARCHAR(64) NOT NULL,
  external_id VARCHAR(255),
  display_name VARCHAR(255) NOT NULL,
  connection_status VARCHAR(32) NOT NULL DEFAULT 'inventory_only',
  auth_method VARCHAR(32) NOT NULL DEFAULT 'manual_import',
  admin_credential_id INTEGER,
  sync_status control_plane_sync_status NOT NULL DEFAULT 'not_connected',
  last_sync_error TEXT,
  capabilities JSON NOT NULL,
  metadata JSON,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_provider_accounts_workspace ON provider_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_provider_accounts_provider ON provider_accounts(provider);

CREATE TABLE IF NOT EXISTS control_plane_credentials (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
  provider_account_id INTEGER,
  name VARCHAR(128) NOT NULL,
  provider control_plane_provider NOT NULL,
  credential_type VARCHAR(64) NOT NULL,
  environment VARCHAR(32) NOT NULL DEFAULT 'production',
  encrypted_value TEXT NOT NULL,
  fingerprint VARCHAR(128) NOT NULL,
  key_prefix VARCHAR(32),
  status control_plane_credential_status NOT NULL DEFAULT 'active',
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  revoked_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_control_plane_credentials_workspace ON control_plane_credentials(workspace_id);
CREATE INDEX IF NOT EXISTS idx_control_plane_credentials_fingerprint ON control_plane_credentials(fingerprint);

CREATE TABLE IF NOT EXISTS ai_subscriptions (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
  provider control_plane_provider NOT NULL,
  external_id VARCHAR(255),
  plan VARCHAR(128) NOT NULL,
  seats_purchased INTEGER NOT NULL DEFAULT 0,
  seats_used INTEGER NOT NULL DEFAULT 0,
  owner_email VARCHAR(320),
  cost_center VARCHAR(128),
  renewal_at TIMESTAMP,
  source VARCHAR(32) NOT NULL DEFAULT 'manual',
  confidence VARCHAR(32) NOT NULL DEFAULT 'imported',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  metadata JSON,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_subscriptions_workspace ON ai_subscriptions(workspace_id);

CREATE TABLE IF NOT EXISTS ai_subscription_seats (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
  subscription_id INTEGER NOT NULL REFERENCES ai_subscriptions(id),
  external_user_id VARCHAR(255),
  email VARCHAR(320),
  display_name VARCHAR(255),
  role VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  assigned_at TIMESTAMP,
  last_activity_at TIMESTAMP,
  source VARCHAR(32) NOT NULL DEFAULT 'manual',
  confidence control_plane_evidence_confidence NOT NULL DEFAULT 'imported',
  metadata JSON,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_subscription_seats_workspace ON ai_subscription_seats(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_subscription_seats_subscription ON ai_subscription_seats(subscription_id);
CREATE INDEX IF NOT EXISTS idx_ai_subscription_seats_email ON ai_subscription_seats(email);

CREATE TABLE IF NOT EXISTS control_plane_resources (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
  provider_account_id INTEGER,
  provider control_plane_provider NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  external_id VARCHAR(512) NOT NULL,
  parent_external_id VARCHAR(512),
  display_name VARCHAR(255) NOT NULL,
  region VARCHAR(64),
  owner_email VARCHAR(320),
  cost_center VARCHAR(128),
  tags JSON,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  source VARCHAR(32) NOT NULL DEFAULT 'manual',
  confidence control_plane_evidence_confidence NOT NULL DEFAULT 'imported',
  metadata JSON,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_control_plane_resources_workspace ON control_plane_resources(workspace_id);
CREATE INDEX IF NOT EXISTS idx_control_plane_resources_provider ON control_plane_resources(provider);
CREATE INDEX IF NOT EXISTS idx_control_plane_resources_external ON control_plane_resources(external_id);

CREATE TABLE IF NOT EXISTS control_plane_discovery_findings (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
  kind VARCHAR(64) NOT NULL,
  provider control_plane_provider,
  fingerprint VARCHAR(128) NOT NULL,
  masked_value VARCHAR(128),
  source VARCHAR(64) NOT NULL,
  source_path VARCHAR(512),
  model VARCHAR(128),
  severity VARCHAR(16) NOT NULL DEFAULT 'medium',
  status control_plane_finding_status NOT NULL DEFAULT 'open',
  metadata JSON,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_control_plane_findings_workspace ON control_plane_discovery_findings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_control_plane_findings_fingerprint ON control_plane_discovery_findings(fingerprint);
