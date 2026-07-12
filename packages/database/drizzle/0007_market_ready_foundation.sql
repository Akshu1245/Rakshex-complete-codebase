-- Migration 0007: Market-ready PostgreSQL foundation tables
-- Additive / non-destructive to existing product tables.
-- Dialect: PostgreSQL

-- ── Enums ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "public"."identity_provider" AS ENUM('email', 'google', 'github', 'oidc', 'saml');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."api_key_environment" AS ENUM('live', 'test');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."scan_job_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."finding_lifecycle_status" AS ENUM('open', 'in_progress', 'resolved', 'false_positive', 'accepted_risk', 'suppressed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."policy_lifecycle_status" AS ENUM('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."agent_run_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled', 'blocked');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'open', 'paid', 'void', 'uncollectible');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."compliance_control_status" AS ENUM('not_started', 'in_progress', 'implemented', 'not_applicable', 'exception');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── Harden existing multi-tenant membership ──────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_members_workspace_user_uidx"
  ON "workspace_members" ("workspaceId", "userId");

-- Optional workspace scope on legacy collections (nullable for backfill)
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "workspace_id" integer;
CREATE INDEX IF NOT EXISTS "collections_workspace_id_idx" ON "collections" ("workspace_id");

ALTER TABLE "scans" ADD COLUMN IF NOT EXISTS "workspace_id" integer;
CREATE INDEX IF NOT EXISTS "scans_workspace_id_idx" ON "scans" ("workspace_id");

ALTER TABLE "findings" ADD COLUMN IF NOT EXISTS "workspace_id" integer;
CREATE INDEX IF NOT EXISTS "findings_workspace_id_idx" ON "findings" ("workspace_id");

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "workspace_id" integer;
CREATE INDEX IF NOT EXISTS "notifications_workspace_id_idx" ON "notifications" ("workspace_id");

-- ── identities ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "identities" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "provider" "identity_provider" NOT NULL,
  "provider_subject" varchar(255) NOT NULL,
  "email" varchar(320),
  "email_verified_at" timestamp,
  "metadata" json,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "identities_provider_subject_uidx" ON "identities" ("provider", "provider_subject");
CREATE INDEX IF NOT EXISTS "identities_user_id_idx" ON "identities" ("user_id");

-- ── sessions (foundation) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "session_token_hash" varchar(128) NOT NULL,
  "refresh_token_hash" varchar(128),
  "ip_address" varchar(45),
  "user_agent" text,
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  "last_active_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_hash_uidx" ON "sessions" ("session_token_hash");
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions" ("expires_at");

-- ── verification_tokens ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "verification_tokens" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "token_hash" varchar(128) NOT NULL,
  "purpose" varchar(64) NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "verification_tokens_hash_uidx" ON "verification_tokens" ("token_hash");
CREATE INDEX IF NOT EXISTS "verification_tokens_user_id_idx" ON "verification_tokens" ("user_id");

-- ── roles / permissions ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "roles" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer,
  "key" varchar(64) NOT NULL,
  "name" varchar(128) NOT NULL,
  "description" text,
  "is_system" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "roles_workspace_key_uidx" ON "roles" ("workspace_id", "key");
CREATE INDEX IF NOT EXISTS "roles_workspace_id_idx" ON "roles" ("workspace_id");

CREATE TABLE IF NOT EXISTS "permissions" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "key" varchar(128) NOT NULL UNIQUE,
  "resource" varchar(64) NOT NULL,
  "action" varchar(32) NOT NULL,
  "description" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "permissions_resource_action_idx" ON "permissions" ("resource", "action");

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "id" serial PRIMARY KEY NOT NULL,
  "role_id" varchar(64) NOT NULL,
  "permission_id" varchar(64) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_uidx" ON "role_permissions" ("role_id", "permission_id");

