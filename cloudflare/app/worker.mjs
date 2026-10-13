import { z } from "zod";
import {
  evaluateAction,
  normalizeSemanticAction,
  semanticActionCatalog,
} from "../../packages/action-control/src/index.ts";
import { canonical, sha256, signReceipt } from "./evidence.mjs";
const PREFIX = "/api/v1/control";
const safeNumber = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const identifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);
const patterns = z.array(z.string().min(1).max(128)).max(100);
const scopeSchema = z
  .object({
    actions: patterns.min(1),
    resources: patterns.optional(),
    environments: patterns.optional(),
    maxAmountMinor: safeNumber.optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
    maxCount: safeNumber.min(1).optional(),
    validFrom: z.string().datetime().optional(),
    expiresAt: z.string().datetime().optional(),
    maxDelegationDepth: z.literal(0).optional(),
  })
  .strict();
const policySchema = z
  .object({
    version: identifier,
    denyActions: patterns.optional(),
    approvalActions: patterns.optional(),
    approvalAboveMinor: safeNumber.optional(),
    dailyAmountLimitMinor: safeNumber.optional(),
    dangerousSequences: z.array(patterns.min(2).max(10)).max(25).optional(),
    unknownWriteDecision: z.enum(["DENY", "APPROVAL_REQUIRED"]).optional(),
  })
  .strict();
const actionSchema = z
  .object({
    provider: z.string().min(1).max(64),
    operation: z.string().min(1).max(128),
    toolName: z.string().max(128).optional(),
    parameters: z.record(z.string(), z.unknown()).optional(),
    resource: z.string().max(512).optional(),
    environment: z.string().max(32).optional(),
    amountMinor: safeNumber.optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
  })
  .strict();
const authorizeSchema = z
  .object({
    requestId: identifier,
    agentId: identifier,
    authorityId: identifier,
    action: actionSchema,
  })
  .strict();
