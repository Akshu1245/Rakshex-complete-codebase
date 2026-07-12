-- Migration 0009: Findings enrichment + collection tags + expanded status
-- Dialect: PostgreSQL

-- Expand finding status enum
DO $$ BEGIN ALTER TYPE "public"."finding_status" ADD VALUE 'suppressed'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."finding_status" ADD VALUE 'false_positive'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."finding_status" ADD VALUE 'accepted_risk'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."finding_status" ADD VALUE 'reopened'; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Rich finding fields (deterministic scanner bridge)
ALTER TABLE "findings" ADD COLUMN IF NOT EXISTS "rule_id" varchar(128);
ALTER TABLE "findings" ADD COLUMN IF NOT EXISTS "confidence" varchar(32);
ALTER TABLE "findings" ADD COLUMN IF NOT EXISTS "fingerprint" varchar(255);
ALTER TABLE "findings" ADD COLUMN IF NOT EXISTS "endpoint" text;
ALTER TABLE "findings" ADD COLUMN IF NOT EXISTS "method" varchar(16);
ALTER TABLE "findings" ADD COLUMN IF NOT EXISTS "evidence" json;
ALTER TABLE "findings" ADD COLUMN IF NOT EXISTS "assignee_user_id" integer;
ALTER TABLE "findings" ADD COLUMN IF NOT EXISTS "due_at" timestamp;
ALTER TABLE "findings" ADD COLUMN IF NOT EXISTS "duplicate_of" varchar(64);
ALTER TABLE "findings" ADD COLUMN IF NOT EXISTS "suppression_reason" text;
ALTER TABLE "findings" ADD COLUMN IF NOT EXISTS "suppression_expires_at" timestamp;
ALTER TABLE "findings" ADD COLUMN IF NOT EXISTS "accepted_risk_reason" text;
ALTER TABLE "findings" ADD COLUMN IF NOT EXISTS "accepted_risk_approved_by" integer;
ALTER TABLE "findings" ADD COLUMN IF NOT EXISTS "workspace_id" integer;

CREATE INDEX IF NOT EXISTS "findings_fingerprint_idx" ON "findings" ("fingerprint");
CREATE INDEX IF NOT EXISTS "findings_rule_id_idx" ON "findings" ("rule_id");
CREATE INDEX IF NOT EXISTS "findings_status_idx" ON "findings" ("status");
CREATE INDEX IF NOT EXISTS "findings_assignee_idx" ON "findings" ("assignee_user_id");
CREATE INDEX IF NOT EXISTS "findings_workspace_id_idx" ON "findings" ("workspace_id");

-- Collection metadata / tags / content hash
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "content_hash" varchar(64);
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "tags" json DEFAULT '[]'::json;
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1;
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "workspace_id" integer;

CREATE INDEX IF NOT EXISTS "collections_content_hash_idx" ON "collections" ("content_hash");