-- ── api_keys ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "created_by_user_id" integer NOT NULL,
  "name" varchar(128) NOT NULL,
  "key_prefix" varchar(24) NOT NULL,
  "key_hash" varchar(128) NOT NULL,
  "environment" "api_key_environment" DEFAULT 'live' NOT NULL,
  "scopes" json DEFAULT '[]'::json NOT NULL,
  "expires_at" timestamp,
  "last_used_at" timestamp,
  "revoked_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_prefix_uidx" ON "api_keys" ("key_prefix");
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_hash_uidx" ON "api_keys" ("key_hash");
CREATE INDEX IF NOT EXISTS "api_keys_workspace_id_idx" ON "api_keys" ("workspace_id");

-- ── projects / repositories ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "projects" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "name" varchar(192) NOT NULL,
  "slug" varchar(64) NOT NULL,
  "description" text,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "projects_workspace_slug_uidx" ON "projects" ("workspace_id", "slug");
CREATE INDEX IF NOT EXISTS "projects_workspace_id_idx" ON "projects" ("workspace_id");

CREATE TABLE IF NOT EXISTS "repositories" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "project_id" varchar(64),
  "provider" varchar(32) DEFAULT 'github' NOT NULL,
  "full_name" varchar(255) NOT NULL,
  "default_branch" varchar(128),
  "external_id" varchar(128),
  "metadata" json,
  "deleted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "repositories_workspace_fullname_uidx" ON "repositories" ("workspace_id", "provider", "full_name");
CREATE INDEX IF NOT EXISTS "repositories_workspace_id_idx" ON "repositories" ("workspace_id");
CREATE INDEX IF NOT EXISTS "repositories_project_id_idx" ON "repositories" ("project_id");

-- ── collection_versions ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "collection_versions" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "collection_id" varchar(64) NOT NULL,
  "version" integer NOT NULL,
  "format" varchar(32) NOT NULL,
  "content_hash" varchar(64) NOT NULL,
  "data" json NOT NULL,
  "created_by_user_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "collection_versions_uidx" ON "collection_versions" ("collection_id", "version");
CREATE INDEX IF NOT EXISTS "collection_versions_workspace_id_idx" ON "collection_versions" ("workspace_id");
CREATE INDEX IF NOT EXISTS "collection_versions_hash_idx" ON "collection_versions" ("content_hash");

-- ── scan_jobs ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "scan_jobs" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "scan_id" varchar(64),
  "collection_id" varchar(64),
  "job_type" varchar(64) NOT NULL,
  "status" "scan_job_status" DEFAULT 'queued' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "idempotency_key" varchar(128),
  "error_message" text,
  "started_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "scan_jobs_workspace_id_idx" ON "scan_jobs" ("workspace_id");
CREATE INDEX IF NOT EXISTS "scan_jobs_status_idx" ON "scan_jobs" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "scan_jobs_idempotency_uidx" ON "scan_jobs" ("workspace_id", "idempotency_key");

-- ── findings lifecycle ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "finding_instances" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "finding_id" varchar(64) NOT NULL,
  "scan_id" varchar(64) NOT NULL,
  "fingerprint" varchar(255) NOT NULL,
  "endpoint" text,
  "method" varchar(16),
  "evidence" json,
  "first_seen_at" timestamp DEFAULT now() NOT NULL,
  "last_seen_at" timestamp DEFAULT now() NOT NULL,
  "occurrence_count" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "finding_instances_ws_fp_idx" ON "finding_instances" ("workspace_id", "fingerprint");
CREATE INDEX IF NOT EXISTS "finding_instances_finding_id_idx" ON "finding_instances" ("finding_id");
CREATE INDEX IF NOT EXISTS "finding_instances_scan_id_idx" ON "finding_instances" ("scan_id");

CREATE TABLE IF NOT EXISTS "finding_comments" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "finding_id" varchar(64) NOT NULL,
  "author_user_id" integer NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);
CREATE INDEX IF NOT EXISTS "finding_comments_workspace_id_idx" ON "finding_comments" ("workspace_id");
CREATE INDEX IF NOT EXISTS "finding_comments_finding_id_idx" ON "finding_comments" ("finding_id");

CREATE TABLE IF NOT EXISTS "finding_suppressions" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "finding_id" varchar(64),
  "fingerprint" varchar(255) NOT NULL,
  "reason" text NOT NULL,
  "created_by_user_id" integer NOT NULL,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "revoked_at" timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS "finding_suppressions_ws_fp_uidx" ON "finding_suppressions" ("workspace_id", "fingerprint");
