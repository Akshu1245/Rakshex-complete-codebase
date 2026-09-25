-- Spend-meter tables: atomic cost reservations + append-only spend ledger.
-- Money is USD major units (decimal dollars), matching the gate's SpendUsdByScope.

CREATE TABLE IF NOT EXISTS "spend_reservations" (
  "id" varchar(64) PRIMARY KEY,
  "workspace_id" integer NOT NULL,
  "scope_kind" varchar(16) NOT NULL,
  "scope_id" varchar(128) NOT NULL,
  "estimated_usd" numeric(20,10) NOT NULL,
  "actual_usd" numeric(20,10),
  "status" varchar(16) DEFAULT 'reserved' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "settled_at" timestamp
);

CREATE INDEX IF NOT EXISTS "spend_reservations_scope_idx"
  ON "spend_reservations" ("workspace_id", "scope_kind", "scope_id");
CREATE INDEX IF NOT EXISTS "spend_reservations_status_idx"
  ON "spend_reservations" ("status");

-- Append-only by contract: no UPDATE/DELETE is ever issued against this table
-- by application code; corrections are new rows. (There is deliberately no
-- database-level revoke here — the workspace role owns migrations — so the
-- service layer is the enforcement point.)
CREATE TABLE IF NOT EXISTS "spend_ledger" (
  "id" serial PRIMARY KEY,
  "occurred_at" timestamp DEFAULT now() NOT NULL,
  "workspace_id" integer NOT NULL,
  "agent_id" varchar(128) NOT NULL,
  "key_id" varchar(128),
  "user_id" varchar(128),
  "session_id" varchar(128),
  "action" varchar(256) NOT NULL,
  "provider" varchar(64) NOT NULL,
  "model" varchar(128) NOT NULL,
  "input_tokens" integer NOT NULL,
  "output_tokens" integer NOT NULL,
  "cost_usd" numeric(20,10) NOT NULL,
  "signal_label" varchar(16) NOT NULL,
  "reservation_id" varchar(64),
  "receipt_id" integer REFERENCES "action_receipt_ledger" ("id")
);

CREATE INDEX IF NOT EXISTS "spend_ledger_workspace_idx"
  ON "spend_ledger" ("workspace_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "spend_ledger_agent_idx"
  ON "spend_ledger" ("workspace_id", "agent_id");
