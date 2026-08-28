-- Cryptographically verifiable append-only action ledger.
-- UPDATE and DELETE are rejected at the database boundary; rows are chained
-- with SHA-256 and signed by the application using Ed25519.

CREATE TABLE IF NOT EXISTS "action_receipt_ledger" (
  "id" serial PRIMARY KEY,
  "workspace_id" integer NOT NULL,
  "request_id" varchar(128) NOT NULL,
  "event_type" varchar(16) NOT NULL,
  "occurred_at" timestamp NOT NULL,
  "payload" json NOT NULL,
  "previous_hash" varchar(64) NOT NULL,
  "entry_hash" varchar(64) NOT NULL,
  "signing_key_id" varchar(128) NOT NULL,
  "signing_algorithm" varchar(32) DEFAULT 'ed25519' NOT NULL,
  "signature" text NOT NULL,
  "public_key_pem" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "action_receipt_ledger_entry_hash_uniq"
  ON "action_receipt_ledger" ("entry_hash");
CREATE INDEX IF NOT EXISTS "action_receipt_ledger_workspace_chain_idx"
  ON "action_receipt_ledger" ("workspace_id", "id");
CREATE INDEX IF NOT EXISTS "action_receipt_ledger_request_idx"
  ON "action_receipt_ledger" ("workspace_id", "request_id");

CREATE OR REPLACE FUNCTION rakshex_reject_action_receipt_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'action_receipt_ledger is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS action_receipt_ledger_immutable ON "action_receipt_ledger";
CREATE TRIGGER action_receipt_ledger_immutable
  BEFORE UPDATE OR DELETE ON "action_receipt_ledger"
  FOR EACH ROW EXECUTE FUNCTION rakshex_reject_action_receipt_mutation();