CREATE INDEX IF NOT EXISTS "finding_suppressions_workspace_id_idx" ON "finding_suppressions" ("workspace_id");

CREATE TABLE IF NOT EXISTS "accepted_risks" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "finding_id" varchar(64),
  "fingerprint" varchar(255) NOT NULL,
  "justification" text NOT NULL,
  "accepted_by_user_id" integer NOT NULL,
  "approved_by_user_id" integer,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "revoked_at" timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS "accepted_risks_ws_fp_uidx" ON "accepted_risks" ("workspace_id", "fingerprint");
CREATE INDEX IF NOT EXISTS "accepted_risks_workspace_id_idx" ON "accepted_risks" ("workspace_id");

-- ── policies ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "policies" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "name" varchar(192) NOT NULL,
  "description" text,
  "status" "policy_lifecycle_status" DEFAULT 'draft' NOT NULL,
  "current_version" integer DEFAULT 0 NOT NULL,
  "created_by_user_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS "policies_workspace_name_uidx" ON "policies" ("workspace_id", "name");
CREATE INDEX IF NOT EXISTS "policies_workspace_id_idx" ON "policies" ("workspace_id");

CREATE TABLE IF NOT EXISTS "policy_versions" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "policy_id" varchar(64) NOT NULL,
  "version" integer NOT NULL,
  "document" json NOT NULL,
  "document_yaml" text,
  "published_at" timestamp,
  "created_by_user_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "policy_versions_uidx" ON "policy_versions" ("policy_id", "version");
CREATE INDEX IF NOT EXISTS "policy_versions_workspace_id_idx" ON "policy_versions" ("workspace_id");

CREATE TABLE IF NOT EXISTS "policy_violations" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "policy_id" varchar(64),
  "policy_version_id" varchar(64),
  "agent_run_id" varchar(64),
  "rule_key" varchar(128) NOT NULL,
  "action" varchar(32) NOT NULL,
  "details" json,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "policy_violations_workspace_id_idx" ON "policy_violations" ("workspace_id");
CREATE INDEX IF NOT EXISTS "policy_violations_policy_id_idx" ON "policy_violations" ("policy_id");
CREATE INDEX IF NOT EXISTS "policy_violations_created_at_idx" ON "policy_violations" ("created_at");

-- ── integrations / notification_channels ─────────────────────────────────

CREATE TABLE IF NOT EXISTS "integrations" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "kind" varchar(64) NOT NULL,
  "name" varchar(192) NOT NULL,
  "config" json DEFAULT '{}'::json NOT NULL,
  "secrets_ref" varchar(255),
  "enabled" boolean DEFAULT true NOT NULL,
  "created_by_user_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);
CREATE UNIQUE INDEX IF NOT EXISTS "integrations_ws_kind_name_uidx" ON "integrations" ("workspace_id", "kind", "name");
CREATE INDEX IF NOT EXISTS "integrations_workspace_id_idx" ON "integrations" ("workspace_id");

CREATE TABLE IF NOT EXISTS "notification_channels" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "kind" varchar(32) NOT NULL,
  "name" varchar(128) NOT NULL,
  "config" json DEFAULT '{}'::json NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "notification_channels_ws_name_uidx" ON "notification_channels" ("workspace_id", "name");
CREATE INDEX IF NOT EXISTS "notification_channels_workspace_id_idx" ON "notification_channels" ("workspace_id");

-- ── agent runtime ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "agent_runs" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "project_id" varchar(64),
  "agent_key" varchar(128) NOT NULL,
  "status" "agent_run_status" DEFAULT 'pending' NOT NULL,
  "correlation_id" varchar(64),
  "total_cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
  "step_count" integer DEFAULT 0 NOT NULL,
  "started_at" timestamp,
  "completed_at" timestamp,
  "metadata" json,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "agent_runs_workspace_id_idx" ON "agent_runs" ("workspace_id");
CREATE INDEX IF NOT EXISTS "agent_runs_status_idx" ON "agent_runs" ("status");
CREATE INDEX IF NOT EXISTS "agent_runs_correlation_id_idx" ON "agent_runs" ("correlation_id");

