-- Reverse 0007 market-ready foundation (drop additive objects only).
-- Does NOT drop legacy product tables or historical migrations.

DROP TABLE IF EXISTS "compliance_evidence" CASCADE;
DROP TABLE IF EXISTS "compliance_controls" CASCADE;
DROP TABLE IF EXISTS "compliance_frameworks" CASCADE;
DROP TABLE IF EXISTS "invoices" CASCADE;
DROP TABLE IF EXISTS "cost_records" CASCADE;
DROP TABLE IF EXISTS "pricing_versions" CASCADE;
DROP TABLE IF EXISTS "usage_events" CASCADE;
DROP TABLE IF EXISTS "tool_calls" CASCADE;
DROP TABLE IF EXISTS "llm_requests" CASCADE;
DROP TABLE IF EXISTS "agent_steps" CASCADE;
DROP TABLE IF EXISTS "agent_runs" CASCADE;
DROP TABLE IF EXISTS "notification_channels" CASCADE;
DROP TABLE IF EXISTS "integrations" CASCADE;
DROP TABLE IF EXISTS "policy_violations" CASCADE;
DROP TABLE IF EXISTS "policy_versions" CASCADE;
DROP TABLE IF EXISTS "policies" CASCADE;
DROP TABLE IF EXISTS "accepted_risks" CASCADE;
DROP TABLE IF EXISTS "finding_suppressions" CASCADE;
DROP TABLE IF EXISTS "finding_comments" CASCADE;
DROP TABLE IF EXISTS "finding_instances" CASCADE;
DROP TABLE IF EXISTS "scan_jobs" CASCADE;
DROP TABLE IF EXISTS "collection_versions" CASCADE;
DROP TABLE IF EXISTS "repositories" CASCADE;
DROP TABLE IF EXISTS "projects" CASCADE;
DROP TABLE IF EXISTS "api_keys" CASCADE;
DROP TABLE IF EXISTS "role_permissions" CASCADE;
DROP TABLE IF EXISTS "permissions" CASCADE;
DROP TABLE IF EXISTS "roles" CASCADE;
DROP TABLE IF EXISTS "verification_tokens" CASCADE;
DROP TABLE IF EXISTS "sessions" CASCADE;
DROP TABLE IF EXISTS "identities" CASCADE;
DROP TABLE IF EXISTS "audit_logs" CASCADE;

DROP INDEX IF EXISTS "workspace_members_workspace_user_uidx";
DROP INDEX IF EXISTS "collections_workspace_id_idx";
DROP INDEX IF EXISTS "scans_workspace_id_idx";
DROP INDEX IF EXISTS "findings_workspace_id_idx";
DROP INDEX IF EXISTS "notifications_workspace_id_idx";

ALTER TABLE "collections" DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "scans" DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "findings" DROP COLUMN IF EXISTS "workspace_id";
ALTER TABLE "notifications" DROP COLUMN IF EXISTS "workspace_id";

DROP TYPE IF EXISTS "public"."compliance_control_status";
DROP TYPE IF EXISTS "public"."invoice_status";
DROP TYPE IF EXISTS "public"."agent_run_status";
DROP TYPE IF EXISTS "public"."policy_lifecycle_status";
DROP TYPE IF EXISTS "public"."finding_lifecycle_status";
DROP TYPE IF EXISTS "public"."scan_job_status";
DROP TYPE IF EXISTS "public"."api_key_environment";
DROP TYPE IF EXISTS "public"."invitation_status";
DROP TYPE IF EXISTS "public"."identity_provider";
