/**
 * D1 (SQLite) schema for the Workers firewall slice.
 *
 * pg→SQLite mapping (documented in PORT_NOTES.md):
 *   serial            → INTEGER PRIMARY KEY AUTOINCREMENT
 *   uuid              → TEXT
 *   timestamptz       → INTEGER (unix milliseconds)
 *   jsonb             → TEXT (JSON-encoded)
 *   pg ENUM types     → TEXT with CHECK-free app-level validation
 *   numeric(20,10)    → REAL (USD major units; SQLite REAL is IEEE-754 double,
 *                       exact for the magnitudes we store)
 *
 * Source tables: packages/database/drizzle/0000 (workspaces), 0007 (api_keys),
 * 0022 (agent firewall), 0028 (action_receipt_ledger), 0032 (spend_ledger).
 */
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  ownerUserId: integer("owner_user_id").notNull(),
  isPersonal: integer("is_personal").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const controlPolicies = sqliteTable("control_policies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull().unique(),
  version: text("version").notNull().default("workers:0.1"),
  /** JSON of the declarative policy body (deny/approval rules, thresholds). */
  policyJson: text("policy_json").notNull().default("{}"),
  /** JSON SpendUsdByScope, e.g. {"agent": 5.0}. */
  spendCeilingsUsdJson: text("spend_ceilings_usd_json"),
  mode: text("mode").notNull().default("enforce"),
  frozen: integer("frozen").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
});

export const actionReceiptLedger = sqliteTable("action_receipt_ledger", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull(),
  requestId: text("request_id").notNull(),
  eventType: text("event_type").notNull(),
  occurredAt: integer("occurred_at").notNull(),
  payload: text("payload").notNull(),
  previousHash: text("previous_hash").notNull(),
  entryHash: text("entry_hash").notNull().unique(),
  signingKeyId: text("signing_key_id").notNull(),
  signingAlgorithm: text("signing_algorithm").notNull().default("ed25519"),
  signature: text("signature").notNull(),
  publicKeyPem: text("public_key_pem").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const spendLedger = sqliteTable("spend_ledger", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  occurredAt: integer("occurred_at").notNull(),
  workspaceId: integer("workspace_id").notNull(),
  agentId: text("agent_id").notNull(),
  keyId: text("key_id"),
  userId: text("user_id"),
  sessionId: text("session_id"),
  action: text("action").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  costUsd: real("cost_usd").notNull(),
  signalLabel: text("signal_label").notNull(),
  reservationId: text("reservation_id"),
  receiptId: integer("receipt_id"),
});

export const actionApprovals = sqliteTable("action_approvals", {
  id: text("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  ledgerId: text("ledger_id").notNull().unique(),
  status: text("status").notNull().default("pending"),
  requestedAt: integer("requested_at").notNull(),
  resolvedAt: integer("resolved_at"),
  resolvedBy: text("resolved_by"),
  resolutionNote: text("resolution_note"),
  consumedAt: integer("consumed_at"),
});

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  createdByUserId: integer("created_by_user_id").notNull(),
  name: text("name").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  /** HMAC-SHA256 hex of the raw key with API_KEY_PEPPER (workers-slice scheme). */
  keyHash: text("key_hash").notNull().unique(),
  environment: text("environment").notNull().default("live"),
  scopesJson: text("scopes_json").notNull().default("[]"),
  expiresAt: integer("expires_at"),
  lastUsedAt: integer("last_used_at"),
  revokedAt: integer("revoked_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

/** D1 sliding-window rate-limit buckets. Never in KV (1k writes/day). */
export const rateLimitEvents = sqliteTable("rate_limit_events", {
  bucketKey: text("bucket_key").notNull(),
  windowStart: integer("window_start").notNull(),
  count: integer("count").notNull().default(0),
});