CREATE TABLE IF NOT EXISTS "agent_steps" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "agent_run_id" varchar(64) NOT NULL,
  "step_index" integer NOT NULL,
  "name" varchar(192),
  "status" "agent_run_status" DEFAULT 'pending' NOT NULL,
  "started_at" timestamp,
  "completed_at" timestamp,
  "metadata" json,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "agent_steps_run_index_uidx" ON "agent_steps" ("agent_run_id", "step_index");
CREATE INDEX IF NOT EXISTS "agent_steps_workspace_id_idx" ON "agent_steps" ("workspace_id");

CREATE TABLE IF NOT EXISTS "llm_requests" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "agent_run_id" varchar(64),
  "agent_step_id" varchar(64),
  "provider" varchar(64) NOT NULL,
  "model" varchar(128) NOT NULL,
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  "cached_tokens" integer DEFAULT 0 NOT NULL,
  "latency_ms" integer,
  "cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
  "pricing_version_id" varchar(64),
  "status" varchar(32) DEFAULT 'ok' NOT NULL,
  "prompt_hash" varchar(64),
  "response_hash" varchar(64),
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "llm_requests_workspace_id_idx" ON "llm_requests" ("workspace_id");
CREATE INDEX IF NOT EXISTS "llm_requests_agent_run_id_idx" ON "llm_requests" ("agent_run_id");
CREATE INDEX IF NOT EXISTS "llm_requests_created_at_idx" ON "llm_requests" ("created_at");

CREATE TABLE IF NOT EXISTS "tool_calls" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "agent_run_id" varchar(64),
  "agent_step_id" varchar(64),
  "tool_name" varchar(192) NOT NULL,
  "status" varchar(32) NOT NULL,
  "arguments_redacted" json,
  "result_summary" text,
  "duration_ms" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "tool_calls_workspace_id_idx" ON "tool_calls" ("workspace_id");
CREATE INDEX IF NOT EXISTS "tool_calls_agent_run_id_idx" ON "tool_calls" ("agent_run_id");
CREATE INDEX IF NOT EXISTS "tool_calls_tool_name_idx" ON "tool_calls" ("tool_name");

CREATE TABLE IF NOT EXISTS "usage_events" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "event_type" varchar(64) NOT NULL,
  "quantity" numeric(18, 6) DEFAULT '1' NOT NULL,
  "unit" varchar(32) DEFAULT 'count' NOT NULL,
  "cost_usd" numeric(12, 6),
  "metadata" json,
  "occurred_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "usage_events_workspace_id_idx" ON "usage_events" ("workspace_id");
CREATE INDEX IF NOT EXISTS "usage_events_event_type_idx" ON "usage_events" ("event_type");
CREATE INDEX IF NOT EXISTS "usage_events_occurred_at_idx" ON "usage_events" ("occurred_at");

-- ── pricing / cost ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "pricing_versions" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "provider" varchar(64) NOT NULL,
  "model" varchar(128) NOT NULL,
  "region" varchar(64),
  "currency" varchar(8) DEFAULT 'USD' NOT NULL,
  "input_per_1m" numeric(12, 6),
  "output_per_1m" numeric(12, 6),
  "cached_input_per_1m" numeric(12, 6),
  "effective_from" timestamp NOT NULL,
  "effective_to" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "pricing_versions_provider_model_from_uidx"
  ON "pricing_versions" ("provider", "model", "region", "effective_from");

CREATE TABLE IF NOT EXISTS "cost_records" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "llm_request_id" varchar(64),
  "pricing_version_id" varchar(64),
  "amount_usd" numeric(12, 6) NOT NULL,
  "kind" varchar(16) DEFAULT 'estimate' NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "cost_records_workspace_id_idx" ON "cost_records" ("workspace_id");
CREATE INDEX IF NOT EXISTS "cost_records_created_at_idx" ON "cost_records" ("created_at");

