-- Credential mediation (CB4A "Model A" proxy gateway).
--
-- Before this migration the Agent Firewall could record that an action was
-- denied but could not prevent it: the agent held the real provider key and
-- could call Stripe/GitHub directly, bypassing the gateway entirely. These
-- tables let the raw secret live only on the server, released to no one —
-- the broker injects it at egress after verifying an ALLOW ledger record.
--
-- The unique index on credential_egress_log.ledger_id is load-bearing: it is
-- what makes one ALLOW decision spendable exactly once.

DO $$ BEGIN
  CREATE TYPE "brokered_credential_status" AS ENUM ('active', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "credential_injection" AS ENUM ('bearer', 'header', 'basic');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "brokered_credentials" (
  "id" varchar(64) PRIMARY KEY,
  "workspace_id" integer NOT NULL,
  "name" varchar(256) NOT NULL,
  "provider" varchar(64) NOT NULL,
  "secret_ciphertext" text NOT NULL,
  "allowed_actions" json NOT NULL,
  "allowed_origin" varchar(512) NOT NULL,
  "injection" "credential_injection" DEFAULT 'bearer' NOT NULL,
  "header_name" varchar(128),
  "status" "brokered_credential_status" DEFAULT 'active' NOT NULL,
  "created_by_user_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "revoked_at" timestamp,
  "last_used_at" timestamp
);

CREATE INDEX IF NOT EXISTS "brokered_credentials_ws_idx"
  ON "brokered_credentials" ("workspace_id", "status");

CREATE TABLE IF NOT EXISTS "credential_egress_log" (
  "id" varchar(64) PRIMARY KEY,
  "workspace_id" integer NOT NULL,
  "credential_id" varchar(64) NOT NULL,
  "ledger_id" varchar(64) NOT NULL,
  "agent_id" varchar(64),
  "semantic_action" varchar(128) NOT NULL,
  "method" varchar(8) NOT NULL,
  "target_url" varchar(2048) NOT NULL,
  "response_status" integer,
  "duration_ms" integer,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Anti-replay: one ALLOW ledger record may be spent for exactly one call.
CREATE UNIQUE INDEX IF NOT EXISTS "credential_egress_ledger_uniq"
  ON "credential_egress_log" ("ledger_id");

CREATE INDEX IF NOT EXISTS "credential_egress_ws_idx"
  ON "credential_egress_log" ("workspace_id", "created_at");
