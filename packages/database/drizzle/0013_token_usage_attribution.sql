-- Per-endpoint / per-feature LLM cost attribution: optional dimensions on
-- token_usage so spend can be charged to a specific API endpoint or product
-- feature, not just the user/model.
ALTER TABLE "token_usage" ADD COLUMN IF NOT EXISTS "endpoint" varchar(512);
ALTER TABLE "token_usage" ADD COLUMN IF NOT EXISTS "feature" varchar(128);

CREATE INDEX IF NOT EXISTS "token_usage_endpoint_idx" ON "token_usage" ("endpoint");
CREATE INDEX IF NOT EXISTS "token_usage_feature_idx" ON "token_usage" ("feature");
