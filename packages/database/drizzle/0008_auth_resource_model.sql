-- Migration 0008: Auth hardening + API key lifecycle + environments
-- Dialect: PostgreSQL

-- Expand workspace roles (additive enum values; ignore if already present)
DO $$ BEGIN ALTER TYPE "public"."workspace_member_role" ADD VALUE 'security_lead'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."workspace_member_role" ADD VALUE 'developer'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."workspace_member_role" ADD VALUE 'analyst'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."workspace_member_role" ADD VALUE 'billing_admin'; EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN ALTER TYPE "public"."workspace_invitation_role" ADD VALUE 'security_lead'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."workspace_invitation_role" ADD VALUE 'developer'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."workspace_invitation_role" ADD VALUE 'analyst'; EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "public"."workspace_invitation_role" ADD VALUE 'billing_admin'; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Email verification flag on users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "recovery_codes_hash" json;

-- Recovery codes stored as JSON array of SHA-256 hashes on users (if column missing above)
-- device history enrichment on sessions
ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "device_label" varchar(128);
ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "rotated_from" varchar(64);

-- Hash password reset tokens at rest (token column already exists — app now stores SHA-256)
-- Email verification uses verification_tokens.purpose = 'email_verify'

-- API key lifecycle extensions
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "allowed_ips" json DEFAULT '[]'::json;
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "allowed_repositories" json DEFAULT '[]'::json;
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "project_id" varchar(64);
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "rotated_from_id" varchar(64);
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "key_suffix" varchar(8);

-- Environments: Development | Staging | Production
DO $$ BEGIN
  CREATE TYPE "public"."environment_kind" AS ENUM('development', 'staging', 'production');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "environments" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "project_id" varchar(64),
  "name" varchar(64) NOT NULL,
  "kind" "environment_kind" NOT NULL,
  "slug" varchar(64) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS "environments_workspace_slug_uidx"
  ON "environments" ("workspace_id", "slug");
CREATE INDEX IF NOT EXISTS "environments_workspace_id_idx" ON "environments" ("workspace_id");
CREATE INDEX IF NOT EXISTS "environments_project_id_idx" ON "environments" ("project_id");

-- Audit log already exists in product; ensure workspace scope column
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "workspace_id" integer;
CREATE INDEX IF NOT EXISTS "audit_logs_workspace_id_idx" ON "audit_logs" ("workspace_id");

-- OAuth state is Redis-only; no table required