-- ── invoices ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "invoices" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "subscription_id" varchar(64),
  "external_id" varchar(128),
  "status" "invoice_status" DEFAULT 'draft' NOT NULL,
  "currency" varchar(8) DEFAULT 'USD' NOT NULL,
  "amount_due" numeric(12, 2) NOT NULL,
  "amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
  "period_start" timestamp,
  "period_end" timestamp,
  "due_at" timestamp,
  "paid_at" timestamp,
  "metadata" json,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "invoices_workspace_id_idx" ON "invoices" ("workspace_id");
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_external_id_uidx" ON "invoices" ("external_id");
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices" ("status");

-- ── compliance ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "compliance_frameworks" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "key" varchar(64) NOT NULL UNIQUE,
  "name" varchar(192) NOT NULL,
  "version" varchar(32),
  "description" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "compliance_controls" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "framework_id" varchar(64) NOT NULL,
  "control_key" varchar(64) NOT NULL,
  "title" varchar(255) NOT NULL,
  "requirement" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "compliance_controls_framework_key_uidx"
  ON "compliance_controls" ("framework_id", "control_key");

CREATE TABLE IF NOT EXISTS "compliance_evidence" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer NOT NULL,
  "control_id" varchar(64) NOT NULL,
  "status" "compliance_control_status" DEFAULT 'not_started' NOT NULL,
  "summary" text,
  "evidence" json,
  "owner_user_id" integer,
  "last_tested_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "compliance_evidence_ws_control_uidx"
  ON "compliance_evidence" ("workspace_id", "control_id");
CREATE INDEX IF NOT EXISTS "compliance_evidence_workspace_id_idx" ON "compliance_evidence" ("workspace_id");

-- ── audit_logs (canonical name) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspace_id" integer,
  "actor_user_id" integer,
  "action" varchar(128) NOT NULL,
  "target_type" varchar(64),
  "target_id" varchar(128),
  "before_state" json,
  "after_state" json,
  "ip_address" varchar(45),
  "user_agent" text,
  "correlation_id" varchar(64),
  "prev_hash" varchar(64),
  "row_hash" varchar(64),
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "audit_logs_workspace_id_idx" ON "audit_logs" ("workspace_id");
CREATE INDEX IF NOT EXISTS "audit_logs_actor_user_id_idx" ON "audit_logs" ("actor_user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" ("created_at");

-- ── Foreign keys (idempotent) ────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "identities" ADD CONSTRAINT "identities_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_user_id_users_id_fk"
    FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_fk"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "roles" ADD CONSTRAINT "roles_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fk"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fk"
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_user_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "repositories" ADD CONSTRAINT "repositories_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "repositories" ADD CONSTRAINT "repositories_project_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "collection_versions" ADD CONSTRAINT "collection_versions_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "finding_instances" ADD CONSTRAINT "finding_instances_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "finding_comments" ADD CONSTRAINT "finding_comments_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "finding_suppressions" ADD CONSTRAINT "finding_suppressions_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "accepted_risks" ADD CONSTRAINT "accepted_risks_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "policies" ADD CONSTRAINT "policies_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_policy_id_fk"
    FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "policy_violations" ADD CONSTRAINT "policy_violations_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "integrations" ADD CONSTRAINT "integrations_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "notification_channels" ADD CONSTRAINT "notification_channels_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "agent_steps" ADD CONSTRAINT "agent_steps_agent_run_id_fk"
    FOREIGN KEY ("agent_run_id") REFERENCES "agent_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "agent_steps" ADD CONSTRAINT "agent_steps_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "llm_requests" ADD CONSTRAINT "llm_requests_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "tool_calls" ADD CONSTRAINT "tool_calls_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "cost_records" ADD CONSTRAINT "cost_records_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "compliance_controls" ADD CONSTRAINT "compliance_controls_framework_id_fk"
    FOREIGN KEY ("framework_id") REFERENCES "compliance_frameworks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "compliance_evidence" ADD CONSTRAINT "compliance_evidence_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "compliance_evidence" ADD CONSTRAINT "compliance_evidence_control_id_fk"
    FOREIGN KEY ("control_id") REFERENCES "compliance_controls"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "collections" ADD CONSTRAINT "collections_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "scans" ADD CONSTRAINT "scans_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "findings" ADD CONSTRAINT "findings_workspace_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
