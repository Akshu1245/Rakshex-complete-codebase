-- Provider billing source-of-truth evidence and reconciliation windows.
-- Raw provider rows are intentionally separate from gateway-attributed rows.

CREATE TABLE IF NOT EXISTS "provider_billing_connections" (
  "id" serial PRIMARY KEY,
  "workspace_id" integer NOT NULL,
  "provider_account_id" integer NOT NULL,
  "provider" "control_plane_provider" NOT NULL,
  "billing_credential_id" integer NOT NULL,
  "source" varchar(32) DEFAULT 'admin_api' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "provider_billing_connections_account_uniq"
  ON "provider_billing_connections" ("workspace_id", "provider_account_id", "provider");
CREATE INDEX IF NOT EXISTS "provider_billing_connections_workspace_idx"
  ON "provider_billing_connections" ("workspace_id");

CREATE TABLE IF NOT EXISTS "provider_billing_rows" (
  "id" serial PRIMARY KEY,
  "workspace_id" integer NOT NULL,
  "provider_account_id" integer NOT NULL,
  "provider" "control_plane_provider" NOT NULL,
  "row_kind" varchar(16) NOT NULL,
  "source_row_id" varchar(128) NOT NULL,
  "bucket_start" timestamp NOT NULL,
  "bucket_end" timestamp NOT NULL,
  "project_id" varchar(255),
  "api_key_id" varchar(255),
  "line_item" varchar(255),
  "model" varchar(255),
  "amount_usd" numeric(20,10),
  "currency" varchar(16),
  "quantity" numeric(20,6),
  "input_tokens" integer,
  "output_tokens" integer,
  "cached_input_tokens" integer,
  "request_count" integer,
  "raw" json NOT NULL,
  "fetched_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "provider_billing_rows_source_uniq"
  ON "provider_billing_rows" ("workspace_id", "provider_account_id", "row_kind", "source_row_id");
CREATE INDEX IF NOT EXISTS "provider_billing_rows_window_idx"
  ON "provider_billing_rows" ("workspace_id", "provider_account_id", "bucket_start");
CREATE INDEX IF NOT EXISTS "provider_billing_rows_project_idx"
  ON "provider_billing_rows" ("project_id");

CREATE TABLE IF NOT EXISTS "provider_reconciliation_windows" (
  "id" serial PRIMARY KEY,
  "workspace_id" integer NOT NULL,
  "provider_account_id" integer NOT NULL,
  "provider" "control_plane_provider" NOT NULL,
  "window_start" timestamp NOT NULL,
  "window_end" timestamp NOT NULL,
  "provider_billed_usd" numeric(20,10) NOT NULL,
  "gateway_attributed_usd" numeric(20,10) NOT NULL,
  "drift_usd" numeric(20,10) NOT NULL,
  "drift_pct" numeric(20,10) NOT NULL,
  "status" varchar(16) NOT NULL,
  "provider_row_count" integer DEFAULT 0 NOT NULL,
  "gateway_row_count" integer DEFAULT 0 NOT NULL,
  "metadata" json,
  "reconciled_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "provider_reconciliation_windows_uniq"
  ON "provider_reconciliation_windows" ("workspace_id", "provider_account_id", "window_start", "window_end");
CREATE INDEX IF NOT EXISTS "provider_reconciliation_windows_workspace_idx"
  ON "provider_reconciliation_windows" ("workspace_id", "reconciled_at");
