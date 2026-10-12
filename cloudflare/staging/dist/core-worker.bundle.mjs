var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../../packages/scanner-core/src/contractDiff.ts
var METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];
function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}
__name(record, "record");
function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b));
}
__name(sorted, "sorted");
function assertSimple(value, where) {
  const obj = record(value);
  if (!obj || obj["$ref"]) {
    throw new Error(`Unsupported unresolved or invalid OpenAPI object at ${where}`);
  }
  return obj;
}
__name(assertSimple, "assertSimple");
function spec(input, label) {
  const obj = assertSimple(input, label);
  if (typeof obj.openapi !== "string" || !/^3\.[01](?:\.|$)/.test(obj.openapi)) {
    throw new Error(`${label} must be OpenAPI 3.0 or 3.1`);
  }
  if (!record(obj.paths)) {
    throw new Error(`${label}.paths must be an object`);
  }
  return obj;
}
__name(spec, "spec");
function params(root, operation, where) {
  const path = assertSimple(root, where + ".path");
  const rows = [
    ...Array.isArray(path.parameters) ? path.parameters : [],
    ...Array.isArray(operation.parameters) ? operation.parameters : []
  ];
  const result = /* @__PURE__ */ new Map();
  for (const [index, item] of rows.entries()) {
    const param = assertSimple(item, `${where}.parameters[${index}]`);
    if (typeof param.name !== "string" || typeof param.in !== "string") {
      throw new Error(`Invalid parameter at ${where}.parameters[${index}]`);
    }
    result.set(`${param.in}:${param.name}`, param.in === "path" || param.required === true);
  }
  return result;
}
__name(params, "params");
function jsonSchema(body, where) {
  const content = record(body.content);
  if (!content) return null;
  const json2 = record(content["application/json"]);
  if (!json2 || json2.schema === void 0) return null;
  return assertSimple(json2.schema, where + ".content.application/json.schema");
}
__name(jsonSchema, "jsonSchema");
function schemaProperties(schema, where) {
  const properties = schema.properties === void 0 ? {} : assertSimple(schema.properties, where + ".properties");
  for (const [key, value] of Object.entries(properties)) {
    assertSimple(value, where + ".properties." + key);
  }
  if (schema.allOf || schema.oneOf || schema.anyOf || schema.not || schema.discriminator) {
    throw new Error(`Unsupported composition at ${where}`);
  }
  const required = Array.isArray(schema.required) ? schema.required : [];
  if (!required.every((item) => typeof item === "string")) {
    throw new Error(`Invalid required list at ${where}`);
  }
  return { properties, required: new Set(required) };
}
__name(schemaProperties, "schemaProperties");
function responseSchema(operation, where) {
  const responses = assertSimple(operation.responses, where + ".responses");
  const success = record(responses["200"]);
  if (!success) return null;
  return jsonSchema(assertSimple(success, where + ".responses.200"), where + ".responses.200");
}
__name(responseSchema, "responseSchema");
function diffOpenApiContracts(beforeInput, afterInput) {
  const before = spec(beforeInput, "before");
  const after = spec(afterInput, "after");
  const beforePaths = assertSimple(before.paths, "before.paths");
  const afterPaths = assertSimple(after.paths, "after.paths");
  const changes = [];
  const add = /* @__PURE__ */ __name((kind, method, path, location, message) => {
    changes.push({ kind, method: method.toUpperCase(), path, location, message });
  }, "add");
  for (const path of sorted(Object.keys(beforePaths))) {
    const oldPath = assertSimple(beforePaths[path], "before.paths." + path);
    const newPathValue = afterPaths[path];
    const newPath = newPathValue === void 0 ? null : assertSimple(newPathValue, "after.paths." + path);
    for (const method of METHODS) {
      if (oldPath[method] === void 0) continue;
      const oldOp = assertSimple(oldPath[method], `before.paths.${path}.${method}`);
      if (!newPath || newPath[method] === void 0) {
        add("operation_removed", method, path, "paths", "Previously available operation removed");
        continue;
      }
      const newOp = assertSimple(newPath[method], `after.paths.${path}.${method}`);
      const oldParams = params(oldPath, oldOp, `before.paths.${path}.${method}`);
      const newParams = params(newPath, newOp, `after.paths.${path}.${method}`);
      for (const key of sorted([...newParams.keys()])) {
        if (newParams.get(key) && !oldParams.get(key)) {
          add(
            "required_parameter_added",
            method,
            path,
            "parameters." + key,
            `Newly required parameter: ${key}`
          );
        }
      }
      const oldBody = oldOp.requestBody === void 0 ? null : assertSimple(oldOp.requestBody, "before.requestBody");
      const newBody = newOp.requestBody === void 0 ? null : assertSimple(newOp.requestBody, "after.requestBody");
      if (newBody?.required === true && oldBody?.required !== true) {
        add("request_body_required", method, path, "requestBody", "Request body became required");
      }
      const oldSchema = oldBody ? jsonSchema(oldBody, "before.requestBody") : null;
      const newSchema = newBody ? jsonSchema(newBody, "after.requestBody") : null;
      if (newSchema) {
        const newer = schemaProperties(newSchema, "after.requestBody.schema");
        const older = oldSchema ? schemaProperties(oldSchema, "before.requestBody.schema") : { properties: {}, required: /* @__PURE__ */ new Set() };
        for (const key of sorted([...newer.required])) {
          if (!older.required.has(key)) {
            add(
              "required_request_property_added",
              method,
              path,
              "requestBody.application/json." + key,
              `Newly required JSON request property: ${key}`
            );
          }
        }
      }
      const oldResponse = responseSchema(oldOp, "before");
      const newResponse = responseSchema(newOp, "after");
      if (oldResponse && newResponse) {
        const older = schemaProperties(oldResponse, "before.response.schema");
        const newer = schemaProperties(newResponse, "after.response.schema");
        for (const key of sorted(Object.keys(older.properties))) {
          if (!(key in newer.properties)) {
            add(
              "response_property_removed",
              method,
              path,
              "responses.200.application/json." + key,
              `JSON 200 response property removed: ${key}`
            );
          }
        }
      }
    }
  }
  return {
    breaking: changes.length > 0,
    changes,
    scope: "Partial OpenAPI 3.0/3.1 detection: operations, required parameters, JSON body requirements, JSON 200 property removal. A clean result is NOT proof of compatibility."
  };
}
__name(diffOpenApiContracts, "diffOpenApiContracts");

