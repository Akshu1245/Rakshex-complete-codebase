CREATE TYPE "public"."ai_allowlist_kind" AS ENUM('host', 'model');--> statement-breakpoint
CREATE TYPE "public"."ai_event_status" AS ENUM('ok', 'error', 'timeout', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."alert_window" AS ENUM('1h', '24h', '7d');--> statement-breakpoint
CREATE TYPE "public"."autofix_status" AS ENUM('open', 'applied', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."collection_format" AS ENUM('postman', 'openapi', 'bruno');--> statement-breakpoint
CREATE TYPE "public"."copilot_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."finding_severity" AS ENUM('Critical', 'High', 'Medium', 'Low');--> statement-breakpoint
CREATE TYPE "public"."finding_status" AS ENUM('open', 'in-progress', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."gateway_decision" AS ENUM('allowed', 'blocked', 'errored');--> statement-breakpoint
CREATE TYPE "public"."kill_switch_event_type" AS ENUM('budget_set', 'triggered', 'auto_triggered', 'reset');--> statement-breakpoint
CREATE TYPE "public"."mcp_risk_class" AS ENUM('safe', 'elevated', 'unsafe', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."mcp_transport" AS ENUM('stdio', 'streamable-http', 'sse');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."redteam_outcome" AS ENUM('blocked', 'leaked', 'errored');--> statement-breakpoint
CREATE TYPE "public"."redteam_severity" AS ENUM('Low', 'Medium', 'High', 'Critical');--> statement-breakpoint
CREATE TYPE "public"."redteam_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."redteam_triggered_by" AS ENUM('manual', 'schedule', 'api');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('null', 'partial', 'full');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('pci_dss', 'owasp', 'custom');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."scan_type" AS ENUM('full', 'quick', 'shadow_api', 'prompt_injection');--> statement-breakpoint
CREATE TYPE "public"."security_event_type" AS ENUM('prompt_injection', 'pii_leak', 'policy_violation', 'anomaly');--> statement-breakpoint
CREATE TYPE "public"."security_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."shadow_ai_severity" AS ENUM('info', 'low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."sso_default_role" AS ENUM('admin', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."sso_kind" AS ENUM('oidc', 'saml');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('free', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'paused', 'cancelled', 'past_due', 'pending', 'halted');--> statement-breakpoint
CREATE TYPE "public"."team_member_role" AS ENUM('admin', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."team_member_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."token_budget_mode" AS ENUM('soft', 'hard');--> statement-breakpoint
CREATE TYPE "public"."user_plan" AS ENUM('free', 'pro', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'editor', 'admin');--> statement-breakpoint
CREATE TYPE "public"."workspace_invitation_role" AS ENUM('admin', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."workspace_member_role" AS ENUM('owner', 'admin', 'editor', 'viewer');--> statement-breakpoint
CREATE TABLE "ai_allowlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"kind" "ai_allowlist_kind" NOT NULL,
	"pattern" varchar(192) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"eventId" varchar(36) NOT NULL,
	"userId" integer NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"agentId" varchar(64) NOT NULL,
	"userHash" varchar(128),
	"provider" varchar(32) NOT NULL,
	"model" varchar(128) NOT NULL,
	"requestTimestamp" timestamp NOT NULL,
	"latencyMs" integer NOT NULL,
	"inputTokens" integer DEFAULT 0 NOT NULL,
	"outputTokens" integer DEFAULT 0 NOT NULL,
	"cachedTokens" integer DEFAULT 0 NOT NULL,
	"costUsd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"status" "ai_event_status" DEFAULT 'ok' NOT NULL,
	"redactionCount" integer DEFAULT 0 NOT NULL,
	"promptHash" varchar(64) NOT NULL,
	"responseHash" varchar(64) NOT NULL,
	"toolCalls" json,
	"metadata" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_events_eventId_unique" UNIQUE("eventId")
);
--> statement-breakpoint
CREATE TABLE "alert_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"ruleId" integer NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"summary" varchar(512) NOT NULL,
	"matched" json NOT NULL,
	"snapshots" json NOT NULL,
	"channel" varchar(32) NOT NULL,
	"delivered" boolean DEFAULT false NOT NULL,
	"statusCode" integer,
	"errorMessage" varchar(512),
	"firedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(192) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"conditions" json NOT NULL,
	"window" "alert_window" DEFAULT '24h' NOT NULL,
	"cooldownMinutes" integer DEFAULT 30 NOT NULL,
	"severity" "alert_severity" DEFAULT 'medium' NOT NULL,
	"channels" json NOT NULL,
	"lastFiredAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"action" varchar(128) NOT NULL,
	"details" json,
	"ipAddress" varchar(45),
	"userAgent" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autofix_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"findingType" varchar(64) NOT NULL,
	"findingRef" varchar(128),
	"title" varchar(192) NOT NULL,
	"rationale" text,
	"languageHint" varchar(32),
	"snippet" text NOT NULL,
	"status" "autofix_status" DEFAULT 'open' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"format" "collection_format" NOT NULL,
	"data" json NOT NULL,
	"totalRequests" integer DEFAULT 0 NOT NULL,
	"githubRepo" varchar(255),
	"lastScannedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_reports" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"collectionId" varchar(64) NOT NULL,
	"reportType" "report_type" NOT NULL,
	"complianceScore" numeric(5, 2) NOT NULL,
	"totalRequirements" integer NOT NULL,
	"metRequirements" integer NOT NULL,
	"requirementsData" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "copilot_conversations" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"title" varchar(192) DEFAULT 'New chat' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copilot_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversationId" varchar(64) NOT NULL,
	"role" "copilot_role" NOT NULL,
	"content" text NOT NULL,
	"references" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_preferences" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"unsubscribeToken" varchar(64),
	"scanComplete" boolean DEFAULT true NOT NULL,
	"budgetAlerts" boolean DEFAULT true NOT NULL,
	"weeklyDigest" boolean DEFAULT true NOT NULL,
	"teamActivity" boolean DEFAULT true NOT NULL,
	"promotionalEmails" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_preferences_userId_unique" UNIQUE("userId"),
	CONSTRAINT "email_preferences_unsubscribeToken_unique" UNIQUE("unsubscribeToken")
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"scanId" varchar(64) NOT NULL,
	"collectionId" varchar(64) NOT NULL,
	"userId" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"severity" "finding_severity" NOT NULL,
	"category" varchar(255),
	"remediation" text,
	"status" "finding_status" DEFAULT 'open' NOT NULL,
	"cweId" varchar(64),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gateway_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"requestId" varchar(64) NOT NULL,
	"model" varchar(96) NOT NULL,
	"provider" varchar(32),
	"decision" "gateway_decision" DEFAULT 'allowed' NOT NULL,
	"blockReason" varchar(96),
	"promptTokens" integer DEFAULT 0 NOT NULL,
	"completionTokens" integer DEFAULT 0 NOT NULL,
	"totalTokens" integer DEFAULT 0 NOT NULL,
	"estimatedCostUsd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"promptFingerprint" varchar(64),
	"latencyMs" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_history" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"source" varchar(32) NOT NULL,
	"recordsImported" integer DEFAULT 0 NOT NULL,
	"recordsSkipped" integer DEFAULT 0 NOT NULL,
	"collectionsCreated" integer DEFAULT 0 NOT NULL,
	"errors" json,
	"result" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kill_switch_events" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"eventType" "kill_switch_event_type" NOT NULL,
	"budgetLimit" numeric(10, 2),
	"currentSpend" numeric(10, 2),
	"reason" text,
	"details" json,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kill_switch_settings" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"budgetLimitUSD" numeric(10, 2) DEFAULT '100',
	"isActive" boolean DEFAULT false NOT NULL,
	"currentSpendUSD" numeric(10, 2) DEFAULT '0',
	"lastWarningSentAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kill_switch_settings_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "mcp_invocation_log" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"serverId" varchar(64) NOT NULL,
	"toolId" varchar(64) NOT NULL,
	"requestId" varchar(64),
	"argsFingerprint" varchar(64),
	"decision" "gateway_decision" NOT NULL,
	"blockReason" varchar(128),
	"durationMs" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_servers" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(256) NOT NULL,
	"url" varchar(1024),
	"transport" "mcp_transport" NOT NULL,
	"capabilityFingerprint" json,
	"riskScore" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"discoveredAt" timestamp DEFAULT now() NOT NULL,
	"lastSeenAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "mcp_tools" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"serverId" varchar(64) NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" text,
	"riskClass" "mcp_risk_class" DEFAULT 'unknown' NOT NULL,
	"inputSchema" json,
	"isApproved" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_progress" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"currentStep" integer DEFAULT 1 NOT NULL,
	"importCollectionCompleted" boolean DEFAULT false NOT NULL,
	"runScanCompleted" boolean DEFAULT false NOT NULL,
	"reviewFindingsCompleted" boolean DEFAULT false NOT NULL,
	"inviteTeamCompleted" boolean DEFAULT false NOT NULL,
	"setupComplianceCompleted" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp,
	CONSTRAINT "onboarding_progress_userId_unique" UNIQUE("userId")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"token" varchar(255) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"subscriptionId" varchar(64),
	"razorpayPaymentId" varchar(255) NOT NULL,
	"razorpayOrderId" varchar(255),
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"status" "payment_status" DEFAULT 'created' NOT NULL,
	"receipt" varchar(255),
	"description" text,
	"metadata" json,
	"refundAmount" numeric(10, 2) DEFAULT '0',
	"refundStatus" "refund_status" DEFAULT 'null',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_razorpayPaymentId_unique" UNIQUE("razorpayPaymentId")
);
--> statement-breakpoint
CREATE TABLE "processed_webhook_events" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"provider" varchar(32) NOT NULL,
	"eventId" varchar(128) NOT NULL,
	"eventType" varchar(64) NOT NULL,
	"processedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redteam_findings" (
	"id" serial PRIMARY KEY NOT NULL,
	"runId" varchar(64) NOT NULL,
	"payloadId" varchar(64) NOT NULL,
	"category" varchar(64) NOT NULL,
	"severity" "redteam_severity" NOT NULL,
	"outcome" "redteam_outcome" NOT NULL,
	"sample" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redteam_runs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"target" varchar(192) NOT NULL,
	"triggeredBy" "redteam_triggered_by" DEFAULT 'manual' NOT NULL,
	"status" "redteam_status" DEFAULT 'pending' NOT NULL,
	"totalPayloads" integer DEFAULT 0 NOT NULL,
	"blockedCount" integer DEFAULT 0 NOT NULL,
	"leakedCount" integer DEFAULT 0 NOT NULL,
	"erroredCount" integer DEFAULT 0 NOT NULL,
	"securityScore" integer,
	"durationMs" integer,
	"startedAt" timestamp,
	"finishedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redteam_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"target" varchar(192) NOT NULL,
	"cron" varchar(64) NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"lastRunAt" timestamp,
	"nextRunAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"collectionId" varchar(64) NOT NULL,
	"scanType" "scan_type" NOT NULL,
	"status" "scan_status" NOT NULL,
	"riskScore" numeric(5, 2) DEFAULT '0',
	"riskLevel" "risk_level" NOT NULL,
	"totalFindings" integer DEFAULT 0 NOT NULL,
	"findingsData" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"event_id" varchar(64) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(64) NOT NULL,
	"event_type" "security_event_type" NOT NULL,
	"severity" "security_severity" NOT NULL,
	"threat_level" varchar(20) NOT NULL,
	"detected_patterns" json NOT NULL,
	"prompt_hash" varchar(64) NOT NULL,
	"agent_id" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolution_note" text
);
--> statement-breakpoint
CREATE TABLE "shadow_apis" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"scanId" varchar(64) NOT NULL,
	"collectionId" varchar(64) NOT NULL,
	"userId" integer NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"method" varchar(16),
	"file" varchar(255),
	"line" integer,
	"riskLevel" "risk_level" NOT NULL,
	"reason" text,
	"recommendation" text,
	"isDocumented" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shadow_ai_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"source" varchar(64) NOT NULL,
	"detectedHost" varchar(192) NOT NULL,
	"detectedModel" varchar(96),
	"isAllowlisted" boolean DEFAULT false NOT NULL,
	"severity" "shadow_ai_severity" DEFAULT 'medium' NOT NULL,
	"rawSignals" json,
	"occurredAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sso_login_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"state" varchar(128) NOT NULL,
	"providerId" integer NOT NULL,
	"codeVerifier" varchar(256),
	"nonce" varchar(128),
	"redirectTo" varchar(512),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	CONSTRAINT "sso_login_requests_state_unique" UNIQUE("state")
);
--> statement-breakpoint
CREATE TABLE "sso_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(192) NOT NULL,
	"kind" "sso_kind" NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"config" json NOT NULL,
	"emailDomain" varchar(256),
	"defaultRole" "sso_default_role" DEFAULT 'viewer' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"plan" "subscription_plan" DEFAULT 'free' NOT NULL,
	"razorpaySubscriptionId" varchar(255),
	"razorpayCustomerId" varchar(255),
	"status" "subscription_status" DEFAULT 'pending' NOT NULL,
	"currentPeriodStart" timestamp,
	"currentPeriodEnd" timestamp,
	"cancelledAt" timestamp,
	"cancelAtPeriodEnd" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_userId_unique" UNIQUE("userId"),
	CONSTRAINT "subscriptions_razorpaySubscriptionId_unique" UNIQUE("razorpaySubscriptionId")
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"memberEmail" varchar(320) NOT NULL,
	"memberUserId" integer,
	"role" "team_member_role" DEFAULT 'viewer' NOT NULL,
	"status" "team_member_status" DEFAULT 'pending' NOT NULL,
	"invitedAt" timestamp DEFAULT now() NOT NULL,
	"acceptedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "tenant_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"name" varchar(192) NOT NULL,
	"yaml" text NOT NULL,
	"compiled" json NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"appliesTo" varchar(256) DEFAULT 'all' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_budgets" (
	"userId" serial PRIMARY KEY NOT NULL,
	"dailyTokenLimit" integer,
	"mode" "token_budget_mode" DEFAULT 'soft' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_usage" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"model" varchar(128) NOT NULL,
	"promptTokens" integer DEFAULT 0 NOT NULL,
	"completionTokens" integer DEFAULT 0 NOT NULL,
	"thinkingTokens" integer DEFAULT 0 NOT NULL,
	"totalTokens" integer DEFAULT 0 NOT NULL,
	"costUSD" numeric(10, 6) DEFAULT '0',
	"date" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"sessionToken" varchar(255) NOT NULL,
	"refreshTokenHash" varchar(64),
	"ipAddress" varchar(45),
	"userAgent" text,
	"lastActiveAt" timestamp DEFAULT now() NOT NULL,
	"lastUsedAt" timestamp,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"revokedAt" timestamp,
	"isRevoked" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_sessions_sessionToken_unique" UNIQUE("sessionToken")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"plan" "user_plan" DEFAULT 'free' NOT NULL,
	"passwordHash" varchar(512),
	"apiKey" varchar(64),
	"scansRemaining" integer DEFAULT 10 NOT NULL,
	"onboardingCompleted" boolean DEFAULT false NOT NULL,
	"failedLoginAttempts" integer DEFAULT 0 NOT NULL,
	"lockedUntil" timestamp,
	"totpSecret" varchar(64),
	"pendingTotpSecret" varchar(64),
	"pendingTotpExpiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "vscode_activities" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" varchar(32) NOT NULL,
	"data" json,
	"timestamp" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"plan" varchar(64) DEFAULT 'Free' NOT NULL,
	"source" varchar(64) DEFAULT 'landing_page' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"notified_at" timestamp,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"webhookId" varchar(64) NOT NULL,
	"event" varchar(64) NOT NULL,
	"payload" json NOT NULL,
	"status" integer,
	"responseBody" text,
	"errorMessage" text,
	"deliveredAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"url" varchar(1024) NOT NULL,
	"secret" varchar(128) NOT NULL,
	"events" json NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"lastDeliveryAt" timestamp,
	"lastStatus" integer,
	"consecutiveFailures" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspaceId" integer NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" "workspace_invitation_role" DEFAULT 'viewer' NOT NULL,
	"token" varchar(128) NOT NULL,
	"invitedBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	CONSTRAINT "workspace_invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspaceId" integer NOT NULL,
	"userId" integer NOT NULL,
	"role" "workspace_member_role" DEFAULT 'viewer' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"invitedBy" integer,
	"invitedAt" timestamp,
	"joinedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(192) NOT NULL,
	"ownerUserId" integer NOT NULL,
	"isPersonal" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "ai_allowlist_userId_index" ON "ai_allowlist" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "ai_events_userId_index" ON "ai_events" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "ai_events_workspaceId_index" ON "ai_events" USING btree ("workspaceId");--> statement-breakpoint
CREATE INDEX "ai_events_agentId_index" ON "ai_events" USING btree ("agentId");--> statement-breakpoint
CREATE INDEX "ai_events_createdAt_index" ON "ai_events" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "ai_events_provider_index" ON "ai_events" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "ai_events_model_index" ON "ai_events" USING btree ("model");--> statement-breakpoint
CREATE INDEX "ai_events_status_index" ON "ai_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_events_requestTimestamp_index" ON "ai_events" USING btree ("requestTimestamp");--> statement-breakpoint
CREATE INDEX "alert_events_userId_index" ON "alert_events" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "alert_events_ruleId_index" ON "alert_events" USING btree ("ruleId");--> statement-breakpoint
CREATE INDEX "alert_events_firedAt_index" ON "alert_events" USING btree ("firedAt");--> statement-breakpoint
CREATE INDEX "alert_rules_userId_index" ON "alert_rules" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "alert_rules_enabled_index" ON "alert_rules" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "audit_log_userId_index" ON "audit_log" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "audit_log_action_index" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_createdAt_index" ON "audit_log" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "autofix_suggestions_userId_index" ON "autofix_suggestions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "autofix_suggestions_status_index" ON "autofix_suggestions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "autofix_suggestions_findingType_index" ON "autofix_suggestions" USING btree ("findingType");--> statement-breakpoint
CREATE INDEX "collections_userId_index" ON "collections" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "collections_githubRepo_index" ON "collections" USING btree ("githubRepo");--> statement-breakpoint
CREATE INDEX "compliance_reports_userId_index" ON "compliance_reports" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "compliance_reports_collectionId_index" ON "compliance_reports" USING btree ("collectionId");--> statement-breakpoint
CREATE INDEX "copilot_conversations_userId_index" ON "copilot_conversations" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "copilot_messages_conversationId_index" ON "copilot_messages" USING btree ("conversationId");--> statement-breakpoint
CREATE INDEX "email_preferences_userId_index" ON "email_preferences" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "findings_scanId_index" ON "findings" USING btree ("scanId");--> statement-breakpoint
CREATE INDEX "findings_collectionId_index" ON "findings" USING btree ("collectionId");--> statement-breakpoint
CREATE INDEX "findings_userId_index" ON "findings" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "gateway_audit_userId_index" ON "gateway_audit" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "gateway_audit_createdAt_index" ON "gateway_audit" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "gateway_audit_decision_index" ON "gateway_audit" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "gateway_audit_model_index" ON "gateway_audit" USING btree ("model");--> statement-breakpoint
CREATE INDEX "import_history_userId_index" ON "import_history" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "import_history_source_index" ON "import_history" USING btree ("source");--> statement-breakpoint
CREATE INDEX "import_history_createdAt_index" ON "import_history" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "kill_switch_events_userId_index" ON "kill_switch_events" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "kill_switch_settings_userId_index" ON "kill_switch_settings" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "mcp_invocation_log_userId_index" ON "mcp_invocation_log" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "mcp_invocation_log_serverId_index" ON "mcp_invocation_log" USING btree ("serverId");--> statement-breakpoint
CREATE INDEX "mcp_invocation_log_toolId_index" ON "mcp_invocation_log" USING btree ("toolId");--> statement-breakpoint
CREATE INDEX "mcp_invocation_log_createdAt_index" ON "mcp_invocation_log" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "mcp_servers_userId_index" ON "mcp_servers" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "mcp_tools_serverId_index" ON "mcp_tools" USING btree ("serverId");--> statement-breakpoint
CREATE INDEX "onboarding_progress_userId_index" ON "onboarding_progress" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_userId_index" ON "password_reset_tokens" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_token_index" ON "password_reset_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_expiresAt_index" ON "password_reset_tokens" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "payments_userId_index" ON "payments" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "payments_subscriptionId_index" ON "payments" USING btree ("subscriptionId");--> statement-breakpoint
CREATE INDEX "payments_razorpayPaymentId_index" ON "payments" USING btree ("razorpayPaymentId");--> statement-breakpoint
CREATE INDEX "payments_status_index" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_createdAt_index" ON "payments" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "processed_webhook_events_provider_eventId_index" ON "processed_webhook_events" USING btree ("provider","eventId");--> statement-breakpoint
CREATE INDEX "redteam_findings_runId_index" ON "redteam_findings" USING btree ("runId");--> statement-breakpoint
CREATE INDEX "redteam_findings_outcome_index" ON "redteam_findings" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "redteam_runs_userId_index" ON "redteam_runs" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "redteam_runs_status_index" ON "redteam_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "redteam_runs_createdAt_index" ON "redteam_runs" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "redteam_schedules_userId_index" ON "redteam_schedules" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "redteam_schedules_isActive_index" ON "redteam_schedules" USING btree ("isActive");--> statement-breakpoint
CREATE INDEX "scans_userId_index" ON "scans" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "scans_collectionId_index" ON "scans" USING btree ("collectionId");--> statement-breakpoint
CREATE INDEX "security_events_workspace_id_index" ON "security_events" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "security_events_created_at_index" ON "security_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "security_events_event_type_index" ON "security_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "shadow_apis_scanId_index" ON "shadow_apis" USING btree ("scanId");--> statement-breakpoint
CREATE INDEX "shadow_apis_collectionId_index" ON "shadow_apis" USING btree ("collectionId");--> statement-breakpoint
CREATE INDEX "shadow_apis_userId_index" ON "shadow_apis" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "shadow_ai_events_userId_index" ON "shadow_ai_events" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "shadow_ai_events_severity_index" ON "shadow_ai_events" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "shadow_ai_events_detectedHost_index" ON "shadow_ai_events" USING btree ("detectedHost");--> statement-breakpoint
CREATE INDEX "sso_login_requests_state_index" ON "sso_login_requests" USING btree ("state");--> statement-breakpoint
CREATE INDEX "sso_login_requests_expiresAt_index" ON "sso_login_requests" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "sso_providers_userId_index" ON "sso_providers" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "sso_providers_kind_index" ON "sso_providers" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "sso_providers_enabled_index" ON "sso_providers" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "subscriptions_userId_index" ON "subscriptions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "subscriptions_razorpaySubscriptionId_index" ON "subscriptions" USING btree ("razorpaySubscriptionId");--> statement-breakpoint
CREATE INDEX "subscriptions_status_index" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_currentPeriodEnd_index" ON "subscriptions" USING btree ("currentPeriodEnd");--> statement-breakpoint
CREATE INDEX "team_members_userId_index" ON "team_members" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "team_members_memberEmail_index" ON "team_members" USING btree ("memberEmail");--> statement-breakpoint
CREATE INDEX "tenant_policies_userId_index" ON "tenant_policies" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "tenant_policies_appliesTo_index" ON "tenant_policies" USING btree ("appliesTo");--> statement-breakpoint
CREATE INDEX "token_usage_userId_index" ON "token_usage" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "token_usage_model_index" ON "token_usage" USING btree ("model");--> statement-breakpoint
CREATE INDEX "token_usage_date_index" ON "token_usage" USING btree ("date");--> statement-breakpoint
CREATE INDEX "user_sessions_userId_index" ON "user_sessions" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "user_sessions_sessionToken_index" ON "user_sessions" USING btree ("sessionToken");--> statement-breakpoint
CREATE INDEX "user_sessions_expiresAt_index" ON "user_sessions" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "user_sessions_refreshTokenHash_index" ON "user_sessions" USING btree ("refreshTokenHash");--> statement-breakpoint
CREATE INDEX "users_email_index" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_apiKey_index" ON "users" USING btree ("apiKey");--> statement-breakpoint
CREATE INDEX "vscode_activities_userId_index" ON "vscode_activities" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "vscode_activities_timestamp_index" ON "vscode_activities" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "waitlist_email_index" ON "waitlist" USING btree ("email");--> statement-breakpoint
CREATE INDEX "waitlist_created_at_index" ON "waitlist" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_webhookId_index" ON "webhook_deliveries" USING btree ("webhookId");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_createdAt_index" ON "webhook_deliveries" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_userId_index" ON "webhook_endpoints" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "workspace_invitations_workspaceId_index" ON "workspace_invitations" USING btree ("workspaceId");--> statement-breakpoint
CREATE INDEX "workspace_invitations_email_index" ON "workspace_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "workspace_invitations_token_index" ON "workspace_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "workspace_members_workspaceId_userId_index" ON "workspace_members" USING btree ("workspaceId","userId");--> statement-breakpoint
CREATE INDEX "workspace_members_userId_index" ON "workspace_members" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "workspaces_ownerUserId_index" ON "workspaces" USING btree ("ownerUserId");--> statement-breakpoint
CREATE INDEX "workspaces_slug_index" ON "workspaces" USING btree ("slug");