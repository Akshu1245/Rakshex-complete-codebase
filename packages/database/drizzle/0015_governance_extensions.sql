-- Governance extensions: entitlements, identity resolution, rollups, connector health.

DO $$ BEGIN
  CREATE TYPE "governance_subject_kind" AS ENUM ('employee', 'service_account', 'workload', 'unresolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "identity_link_type" AS ENUM (
    'workspace_user', 'email', 'github_login', 'cloud_principal',
    'scim_id', 'sdk_subject', 'device', 'external_user_id'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "provider_health_status" AS ENUM ('healthy', 'degraded', 'unhealthy', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "workspace_members"
  ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "deactivated_at" TIMESTAMP;

ALTER TABLE "workspace_invitations"
  ADD COLUMN IF NOT EXISTS "status" VARCHAR(32) DEFAULT 'pending' NOT NULL,
  ADD COLUMN IF NOT EXISTS "seat_reserved_at" TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_members_workspace_user_uniq"
  ON "workspace_members" ("workspaceId", "userId");

CREATE TABLE IF NOT EXISTS "workspace_entitlements" (
  "id" serial PRIMARY KEY,
  "workspace_id" integer NOT NULL,
  "plan" varchar(32) DEFAULT 'free' NOT NULL,
  "status" varchar(32) DEFAULT 'active' NOT NULL,
  "included_seats" integer DEFAULT 1 NOT NULL,
  "purchased_seats" integer DEFAULT 0 NOT NULL,
  "override_seats" integer,
  "billing_provider" varchar(32),
  "billing_customer_id" varchar(255),
  "billing_subscription_id" varchar(255),
  "period_start" timestamp,
  "period_end" timestamp,
  "grace_expires_at" timestamp,
  "metadata" json,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_entitlements_workspace_id_uniq"
  ON "workspace_entitlements" ("workspace_id");

INSERT INTO "workspace_entitlements" ("workspace_id", "plan", "included_seats")
SELECT w."id", 'free', 1
FROM "workspaces" w
WHERE NOT EXISTS (
  SELECT 1 FROM "workspace_entitlements" e WHERE e."workspace_id" = w."id"
);

CREATE TABLE IF NOT EXISTS "governance_subjects" (
  "id" serial PRIMARY KEY,
  "workspace_id" integer NOT NULL,
  "kind" "governance_subject_kind" DEFAULT 'employee' NOT NULL,
  "display_name" varchar(255) NOT NULL,
  "primary_email" varchar(320),
  "workspace_user_id" integer,
  "team_ai_identity_id" integer,
  "status" varchar(32) DEFAULT 'active' NOT NULL,
  "metadata" json,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "governance_subjects_workspace_id_idx"
  ON "governance_subjects" ("workspace_id");

CREATE TABLE IF NOT EXISTS "subject_identity_links" (
  "id" serial PRIMARY KEY,
  "workspace_id" integer NOT NULL,
  "subject_id" integer NOT NULL,
  "link_type" "identity_link_type" NOT NULL,
  "external_id" varchar(512) NOT NULL,
  "verified" boolean DEFAULT false NOT NULL,
  "source" varchar(64) NOT NULL,
  "metadata" json,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "subject_identity_links_uniq"
  ON "subject_identity_links" ("workspace_id", "link_type", "external_id");

CREATE TABLE IF NOT EXISTS "identity_resolution_events" (
  "id" serial PRIMARY KEY,
  "workspace_id" integer NOT NULL,
  "subject_id" integer,
  "event_type" varchar(64) NOT NULL,
  "link_type" "identity_link_type",
  "external_id" varchar(512),
  "confidence" varchar(32) DEFAULT 'inferred' NOT NULL,
  "actor_user_id" integer,
  "details" json,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "governance_usage_rollups" (
  "id" serial PRIMARY KEY,
  "workspace_id" integer NOT NULL,
  "identity_id" integer,
  "provider" "control_plane_provider",
  "model" varchar(128),
  "project_id" varchar(128),
  "period_start" timestamp NOT NULL,
  "period_kind" varchar(16) NOT NULL,
  "event_count" integer DEFAULT 0 NOT NULL,
  "total_tokens" integer DEFAULT 0 NOT NULL,
  "cost_usd" numeric(14, 6) DEFAULT 0 NOT NULL,
  "exact_cost_usd" numeric(14, 6) DEFAULT 0 NOT NULL,
  "estimated_cost_usd" numeric(14, 6) DEFAULT 0 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "governance_usage_rollups_uniq"
  ON "governance_usage_rollups" (
    "workspace_id", "identity_id", "provider", "model", "project_id", "period_start", "period_kind"
  );

CREATE TABLE IF NOT EXISTS "connector_checkpoints" (
  "id" serial PRIMARY KEY,
  "workspace_id" integer NOT NULL,
  "provider_account_id" integer NOT NULL,
  "provider" "control_plane_provider" NOT NULL,
  "cursor" text,
  "last_synced_at" timestamp,
  "metadata" json,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "connector_checkpoints_account_uniq"
  ON "connector_checkpoints" ("provider_account_id");

CREATE TABLE IF NOT EXISTS "connector_errors" (
  "id" serial PRIMARY KEY,
  "sync_run_id" integer NOT NULL,
  "workspace_id" integer NOT NULL,
  "code" varchar(64) NOT NULL,
  "message" text NOT NULL,
  "retryable" boolean DEFAULT true NOT NULL,
  "metadata" json,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "provider_health_checks" (
  "id" serial PRIMARY KEY,
  "workspace_id" integer NOT NULL,
  "provider_account_id" integer,
  "provider" "control_plane_provider" NOT NULL,
  "check_type" varchar(64) NOT NULL,
  "status" "provider_health_status" DEFAULT 'unknown' NOT NULL,
  "latency_ms" integer,
  "message" text,
  "checked_at" timestamp DEFAULT now() NOT NULL,
  "metadata" json
);

CREATE TABLE IF NOT EXISTS "provider_health_incidents" (
  "id" serial PRIMARY KEY,
  "workspace_id" integer NOT NULL,
  "provider_account_id" integer,
  "provider" "control_plane_provider" NOT NULL,
  "severity" varchar(16) DEFAULT 'medium' NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "status" varchar(32) DEFAULT 'open' NOT NULL,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "resolved_at" timestamp,
  "metadata" json
);

CREATE TABLE IF NOT EXISTS "connector_health_snapshots" (
  "id" serial PRIMARY KEY,
  "workspace_id" integer NOT NULL,
  "provider_account_id" integer NOT NULL,
  "provider" "control_plane_provider" NOT NULL,
  "sync_lag_minutes" integer,
  "auth_status" "provider_health_status" DEFAULT 'unknown' NOT NULL,
  "api_status" "provider_health_status" DEFAULT 'unknown' NOT NULL,
  "last_successful_sync_at" timestamp,
  "snapshot_at" timestamp DEFAULT now() NOT NULL,
  "metadata" json
);
CREATE UNIQUE INDEX IF NOT EXISTS "connector_health_snapshots_account_uniq"
  ON "connector_health_snapshots" ("provider_account_id");
