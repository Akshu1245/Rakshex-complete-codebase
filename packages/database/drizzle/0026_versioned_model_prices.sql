-- Versioned model pricing. Runtime pricing must select the newest row whose
-- effective_from is <= the request timestamp. Never reprice historical calls
-- using today's rate.

CREATE TABLE IF NOT EXISTS "model_price_versions" (
  "id" serial PRIMARY KEY,
  "provider" "control_plane_provider" NOT NULL,
  "model" varchar(255) NOT NULL,
  "currency" varchar(16) DEFAULT 'usd' NOT NULL,
  "input_per_million" numeric(20,10) NOT NULL,
  "output_per_million" numeric(20,10) NOT NULL,
  "cached_input_per_million" numeric(20,10),
  "effective_from" timestamp NOT NULL,
  "source_url" varchar(2048) NOT NULL,
  "source_checked_at" timestamp DEFAULT now() NOT NULL,
  "metadata" json,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "model_price_versions_version_uniq"
  ON "model_price_versions" ("provider", "model", "effective_from");
CREATE INDEX IF NOT EXISTS "model_price_versions_lookup_idx"
  ON "model_price_versions" ("provider", "model", "effective_from");

-- Current OpenAI text-token rates checked 2026-08-28 against official model pages.
-- effective_from intentionally starts at this registry introduction date; calls
-- before it remain unpriced by this registry rather than being rewritten with
-- today's rate.
INSERT INTO "model_price_versions"
  ("provider", "model", "input_per_million", "output_per_million", "cached_input_per_million", "effective_from", "source_url", "metadata")
VALUES
  ('openai', 'gpt-5.6', 4.00, 20.00, 0.40, '2026-08-28T00:00:00Z', 'https://developers.openai.com/api/docs/models/gpt-5.6-sol', '{"aliasOf":"gpt-5.6-sol"}'),
  ('openai', 'gpt-5.6-sol', 4.00, 20.00, 0.40, '2026-08-28T00:00:00Z', 'https://developers.openai.com/api/docs/models/gpt-5.6-sol', '{}'),
  ('openai', 'gpt-5.6-terra', 2.00, 12.00, 0.20, '2026-08-28T00:00:00Z', 'https://developers.openai.com/api/docs/models/gpt-5.6-terra', '{}'),
  ('openai', 'gpt-5.6-luna', 0.20, 1.20, 0.02, '2026-08-28T00:00:00Z', 'https://developers.openai.com/api/docs/models/gpt-5.6-luna', '{}'),
  ('openai', 'gpt-5.4', 2.50, 15.00, 0.25, '2026-08-28T00:00:00Z', 'https://developers.openai.com/api/docs/models/gpt-5.4', '{}'),
  ('openai', 'gpt-5.4-mini', 0.75, 4.50, 0.075, '2026-08-28T00:00:00Z', 'https://developers.openai.com/api/docs/models/gpt-5.4-mini', '{}'),
  ('openai', 'gpt-5.2', 1.75, 14.00, 0.175, '2026-08-28T00:00:00Z', 'https://developers.openai.com/api/docs/models/gpt-5.2', '{}'),
  ('openai', 'gpt-5', 1.25, 10.00, 0.125, '2026-08-28T00:00:00Z', 'https://developers.openai.com/api/docs/models/gpt-5', '{}'),
  ('openai', 'gpt-5-mini', 0.25, 2.00, 0.025, '2026-08-28T00:00:00Z', 'https://developers.openai.com/api/docs/models/gpt-5-mini', '{}'),
  ('openai', 'gpt-5-nano', 0.05, 0.40, 0.005, '2026-08-28T00:00:00Z', 'https://developers.openai.com/api/docs/models/gpt-5-nano', '{}'),
  ('openai', 'gpt-4o', 2.50, 10.00, 1.25, '2026-08-28T00:00:00Z', 'https://developers.openai.com/api/docs/models/gpt-4o', '{}'),
  ('openai', 'gpt-4o-mini', 0.15, 0.60, 0.075, '2026-08-28T00:00:00Z', 'https://developers.openai.com/api/docs/models/gpt-4o-mini', '{}')
ON CONFLICT DO NOTHING;

-- Anthropic requires no migration change later: the provider enum/schema can
-- accept versioned Anthropic rows, but this slice intentionally adds none.