// core-worker.mjs
var HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
};
var LIMIT = 64 * 1024;
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}
__name(json, "json");
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
__name(readLimitedJson, "readLimitedJson");
async function hash(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
__name(hash, "hash");
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
  const [a, b] = await Promise.all([hash(token), hash(env.STAGING_API_KEY)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0 ? null : json({ code: "UNAUTHORIZED" }, 401);
}
__name(authorize, "authorize");
function requireSpecPair(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw Object.assign(new Error("Expected JSON object"), { status: 400 });
  }
  if (!body.before || !body.after) {
    throw Object.assign(new Error("Expected before and after OpenAPI documents"), { status: 400 });
  }
  return { before: body.before, after: body.after };
}
__name(requireSpecPair, "requireSpecPair");
async function databaseReady(env) {
  if (!env.DB?.prepare) return false;
  try {
    const value = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'contract_diff_jobs'"
    ).first();
    return value?.name === "contract_diff_jobs";
  } catch {
    return false;
  }
}
__name(databaseReady, "databaseReady");
var notMigrated = [
  "existing PostgreSQL customers and data",
  "login/auth migration",
  "Express/tRPC API parity",
  "payment and gateway routes",
  "Socket.IO events",
  "existing Redis/BullMQ job contracts",
  "existing Firewall delegated authority and ledger integration"
];
var core_worker_default = {
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
        db ? 200 : 503
      );
    }
    if (request.method === "GET" && path === "/api/v1/capabilities") {
      return json({
        service: "rakshex-cloudflare-core-staging",
        production: false,
        implemented: ["authenticated deterministic OpenAPI contract diff", "D1-backed asynchronous diff jobs"],
        not_migrated: notMigrated
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
          if (!await databaseReady(env) || !env.JOBS?.send) {
            return json({ code: "DEPENDENCY_UNAVAILABLE" }, 503);
          }
          const input = requireSpecPair(await readLimitedJson(request));
          diffOpenApiContracts(input.before, input.after);
          const id = crypto.randomUUID();
          const inputHash = await hash(JSON.stringify(input));
          await env.DB.prepare(
            "INSERT INTO contract_diff_jobs (id, input_sha256, status) VALUES (?, ?, 'queued')"
          ).bind(id, inputHash).run();
          try {
            await env.JOBS.send({ kind: "contract_diff_v1", id, ...input });
          } catch {
            await env.DB.prepare(
              "UPDATE contract_diff_jobs SET status = 'failed', error_code = 'ENQUEUE_FAILED', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            ).bind(id).run();
            return json({ code: "ENQUEUE_FAILED" }, 503);
          }
          return json({ job_id: id, status: "queued" }, 202);
        }
        const match = request.method === "GET" && /^\/api\/v1\/contract-diff\/jobs\/([0-9a-f-]{36})$/.exec(path);
        if (match) {
          if (!await databaseReady(env)) return json({ code: "DEPENDENCY_UNAVAILABLE" }, 503);
          const row = await env.DB.prepare(
            "SELECT id, status, breaking, changes_json, error_code, created_at, updated_at FROM contract_diff_jobs WHERE id = ?"
          ).bind(match[1]).first();
          if (!row) return json({ code: "NOT_FOUND" }, 404);
          return json({
            job_id: row.id,
            status: row.status,
            breaking: row.breaking === null ? null : Boolean(row.breaking),
            changes: row.changes_json === null ? null : JSON.parse(row.changes_json),
            error_code: row.error_code,
            created_at: row.created_at,
            updated_at: row.updated_at
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
      if (payload?.kind !== "contract_diff_v1" || !/^[0-9a-f-]{36}$/.test(payload.id ?? "")) {
        message.ack();
        continue;
      }
      try {
        const row = await env.DB.prepare(
          "SELECT status FROM contract_diff_jobs WHERE id = ?"
        ).bind(payload.id).first();
        if (!row || row.status === "completed" || row.status === "failed") {
          message.ack();
          continue;
        }
        const result = diffOpenApiContracts(payload.before, payload.after);
        await env.DB.prepare(
          "UPDATE contract_diff_jobs SET status = 'completed', breaking = ?, changes_json = ?, error_code = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'queued'"
        ).bind(result.breaking ? 1 : 0, JSON.stringify(result.changes), payload.id).run();
        message.ack();
      } catch {
        message.retry({ delaySeconds: 10 });
      }
    }
  }
};
export {
  core_worker_default as default
};
//# sourceMappingURL=core-worker.js.map
