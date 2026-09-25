-- RaksHex Workers D1 migration 0001 — firewall slice.
--
-- pg→SQLite mapping (see PORT_NOTES.md "D1 schema notes"):
--   serial            → INTEGER PRIMARY KEY AUTOINCREMENT
--   timestamptz       → INTEGER (unix milliseconds)
--   jsonb             → TEXT (JSON-encoded)
--   pg ENUMs          → TEXT (validated at the application layer)
--   numeric(20,10)    → REAL
--   boolean           → INTEGER 0/1
--
-- Source: packages/database/drizzle/0000 (workspaces), 0007 (api_keys),
-- 0022 (agent firewall: action_approvals), 0028 (action_receipt_ledger),
-- 0032 (spend_ledger). Plus workers-local tables: control_policies,
-- rate_limit_events.

CREATE TABLE IF NOT EXISTS workspaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  owner_user_id INTEGER NOT NULL,
  is_personal INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Workers-local: declarative control policy per workspace (YAML compiled to
-- JSON by packages/policy-engine; spend ceilings from action-control).
CREATE TABLE IF NOT EXISTS control_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL UNIQUE,
  version TEXT NOT NULL DEFAULT 'workers:0.1',
  policy_json TEXT NOT NULL DEFAULT '{}',
  spend_ceilings_usd_json TEXT,
  mode TEXT NOT NULL DEFAULT 'enforce',
  frozen INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS action_receipt_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  request_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at INTEGER NOT NULL,
  payload TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  entry_hash TEXT NOT NULL UNIQUE,
  signing_key_id TEXT NOT NULL,
  signing_algorithm TEXT NOT NULL DEFAULT 'ed25519',
  signature TEXT NOT NULL,
  public_key_pem TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS action_receipt_ledger_workspace_chain_idx
  ON action_receipt_ledger (workspace_id, id);
CREATE INDEX IF NOT EXISTS action_receipt_ledger_request_idx
  ON action_receipt_ledger (workspace_id, request_id);

CREATE TABLE IF NOT EXISTS spend_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at INTEGER NOT NULL,
  workspace_id INTEGER NOT NULL,
  agent_id TEXT NOT NULL,
  key_id TEXT,
  user_id TEXT,
  session_id TEXT,
  action TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd REAL NOT NULL,
  signal_label TEXT NOT NULL,
  reservation_id TEXT,
  receipt_id INTEGER
);
CREATE INDEX IF NOT EXISTS spend_ledger_workspace_idx ON spend_ledger (workspace_id, occurred_at);
CREATE INDEX IF NOT EXISTS spend_ledger_agent_idx ON spend_ledger (workspace_id, agent_id);

CREATE TABLE IF NOT EXISTS action_approvals (
  id TEXT PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  ledger_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at INTEGER NOT NULL,
  resolved_at INTEGER,
  resolved_by TEXT,
  resolution_note TEXT,
  consumed_at INTEGER
);
CREATE INDEX IF NOT EXISTS action_approvals_ws_status_idx ON action_approvals (workspace_id, status);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  workspace_id INTEGER NOT NULL,
  created_by_user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  environment TEXT NOT NULL DEFAULT 'live',
  scopes_json TEXT NOT NULL DEFAULT '[]',
  expires_at INTEGER,
  last_used_at INTEGER,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS api_keys_workspace_id_idx ON api_keys (workspace_id);

-- Workers-local: D1 sliding-window rate-limit buckets (never KV: 1k writes/day).
CREATE TABLE IF NOT EXISTS rate_limit_events (
  bucket_key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);