const DEFAULT_POLICY = {
  version: "cloudflare:1",
  approvalActions: ["code.merge", "code.deploy", "database.schema.change"],
  unknownWriteDecision: "DENY",
};
function response(body, status = 200, requestId = "") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-request-id": requestId,
    },
  });
}
function error(status, code) {
  throw Object.assign(new Error(code), { status, code });
}
async function body(request, schema) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? ""))
    error(415, "JSON_REQUIRED");
  if (!request.body) error(400, "BODY_REQUIRED");
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        error(413, "BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  let value;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    error(400, "INVALID_JSON");
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) error(400, "INVALID_INPUT");
  return parsed.data;
}
function token() {
  return (
    "rk_cf_" +
    [...crypto.getRandomValues(new Uint8Array(32))]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
  );
}
async function bootstrapAuth(request, env) {
  if (typeof env.ADMIN_BOOTSTRAP_KEY !== "string" || env.ADMIN_BOOTSTRAP_KEY.length < 32)
    error(503, "BOOTSTRAP_UNCONFIGURED");
  const supplied = request.headers.get("authorization") ?? "";
  const [a, b] = await Promise.all([sha256(supplied), sha256("Bearer " + env.ADMIN_BOOTSTRAP_KEY)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  if (diff) error(401, "UNAUTHORIZED");
}
async function authenticate(request, env) {
  const supplied = request.headers.get("authorization") ?? "";
  if (!/^Bearer rk_cf_[a-f0-9]{64}$/.test(supplied)) error(401, "UNAUTHORIZED");
  const hash = await sha256(supplied.slice(7));
  const row = await env.DB.prepare(
    "SELECT id,workspace_id,role FROM cf_api_keys WHERE token_hash = ? AND revoked_at IS NULL",
  )
    .bind(hash)
    .first();
  if (!row) error(401, "UNAUTHORIZED");
  return row;
}
function requireAdmin(key) {
  if (key.role !== "admin") error(403, "ADMIN_REQUIRED");
}
async function workspace(env, key) {
  const w = await env.DB.prepare("SELECT * FROM cf_workspaces WHERE id = ?")
    .bind(key.workspace_id)
    .first();
  if (!w) error(403, "WORKSPACE_UNAVAILABLE");
  return w;
}
async function authorize(env, key, input) {
  const requestHash = await sha256(canonical(input));
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await env.DB.prepare(
      "SELECT request_hash,receipt_json FROM cf_receipts WHERE workspace_id = ? AND request_id = ?",
    )
      .bind(key.workspace_id, input.requestId)
      .first();
    if (existing) {
      if (existing.request_hash !== requestHash) error(409, "IDEMPOTENCY_CONFLICT");
      return { replayed: true, receipt: JSON.parse(existing.receipt_json) };
    }
    const w = await workspace(env, key);
    const a = await env.DB.prepare(
      "SELECT * FROM cf_authorities WHERE workspace_id = ? AND id = ? AND agent_id = ?",
    )
      .bind(key.workspace_id, input.authorityId, input.agentId)
      .first();
    const agent = await env.DB.prepare(
      "SELECT status FROM cf_agents WHERE workspace_id = ? AND id = ?",
    )
      .bind(key.workspace_id, input.agentId)
      .first();
    const previous = await env.DB.prepare(
      "SELECT entry_hash FROM cf_receipts WHERE workspace_id = ? ORDER BY id DESC LIMIT 1",
    )
      .bind(key.workspace_id)
      .first();
    const since = new Date().toISOString().slice(0, 10) + "T00:00:00.000Z";
    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM cf_receipts WHERE workspace_id = ? AND authority_id = ? AND event_type = 'allow'",
    )
      .bind(key.workspace_id, input.authorityId)
      .first();
    const amount = await env.DB.prepare(
      "SELECT COALESCE(SUM(amount_minor),0) AS amount FROM cf_receipts WHERE workspace_id = ? AND event_type = 'allow' AND occurred_at >= ?",
    )
      .bind(key.workspace_id, since)
      .first();
    const recent = await env.DB.prepare(
      "SELECT receipt_json FROM cf_receipts WHERE workspace_id = ? AND agent_id = ? AND event_type = 'allow' ORDER BY id DESC LIMIT 10",
    )
      .bind(key.workspace_id, input.agentId)
      .all();
    const action = normalizeSemanticAction(input.action);
    const scope = a?.status === "active" ? scopeSchema.parse(JSON.parse(a.scope_json)) : null;
    const policy = policySchema.parse(JSON.parse(w.policy_json));
    const decision = evaluateAction({
      mode: "enforce",
      action,
      authority: scope,
      frozen: Boolean(w.frozen) || agent?.status !== "active",
      policy,
      cumulative: {
        actionCount: count.count,
        amountMinor: amount.amount,
        recentActions: recent.results
          .reverse()
          .map((row) => JSON.parse(row.receipt_json).payload.semanticAction),
      },
    });
    if ((input.action.amountMinor ?? 0) > 0 && input.action.currency !== w.currency) {
      decision.decision = "DENY";
      decision.effectiveDecision = "DENY";
      decision.reasons = ["Action currency must match workspace currency"];
    }
    const allowed = decision.effectiveDecision === "ALLOW";
    const material = {
      version: 1,
      workspaceId: key.workspace_id,
      requestId: input.requestId,
      eventType: allowed ? "allow" : "deny",
      occurredAt: new Date().toISOString(),
      payload: {
        requestHash,
        agentId: input.agentId,
        authorityId: input.authorityId,
        semanticAction: action.name,
        effect: action.effect,
        amountMinor: input.action.amountMinor ?? 0,
        currency: input.action.currency ?? w.currency,
        ...decision,
      },
      previousHash: previous?.entry_hash ?? "0".repeat(64),
    };
    const receipt = await signReceipt(material, env);
    // Compare-and-swap the chain tip AND security state in one atomic SQLite
    // statement. A racing authorization/revocation/config change forces re-evaluation.
    const inserted = await env.DB.prepare(
      `INSERT INTO cf_receipts (workspace_id,request_id,request_hash,agent_id,authority_id,event_type,decision,amount_minor,occurred_at,entry_hash,previous_hash,receipt_json)
   SELECT ?,?,?,?,?,?,?,?,?,?,?,?
   WHERE COALESCE((SELECT entry_hash FROM cf_receipts WHERE workspace_id = ? ORDER BY id DESC LIMIT 1),?) = ?
    AND EXISTS(SELECT 1 FROM cf_workspaces WHERE id = ? AND revision = ?)
    AND EXISTS(SELECT 1 FROM cf_api_keys WHERE id = ? AND workspace_id = ? AND revoked_at IS NULL)
    AND COALESCE((SELECT scope_json || ':' || status FROM cf_authorities WHERE workspace_id = ? AND id = ? AND agent_id = ?),'') = ?
    AND COALESCE((SELECT status FROM cf_agents WHERE workspace_id = ? AND id = ?),'') = ?
    AND NOT EXISTS(SELECT 1 FROM cf_receipts WHERE workspace_id = ? AND request_id = ?)
    AND (? = 0 OR EXISTS(SELECT 1 FROM cf_authorities WHERE workspace_id = ? AND id = ?
      AND (json_extract(scope_json,'$.expiresAt') IS NULL OR julianday(json_extract(scope_json,'$.expiresAt')) > julianday('now'))
      AND (json_extract(scope_json,'$.validFrom') IS NULL OR julianday(json_extract(scope_json,'$.validFrom')) <= julianday('now'))))`,
    )
      .bind(
        key.workspace_id,
        input.requestId,
        requestHash,
        input.agentId,
        input.authorityId,
        material.eventType,
        decision.decision,
        allowed ? (input.action.amountMinor ?? 0) : 0,
        material.occurredAt,
        receipt.entryHash,
        receipt.previousHash,
        JSON.stringify(receipt),
        key.workspace_id,
        "0".repeat(64),
        receipt.previousHash,
        key.workspace_id,
        w.revision,
        key.id,
        key.workspace_id,
        key.workspace_id,
        input.authorityId,
        input.agentId,
        a ? a.scope_json + ":" + a.status : "",
        key.workspace_id,
        input.agentId,
        agent?.status ?? "",
        key.workspace_id,
        input.requestId,
        allowed ? 1 : 0,
        key.workspace_id,
        input.authorityId,
      )
      .run();
    if (inserted.meta.changes === 1) return { replayed: false, receipt };
    // Auth key revocation must not be reported as a successful retry.
    const active = await env.DB.prepare(
      "SELECT id FROM cf_api_keys WHERE id = ? AND revoked_at IS NULL",
    )
      .bind(key.id)
      .first();
    if (!active) error(401, "UNAUTHORIZED");
  }
  error(503, "AUTHORIZATION_CONTENTION_RETRY");
}
export default {
  async fetch(request, env) {
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (request.method === "GET" && path === PREFIX + "/health") {
        let db = false;
        try {
          db = Boolean(
            await env.DB?.prepare(
              "SELECT name FROM sqlite_master WHERE type='table' AND name='cf_receipts'",
            ).first(),
          );
        } catch {
          // A failed schema probe reports not-ready below.
        }
        const signing = Boolean(
          env.RECEIPT_PRIVATE_KEY && env.RECEIPT_PUBLIC_PEM && env.RECEIPT_KEY_ID,
        );
        return response(
          {
            service: "rakshex-cloudflare-app-staging",
            production: false,
            ready: db && signing,
            database: db,
            signing,
          },
          db && signing ? 200 : 503,
          requestId,
        );
      }
      if (request.method === "GET" && path === PREFIX + "/capabilities")
        return response(
          {
            production: false,
            implemented: [
              "workspace API keys",
              "agent identities",
              "stored policies",
              "root authority grants and revocation",
              "atomic signed authorization receipts",
              "workspace freeze",
              "tenant-scoped receipt export",
            ],
            not_implemented: [
              "browser login/session auth",
              "delegation chains",
              "credential broker and provider execution",
              "human approval consumption",
              "billing",
              "realtime",
            ],
            execution_enabled: false,
          },
          200,
          requestId,
        );
      const methods = new Map([
        [PREFIX + "/bootstrap", ["POST"]],
        [PREFIX + "/workspace", ["GET"]],
        [PREFIX + "/keys", ["GET", "POST"]],
        [PREFIX + "/agents", ["GET", "POST"]],
        [PREFIX + "/authorities", ["GET", "POST"]],
        [PREFIX + "/policy", ["PUT"]],
        [PREFIX + "/freeze", ["POST"]],
        [PREFIX + "/authorize", ["POST"]],
        [PREFIX + "/receipts", ["GET"]],
        [PREFIX + "/catalog", ["GET"]],
      ]);
      const revoke = /^\/api\/v1\/control\/(keys|authorities)\/([A-Za-z0-9._:-]+)\/revoke$/.exec(
        path,
      );
      const agentStatus = /^\/api\/v1\/control\/agents\/([A-Za-z0-9._:-]+)\/status$/.exec(path);
      const supported = methods.get(path) ?? (revoke || agentStatus ? ["POST"] : null);
      if (!supported) return response({ code: "NOT_FOUND" }, 404, requestId);
      if (!supported.includes(request.method))
        return response({ code: "METHOD_NOT_ALLOWED" }, 405, requestId);
      if (!env.DB?.prepare) error(503, "DATABASE_UNAVAILABLE");
      if (path === PREFIX + "/bootstrap") {
        await bootstrapAuth(request, env);
        const input = await body(
          request,
          z
            .object({
              name: z.string().min(1).max(128),
              currency: z
                .string()
                .regex(/^[A-Z]{3}$/)
                .default("INR"),
            })
            .strict(),
        );
        const newKey = token();
        const hash = await sha256(newKey);
        const keyId = crypto.randomUUID();
        const results = await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO cf_workspaces (name,currency,policy_json) VALUES (?,?,?) RETURNING id",
          ).bind(input.name, input.currency, JSON.stringify(DEFAULT_POLICY)),
          env.DB.prepare(
            "INSERT INTO cf_api_keys (id,workspace_id,token_hash,role) VALUES (?,last_insert_rowid(),?,'admin')",
          ).bind(keyId, hash),
        ]);
        return response(
          { workspaceId: results[0].results[0].id, apiKey: newKey, keyId },
          201,
          requestId,
        );
      }
      const key = await authenticate(request, env);
      if (path === PREFIX + "/workspace")
        return response(await workspace(env, key), 200, requestId);
      if (path === PREFIX + "/catalog")
        return response({ actions: semanticActionCatalog() }, 200, requestId);
      if (path === PREFIX + "/receipts") {
        const raw = url.searchParams.get("limit") ?? "50";
        if (!/^\d+$/.test(raw)) error(400, "INVALID_LIMIT");
        const limit = Math.min(100, Math.max(1, Number(raw)));
        const rows = await env.DB.prepare(
          "SELECT id,receipt_json FROM cf_receipts WHERE workspace_id = ? ORDER BY id DESC LIMIT ?",
        )
          .bind(key.workspace_id, limit)
          .all();
        return response(
          {
            receipts: rows.results.map((r) => ({ id: r.id, ...JSON.parse(r.receipt_json) })),
            complete_chain: false,
          },
          200,
          requestId,
        );
      }
      if (path === PREFIX + "/authorize") {
        if (key.role === "read") error(403, "RUNTIME_REQUIRED");
        const input = await body(request, authorizeSchema);
        return response(await authorize(env, key, input), 200, requestId);
      }
      requireAdmin(key);
      if (path === PREFIX + "/keys") {
        if (request.method === "GET")
          return response(
            {
              keys: (
                await env.DB.prepare(
                  "SELECT id,role,revoked_at,created_at FROM cf_api_keys WHERE workspace_id = ?",
                )
                  .bind(key.workspace_id)
                  .all()
              ).results,
            },
            200,
            requestId,
          );
        const input = await body(request, z.object({ role: z.enum(["runtime", "read"]) }).strict());
        const newKey = token();
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO cf_api_keys (id,workspace_id,token_hash,role) VALUES (?,?,?,?)",
        )
          .bind(id, key.workspace_id, await sha256(newKey), input.role)
          .run();
        return response({ keyId: id, apiKey: newKey, role: input.role }, 201, requestId);
      }
      if (path === PREFIX + "/agents") {
        if (request.method === "GET")
          return response(
            {
              agents: (
                await env.DB.prepare("SELECT id,name,status FROM cf_agents WHERE workspace_id = ?")
                  .bind(key.workspace_id)
                  .all()
              ).results,
            },
            200,
            requestId,
          );
        const input = await body(request, z.object({ name: z.string().min(1).max(128) }).strict());
        const id = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO cf_agents (id,workspace_id,name) VALUES (?,?,?)")
          .bind(id, key.workspace_id, input.name)
          .run();
        return response({ agentId: id }, 201, requestId);
      }
      if (path === PREFIX + "/authorities") {
        if (request.method === "GET")
          return response(
            {
              authorities: (
                await env.DB.prepare(
                  "SELECT id,agent_id,scope_json,status FROM cf_authorities WHERE workspace_id = ?",
                )
                  .bind(key.workspace_id)
                  .all()
              ).results,
            },
            200,
            requestId,
          );
        const input = await body(
          request,
          z.object({ agentId: identifier, scope: scopeSchema }).strict(),
        );
        const id = crypto.randomUUID();
        const inserted = await env.DB.prepare(
          "INSERT INTO cf_authorities (id,workspace_id,agent_id,scope_json) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM cf_agents WHERE workspace_id = ? AND id = ? AND status = 'active')",
        )
          .bind(
            id,
            key.workspace_id,
            input.agentId,
            JSON.stringify(input.scope),
            key.workspace_id,
            input.agentId,
          )
          .run();
        if (!inserted.meta.changes) error(404, "AGENT_NOT_FOUND");
        return response({ authorityId: id }, 201, requestId);
      }
      if (path === PREFIX + "/policy") {
        const policy = await body(request, policySchema);
        await env.DB.prepare(
          "UPDATE cf_workspaces SET policy_json = ?, revision = revision + 1 WHERE id = ?",
        )
          .bind(JSON.stringify(policy), key.workspace_id)
          .run();
        return response({ updated: true }, 200, requestId);
      }
      if (path === PREFIX + "/freeze") {
        const input = await body(request, z.object({ frozen: z.boolean() }).strict());
        await env.DB.prepare(
          "UPDATE cf_workspaces SET frozen = ?, revision = revision + 1 WHERE id = ?",
        )
          .bind(input.frozen ? 1 : 0, key.workspace_id)
          .run();
        return response({ frozen: input.frozen }, 200, requestId);
      }
      if (revoke) {
        const sql =
          revoke[1] === "keys"
            ? "UPDATE cf_api_keys SET revoked_at = CURRENT_TIMESTAMP WHERE workspace_id = ? AND id = ? AND revoked_at IS NULL"
            : "UPDATE cf_authorities SET status = 'revoked' WHERE workspace_id = ? AND id = ? AND status = 'active'";
        const result = await env.DB.prepare(sql).bind(key.workspace_id, revoke[2]).run();
        if (!result.meta.changes) error(404, "ACTIVE_RESOURCE_NOT_FOUND");
        return response({ revoked: true }, 200, requestId);
      }
      if (agentStatus) {
        const input = await body(
          request,
          z.object({ status: z.enum(["active", "paused", "revoked"]) }).strict(),
        );
        const result = await env.DB.prepare(
          "UPDATE cf_agents SET status = ? WHERE workspace_id = ? AND id = ?",
        )
          .bind(input.status, key.workspace_id, agentStatus[1])
          .run();
        if (!result.meta.changes) error(404, "AGENT_NOT_FOUND");
        return response({ status: input.status }, 200, requestId);
      }
      return response({ code: "NOT_FOUND" }, 404, requestId);
    } catch (e) {
      return response({ code: e.code ?? "DEPENDENCY_UNAVAILABLE" }, e.status ?? 503, requestId);
    }
  },
};
