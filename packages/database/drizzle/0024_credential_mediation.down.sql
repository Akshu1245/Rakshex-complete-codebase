DROP INDEX IF EXISTS "credential_egress_ws_idx";
DROP INDEX IF EXISTS "credential_egress_ledger_uniq";
DROP TABLE IF EXISTS "credential_egress_log";
DROP INDEX IF EXISTS "brokered_credentials_ws_idx";
DROP TABLE IF EXISTS "brokered_credentials";
DROP TYPE IF EXISTS "credential_injection";
DROP TYPE IF EXISTS "brokered_credential_status";
