/**
 * GET /v1/receipts/:id — fetch one signed receipt entry.
 * POST /v1/receipts/verify — offline WebCrypto verification of a receipt entry
 * or full bundle against a caller-supplied trusted key ring.
 */
import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { createDb } from "../db";
import type { Env } from "../env";
import { actionReceiptLedger } from "../schema";
import {
  createSignedReceiptBundle,
  signerFromEnvironment,
  verifyEntry,
  verifyReceiptBundle,
  type ReceiptBundle,
  type ReceiptEntryExport,
  type TrustedReceiptKeys,
} from "../receipts";
import { captureError } from "../adapters/sentry";
import { authenticate, authenticateKey } from "./evaluate";

export const app = new Hono<{ Bindings: Env }>();

/** DoS guard: verification is CPU-heavy (Ed25519 per entry), so cap the work. */
const VERIFY_MAX_BODY_BYTES = 5_000_000;
const VERIFY_MAX_BUNDLE_ENTRIES = 1_000;

function rowToExport(row: typeof actionReceiptLedger.$inferSelect): ReceiptEntryExport {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.payload) as Record<string, unknown>;
  } catch {
    payload = { _corrupt: true };
  }
  return {
    version: 1,
    id: row.id,
    workspaceId: row.workspaceId,
    requestId: row.requestId,
    eventType: row.eventType as ReceiptEntryExport["eventType"],
    occurredAt: new Date(row.occurredAt).toISOString(),
    payload,
    previousHash: row.previousHash,
    entryHash: row.entryHash,
    signingKeyId: row.signingKeyId,
    signingAlgorithm: "ed25519",
    signature: row.signature,
    publicKeyPem: row.publicKeyPem,
  };
}

/* NOTE: /:id is registered AFTER /export so "export" is not captured as an id. */

app.post("/verify", async (c) => {
  const env = c.env;
  let raw: string;
  try {
    raw = await c.req.text();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (raw.length > VERIFY_MAX_BODY_BYTES) {
    return Response.json({ error: "Bundle too large" }, { status: 413 });
  }
  let body: { entry?: ReceiptEntryExport; bundle?: ReceiptBundle; trustedKeys: TrustedReceiptKeys };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.trustedKeys || typeof body.trustedKeys !== "object") {
    return Response.json({ error: "trustedKeys is required" }, { status: 400 });
  }
  if (body.bundle?.entries && body.bundle.entries.length > VERIFY_MAX_BUNDLE_ENTRIES) {
    return Response.json(
      { error: `Bundle exceeds ${VERIFY_MAX_BUNDLE_ENTRIES} entries` },
      { status: 413 },
    );
  }
  try {
    if (body.bundle) {
      const result = await verifyReceiptBundle(body.bundle, body.trustedKeys);
      return Response.json(result.valid ? { valid: true } : { valid: false, error: result.error });
    }
    if (body.entry) {
      const error = await verifyEntry(body.entry, body.trustedKeys);
      return Response.json(error ? { valid: false, error } : { valid: true });
    }
    return Response.json({ error: "Provide entry or bundle" }, { status: 400 });
  } catch (err) {
    await captureError(env, err, { route: "POST /v1/receipts/verify" });
    return Response.json({ error: "Verification failed" }, { status: 500 });
  }
});

/** GET /v1/receipts/export?workspaceId=1[&requestId=...] — signed bundle (JSON).
 *  Authenticated: the bearer key must belong to the requested workspace. */
app.get("/export", async (c) => {
  const env = c.env;
  const db = createDb(env);
  const workspaceId = Number(c.req.query("workspaceId"));
  const requestId = c.req.query("requestId") ?? undefined;
  if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
    return Response.json({ error: "workspaceId is required" }, { status: 400 });
  }
  const auth = await authenticate(db, env, c.req.raw, workspaceId);
  if (!auth.ok) return auth.response;
  try {
    const rows = await db
      .select()
      .from(actionReceiptLedger)
      .where(eq(actionReceiptLedger.workspaceId, workspaceId))
      .orderBy(asc(actionReceiptLedger.id));
    let selected = rows;
    if (requestId) {
      let terminal = -1;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i]!.requestId === requestId) {
          terminal = i;
          break;
        }
      }
      if (terminal < 0)
        return Response.json({ error: "requestId not found in ledger" }, { status: 404 });
      selected = rows.slice(0, terminal + 1);
    }
    const signer = await signerFromEnvironment(env);
    const bundle = await createSignedReceiptBundle(
      { workspaceId, exportedAt: new Date(), entries: selected.map(rowToExport) },
      signer,
    );
    return Response.json({ bundle });
  } catch (err) {
    await captureError(env, err, { route: "GET /v1/receipts/export" });
    return Response.json({ error: "Export failed" }, { status: 500 });
  }
});

app.get("/:id", async (c) => {
  const env = c.env;
  const db = createDb(env);
  const ka = await authenticateKey(db, env, c.req.raw);
  if (!ka.ok) return ka.response;
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Invalid receipt id" }, { status: 400 });
  }
  const [row] = await db
    .select()
    .from(actionReceiptLedger)
    .where(eq(actionReceiptLedger.id, id))
    .limit(1);
  // 404 on workspace mismatch too — no cross-tenant existence oracle.
  if (!row || row.workspaceId !== ka.key.workspaceId) {
    return Response.json({ error: "Receipt not found" }, { status: 404 });
  }
  return Response.json({ receipt: rowToExport(row) });
});
