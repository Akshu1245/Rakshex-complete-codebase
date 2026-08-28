CREATE TABLE IF NOT EXISTS "gateway_call_attribution" (
  "id" serial PRIMARY KEY,
  "request_id" varchar(128) NOT NULL,
  "workspace_id" integer NOT NULL,
  "project_id" varchar(128),
  "agent_id" varchar(128),
  "identity_id" integer,
  "provider_account_id" integer NOT NULL,
  "provider" "control_plane_provider" NOT NULL,
  "model" varchar(255) NOT NULL,
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  "cached_input_tokens" integer DEFAULT 0 NOT NULL,
  "estimated_cost_usd" numeric(20,10) NOT NULL,
  "settled_cost_usd" numeric(20,10) NOT NULL,
  "provider_reconciled_cost_usd" numeric(20,10),
  "price_version_id" integer,
  "price_source_url" varchar(2048),
  "feature_tags" json,
  "customer_tags" json,
  "occurred_at" timestamp NOT NULL,
  "settled_at" timestamp DEFAULT now() NOT NULL,
  "metadata" json
);

CREATE UNIQUE INDEX IF NOT EXISTS "gateway_call_attribution_request_uniq"
  ON "gateway_call_attribution" ("workspace_id", "request_id");
CREATE INDEX IF NOT EXISTS "gateway_call_attribution_window_idx"
  ON "gateway_call_attribution" ("workspace_id", "provider_account_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "gateway_call_attribution_project_idx"
  ON "gateway_call_attribution" ("project_id");
CREATE INDEX IF NOT EXISTS "gateway_call_attribution_agent_idx"
  ON "gateway_call_attribution" ("agent_id");
