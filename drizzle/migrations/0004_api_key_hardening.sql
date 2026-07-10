-- API key hardening: store display prefix separately from hash
ALTER TABLE users ADD COLUMN IF NOT EXISTS "apiKeyPrefix" varchar(12);
