/**
 * Cloudflare-first RaksHex API STAGING slice.
 * Shares RaksHex's existing deterministic YC #13 diff engine; does not
 * advertise or implement the legacy Express, tRPC, login or billing API.
 * ALL business routes require a private STAGING_API_KEY secret.
 */
import { diffOpenApiContracts } from "../../packages/scanner-core/src/contractDiff.ts";

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};
const LIMIT = 64 * 1024;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

async function readLimitedJson(request) {
  const ct = request.headers.get("content-type") ?? "";
  if (!/^application\/json(?:\s*;|$)/i.test(ct)) {
    throw Object.assign(new Error("Content-Type must be application/json"), { status: 415 });
  }
  const declared = Number(request.headers.get("content-length") || "0");
  if (declared > LIMIT) throw Object.assign(new Error("Payload too large"), { status: 413 });
  if (!request.body) throw Object.assign(new Error("JSON body is required"), { status: 400 });
  const reader = request.body.getReader();
  let length = 0;
  const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > LIMIT) {
        await reader.cancel();
        throw Object.assign(new Error("Payload too large"), { status: 413 });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw Object.assign(new Error("Malformed JSON body"), { status: 400 });
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
}

async function hash(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

async function authorize(request, env) {
  if (typeof env.STAGING_API_KEY !== "string" || env.STAGING_API_KEY.length < 32) {
    return json({ code: "STAGING_AUTH_UNCONFIGURED" }, 503);
  }
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ code: "UNAUTHORIZED" }, 401);
  const token = auth.slice(7);
  if (token.length !== env.STAGING_API_KEY.length || token.length > 256) {
    return json({ code: "UNAUTHORIZED" }, 401);
  }
  // Hash both inputs before comparison; never log keys or supplied tokens.
  const [a, b] = await Promise.all([hash(token), hash(env.STAGING_API_KEY)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0 ? null : json({ code: "UNAUTHORIZED" }, 401);
}

function requireSpecPair(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw Object.assign(new Error("Expected JSON object"), { status: 400 });
  }
  if (!body.before || !body.after) {
    throw Object.assign(new Error("Expected before and after OpenAPI documents"), { status: 400 });
  }
  return { before: body.before, after: body.after };
}

async function databaseReady(env) {
  if (!env.DB?.prepare) return false;
  try {
    const value = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'contract_diff_jobs'",
    ).first();
    return value?.name === "contract_diff_jobs";
  } catch {
    return false;
  }
}

const notMigrated = [
  "existing PostgreSQL customers and data",
  "login/auth migration",
  "Express/tRPC API parity",
  "payment and gateway routes",
  "Socket.IO events",
  "existing Redis/BullMQ job contracts",
  "existing Firewall delegated authority and ledger integration",
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === "GET" && path === "/api/health") {
      return json({ service: "rakshex-cloudflare-core-staging", state: "partial", production: false });
    }
    if (request.method === "GET" && path === "/api/health/ready") {
      const db = await databaseReady(env);
      return json(
        { service: "rakshex-cloudflare-core-staging", ready: db, database: db ? "ready" : "missing" },
        db ? 200 : 503,
      );
    }
    if (request.method === "GET" && path === "/api/v1/capabilities") {
      return json({
        service: "rakshex-cloudflare-core-staging",
        production: false,
        implemented: ["authenticated deterministic OpenAPI contract diff", "D1-backed asynchronous diff jobs"],
        not_migrated: notMigrated,
      });
    }
    if (path.startsWith("/api/v1/")) {
      const denied = await authorize(request, env);
      if (denied) return denied;
      try {
        if (request.method === "POST" && path === "/api/v1/contract-diff") {
          const { before, after } = requireSpecPair(await readLimitedJson(request));
          return json(diffOpenApiContracts(before, after));
        }
        if (request.method === "POST" && path === "/api/v1/contract-diff/jobs") {
          if (!(await databaseReady(env)) || !env.JOBS?.send) {
            return json({ code: "DEPENDENCY_UNAVAILABLE" }, 503);
          }
          const input = requireSpecPair(await readLimitedJson(request));
          // Validate synchronously before writing/enqueuing so invalid contracts never become jobs.
          diffOpenApiContracts(input.before, input.after);
          const id = crypto.randomUUID();
          const inputHash = await hash(JSON.stringify(input));
          await env.DB.prepare(
            "INSERT INTO contract_diff_jobs (id, input_sha256, status) VALUES (?, ?, 'queued')",
          ).bind(id, inputHash).run();
          try {
            await env.JOBS.send({ kind: "contract_diff_v1", id, ...input });
          } catch {
            await env.DB.prepare(
              "UPDATE contract_diff_jobs SET status = 'failed', error_code = 'ENQUEUE_FAILED', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            ).bind(id).run();
            return json({ code: "ENQUEUE_FAILED" }, 503);
          }
          return json({ job_id: id, status: "queued" }, 202);
        }
        const match = request.method === "GET" &&
          /^\/api\/v1\/contract-diff\/jobs\/([0-9a-f-]{36})$/.exec(path);
        if (match) {
          if (!(await databaseReady(env))) return json({ code: "DEPENDENCY_UNAVAILABLE" }, 503);
          const row = await env.DB.prepare(
            "SELECT id, status, breaking, changes_json, error_code, created_at, updated_at FROM contract_diff_jobs WHERE id = ?",
          ).bind(match[1]).first();
          if (!row) return json({ code: "NOT_FOUND" }, 404);
          return json({
            job_id: row.id,
            status: row.status,
            breaking: row.breaking === null ? null : Boolean(row.breaking),
            changes: row.changes_json === null ? null : JSON.parse(row.changes_json),
            error_code: row.error_code,
            created_at: row.created_at,
            updated_at: row.updated_at,
          });
        }
      } catch (error) {
        if (error?.status) return json({ code: "INVALID_REQUEST", message: error.message }, error.status);
        if (error instanceof Error && /Unsupported|OpenAPI|Invalid|\.paths|required|composition/.test(error.message)) {
          return json({ code: "UNSUPPORTED_CONTRACT", message: error.message }, 422);
        }
        return json({ code: "STAGING_API_ERROR" }, 500);
      }
    }
    return json({ code: "NOT_MIGRATED", message: "This RaksHex endpoint has not been migrated." }, 501);
  },

  async queue(batch, env) {
    if (!env.DB?.prepare) throw new Error("D1 database binding missing");
    for (const message of batch.messages) {
      const payload = message.body;
      if (payload?.kind !== "contract_diff_v1" ||
        !/^[0-9a-f-]{36}$/.test(payload.id ?? "")) {
        // Unrecognized jobs never execute arbitrary effects or mutate data.
        message.ack();
        continue;
      }
      try {
        const row = await env.DB.prepare(
          "SELECT status FROM contract_diff_jobs WHERE id = ?",
        ).bind(payload.id).first();
        if (!row || row.status === "completed" || row.status === "failed") {
          message.ack();
          continue;
        }
        const result = diffOpenApiContracts(payload.before, payload.after);
        await env.DB.prepare(
          "UPDATE contract_diff_jobs SET status = 'completed', breaking = ?, changes_json = ?, error_code = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'queued'",
        ).bind(result.breaking ? 1 : 0, JSON.stringify(result.changes), payload.id).run();
        message.ack();
      } catch {
        // At-least-once queue delivery. No side effects beyond an idempotent
        // status update; retried messages re-evaluate deterministic input.
        message.retry({ delaySeconds: 10 });
      }
    }
  },
};
