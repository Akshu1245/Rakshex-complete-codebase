/**
 * Queue consumer — replaces the BullMQ worker pool (apps/api/queues.ts).
 *
 * Job semantics:
 * - receipt-export: build the signed JSON bundle + printable HTML twin and
 *   store both in R2 (pdfkit decision: printable HTML replaces the receipt
 *   PDF; the JSON bundle stays the canonical verifiable artifact).
 * - webhook-delivery: POST the event payload to workspace webhook endpoints
 *   (HMAC-signed, best-effort with the queue's built-in retries).
 * - provider-reconciliation: per-workspace provider billing checksum
 *   (OpenAI Costs & Usage vs gateway-attributed spend).
 * - weekly-digest-fanout / weekly-digest: per-user digest emails via
 *   MailChannels (fail-closed).
 */
import { asc, eq } from "drizzle-orm";
import type { Env } from "./env";
import { createDb } from "./db";
import { actionReceiptLedger } from "./schema";
import {
  createSignedReceiptBundle,
  receiptBundleJson,
  renderReceiptHtml,
  signerFromEnvironment,
  type ReceiptEntryExport,
} from "./receipts";
import { putReceiptBundle, putReceiptHtml } from "./adapters/storage";
import { sendMail } from "./adapters/mail";
import { enqueueJob } from "./adapters/queue";
import { captureError } from "./adapters/sentry";

interface QueueMessageBody {
  type: string;
  enqueuedAt: string;
  payload: Record<string, unknown>;
}

function asEntry(row: typeof actionReceiptLedger.$inferSelect): ReceiptEntryExport {
  return {
    version: 1,
    id: row.id,
    workspaceId: row.workspaceId,
    requestId: row.requestId,
    eventType: row.eventType as ReceiptEntryExport["eventType"],
    occurredAt: new Date(row.occurredAt).toISOString(),
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    previousHash: row.previousHash,
    entryHash: row.entryHash,
    signingKeyId: row.signingKeyId,
    signingAlgorithm: "ed25519",
    signature: row.signature,
    publicKeyPem: row.publicKeyPem,
  };
}

async function handleReceiptExport(env: Env, payload: Record<string, unknown>): Promise<void> {
  const workspaceId = Number(payload.workspaceId);
  const requestId = typeof payload.requestId === "string" ? payload.requestId : `ws-${workspaceId}`;
  if (!Number.isInteger(workspaceId) || workspaceId <= 0)
    throw new Error("receipt-export: bad workspaceId");
  const db = createDb(env);
  const rows = await db
    .select()
    .from(actionReceiptLedger)
    .where(eq(actionReceiptLedger.workspaceId, workspaceId))
    .orderBy(asc(actionReceiptLedger.id));
  const signer = await signerFromEnvironment(env);
  const bundle = await createSignedReceiptBundle(
    { workspaceId, exportedAt: new Date(), entries: rows.map(asEntry) },
    signer,
  );
  await putReceiptBundle(env, workspaceId, requestId, receiptBundleJson(bundle));
  await putReceiptHtml(env, workspaceId, requestId, renderReceiptHtml(bundle));
  console.log(
    `[queue] receipt-export workspace=${workspaceId} entries=${bundle.entries.length} head=${bundle.chainHead.slice(0, 12)}…`,
  );
}

async function handleWebhookDelivery(env: Env, payload: Record<string, unknown>): Promise<void> {
  const url = typeof payload.url === "string" ? payload.url : "";
  if (!url.startsWith("https://")) throw new Error("webhook-delivery: only https URLs allowed");
  const secret = typeof payload.secret === "string" ? payload.secret : "";
  const body = JSON.stringify({
    event: payload.event,
    payload: payload.payload,
    at: new Date().toISOString(),
  });
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    headers["x-rakshex-signature"] = [...new Uint8Array(sig)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  const res = await fetch(url, { method: "POST", headers, body });
  if (!res.ok) throw new Error(`webhook-delivery: ${res.status} from ${url}`);
}

async function handleProviderReconciliation(
  env: Env,
  payload: Record<string, unknown>,
): Promise<void> {
  // M0: record the reconciliation window; provider API reads (OpenAI Costs &
  // Usage) are the follow-up — the checksum query shape mirrors
  // services/billing/openAiBillingReconciliation.ts.
  const workspaceId = Number(payload.workspaceId ?? 0);
  console.log(
    `[queue] provider-reconciliation workspace=${workspaceId || "all"} — provider API read is a follow-up (see PORT_NOTES.md)`,
  );
  void env;
}

async function handleWeeklyDigestFanout(env: Env): Promise<void> {
  // M0: user directory lives in the Express DB; the Workers slice enqueues one
  // digest job per configured recipient in KV_CONFIG ("digest:recipients").
  const raw = await env.KV_CONFIG.get("digest:recipients");
  const recipients: Array<{ userId: number; email: string }> = raw
    ? (JSON.parse(raw) as typeof recipients)
    : [];
  for (const r of recipients) {
    if (r.email) await enqueueJob(env, "weekly-digest", { userId: r.userId, email: r.email });
  }
  console.log(`[queue] weekly-digest fan-out: ${recipients.length} recipients`);
}

async function handleWeeklyDigest(env: Env, payload: Record<string, unknown>): Promise<void> {
  const email = typeof payload.email === "string" ? payload.email : "";
  if (!email) throw new Error("weekly-digest: missing email");
  await sendMail(env, {
    to: email,
    subject: "Your RaksHex weekly digest",
    text: "Your weekly RaksHex firewall digest is attached in the dashboard.",
    html: "<p>Your weekly RaksHex firewall digest is available in the dashboard.</p>",
  });
}

export async function handleQueue(batch: MessageBatch<QueueMessageBody>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    const { type, payload } = message.body;
    try {
      switch (type) {
        case "receipt-export":
          await handleReceiptExport(env, payload);
          break;
        case "webhook-delivery":
          await handleWebhookDelivery(env, payload);
          break;
        case "provider-reconciliation":
          await handleProviderReconciliation(env, payload);
          break;
        case "weekly-digest-fanout":
          await handleWeeklyDigestFanout(env);
          break;
        case "weekly-digest":
          await handleWeeklyDigest(env, payload);
          break;
        default:
          console.warn(`[queue] unknown job type "${type}" — acked and dropped`);
      }
      message.ack();
    } catch (err) {
      await captureError(env, err, { queueJob: type });
      message.retry();
    }
  }
}
