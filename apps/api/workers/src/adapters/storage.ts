/**
 * R2 storage adapter — replaces multer disk uploads (apps/api/storage.ts)
 * and receipt-bundle file exports.
 */
import type { Env } from "../env";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function putObject(
  env: Env,
  key: string,
  body: ArrayBuffer | string,
  contentType: string,
): Promise<void> {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : new Uint8Array(body);
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`Upload exceeds ${MAX_UPLOAD_BYTES} bytes`);
  }
  await env.RECEIPT_BUCKET.put(key, bytes, {
    httpMetadata: { contentType },
  });
}

export async function getObject(
  env: Env,
  key: string,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const obj = await env.RECEIPT_BUCKET.get(key);
  if (!obj) return null;
  return {
    body: await obj.arrayBuffer(),
    contentType: obj.httpMetadata?.contentType ?? "application/octet-stream",
  };
}

export const putReceiptBundle = (env: Env, workspaceId: number, requestId: string, json: string) =>
  putObject(env, `receipts/${workspaceId}/${requestId}.json`, json, "application/json");

export const putReceiptHtml = (env: Env, workspaceId: number, requestId: string, html: string) =>
  putObject(env, `receipts/${workspaceId}/${requestId}.html`, html, "text/html");
