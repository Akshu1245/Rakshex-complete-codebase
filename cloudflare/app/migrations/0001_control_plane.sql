-- Fresh Cloudflare application store. Never apply to the existing Firewall DB.
CREATE TABLE IF NOT EXISTS cf_workspaces (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'INR',
 policy_json TEXT NOT NULL, frozen INTEGER NOT NULL DEFAULT 0 CHECK(frozen IN (0,1)), revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS cf_api_keys (
 id TEXT PRIMARY KEY, workspace_id INTEGER NOT NULL REFERENCES cf_workspaces(id),
 token_hash TEXT NOT NULL UNIQUE, role TEXT NOT NULL CHECK(role IN ('admin','runtime','read')),
 revoked_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS cf_agents (
 id TEXT PRIMARY KEY, workspace_id INTEGER NOT NULL REFERENCES cf_workspaces(id), name TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','revoked')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS cf_authorities (
 id TEXT PRIMARY KEY, workspace_id INTEGER NOT NULL REFERENCES cf_workspaces(id), agent_id TEXT NOT NULL,
 scope_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(workspace_id,agent_id) REFERENCES cf_agents(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS cf_receipts (
 id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id INTEGER NOT NULL REFERENCES cf_workspaces(id),
 request_id TEXT NOT NULL, request_hash TEXT NOT NULL, agent_id TEXT NOT NULL, authority_id TEXT NOT NULL,
 event_type TEXT NOT NULL CHECK(event_type IN ('allow','deny')), decision TEXT NOT NULL,
 amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0), occurred_at TEXT NOT NULL,
 entry_hash TEXT NOT NULL UNIQUE, previous_hash TEXT NOT NULL, receipt_json TEXT NOT NULL,
 UNIQUE(workspace_id,request_id,event_type), UNIQUE(workspace_id,request_id), UNIQUE(workspace_id,previous_hash)
);
CREATE INDEX IF NOT EXISTS cf_receipts_workspace_chain ON cf_receipts(workspace_id,id);
CREATE INDEX IF NOT EXISTS cf_receipts_authority_usage ON cf_receipts(workspace_id,authority_id,event_type);
CREATE INDEX IF NOT EXISTS cf_receipts_daily_amount ON cf_receipts(workspace_id,occurred_at,event_type);
CREATE INDEX IF NOT EXISTS cf_authorities_workspace ON cf_authorities(workspace_id,agent_id);
CREATE TRIGGER IF NOT EXISTS cf_receipts_no_update BEFORE UPDATE ON cf_receipts BEGIN SELECT RAISE(ABORT,'receipts are append-only'); END;
CREATE TRIGGER IF NOT EXISTS cf_receipts_no_delete BEFORE DELETE ON cf_receipts BEGIN SELECT RAISE(ABORT,'receipts are append-only'); END;
