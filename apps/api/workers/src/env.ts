/**
 * Workers Env bindings. Secrets (RECEIPT_SIGNING_PRIVATE_KEY, RECEIPT_SIGNING_KEY_ID,
 * API_KEY_PEPPER, SENTRY_DSN) come from `wrangler secret put` — never wrangler.toml.
 */
export interface Env {
  DB: D1Database;
  KV_CONFIG: KVNamespace;
  EVAL_QUEUE: Queue;
  RECEIPT_BUCKET: R2Bucket;

  RECEIPT_SIGNING_PRIVATE_KEY: string; // Ed25519 PKCS8 DER, base64 (or PEM)
  RECEIPT_SIGNING_KEY_ID: string; // e.g. "rakshex-receipts-2026-09"
  API_KEY_PEPPER: string; // HMAC pepper for workers-provisioned API keys
  MAILCHANNELS_FROM?: string; // e.g. "alerts@rakshex.in" — unset = mail fail-closed
  SENTRY_DSN?: string;
  ENVIRONMENT?: string;
}
