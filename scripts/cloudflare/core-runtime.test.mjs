import assert from "node:assert/strict";
import { test } from "node:test";
import core from "../../cloudflare/staging/core-worker.mjs";

const key = "test-cloudflare-staging-api-key-123456789";
const base = "https://rakshex-core-staging.rakshex.workers.dev";
const op = { responses: { 200: { description: "OK" } } };
const specs = {
  before: { openapi: "3.0.3", paths: { "/users": { get: op } } },
  after: { openapi: "3.0.3", paths: {} },
};
const env = { STAGING_API_KEY: key };

function request(path, method = "GET", body, auth = true) {
  return new Request(base + path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(auth ? { authorization: "Bearer " + key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test("public health does not misrepresent migration completeness", async () => {
  const health = await core.fetch(request("/api/health"), env);
  assert.equal(health.status, 200);
  const h = await health.json();
  assert.equal(h.production, false);
  assert.equal(h.state, "partial");
  const capabilities = await core.fetch(request("/api/v1/capabilities"), env);
  assert.equal(capabilities.status, 200);
  assert.ok((await capabilities.json()).not_migrated.length > 5);
});

test("missing secret and missing token always fail closed", async () => {
  const unconfigured = await core.fetch(request("/api/v1/contract-diff", "POST", specs), {});
  assert.equal(unconfigured.status, 503);
  const missingToken = await core.fetch(
    request("/api/v1/contract-diff", "POST", specs, false),
    env,
  );
  assert.equal(missingToken.status, 401);
});

test("existing shared scanner-core logic detects breaking OpenAPI changes", async () => {
  const response = await core.fetch(request("/api/v1/contract-diff", "POST", specs), env);
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.breaking, true);
  assert.equal(value.changes[0].kind, "operation_removed");
});

test("unknown endpoints never fake success", async () => {
  const response = await core.fetch(request("/api/trpc/auth.me"), env);
  assert.equal(response.status, 501);
});

test("DB readiness fails if migration table is missing", async () => {
  const response = await core.fetch(request("/api/health/ready"), {
    DB: { prepare: () => ({ first: async () => null }) },
  });
  assert.equal(response.status, 503);
});

test("invalid contracts do not enqueue jobs", async () => {
  let enqueues = 0;
  const response = await core.fetch(
    request("/api/v1/contract-diff/jobs", "POST", { before: {}, after: {} }),
    {
      ...env,
      DB: { prepare: () => ({ first: async () => ({ name: "contract_diff_jobs" }) }) },
      JOBS: {
        send: async () => {
          enqueues++;
        },
      },
    },
  );
  assert.equal(response.status, 422);
  assert.equal(enqueues, 0);
});

test("authenticated queue job persists a deterministic completed result and retries are safe", async () => {
  const rows = new Map();
  const sent = [];
  const fakeDb = {
    prepare(sql) {
      let bindings = [];
      return {
        bind(...values) {
          bindings = values;
          return this;
        },
        async first() {
          if (sql.includes("sqlite_master")) return { name: "contract_diff_jobs" };
          if (sql.includes("SELECT status, input_sha256 FROM contract_diff_jobs")) {
            return rows.get(bindings[0]) ?? null;
          }
          if (sql.includes("SELECT id, status, breaking")) {
            return rows.get(bindings[0]) ?? null;
          }
          throw new Error("unexpected SELECT");
        },
        async run() {
          if (sql.startsWith("INSERT")) {
            rows.set(bindings[0], {
              id: bindings[0],
              input_sha256: bindings[1],
              status: "queued",
              breaking: null,
              changes_json: null,
              error_code: null,
              created_at: "2026-10-12",
              updated_at: "2026-10-12",
            });
          } else if (sql.startsWith("UPDATE") && sql.includes("'completed'")) {
            const row = rows.get(bindings[2]);
            if (row?.status === "queued") {
              row.status = "completed";
              row.breaking = bindings[0];
              row.changes_json = bindings[1];
            }
          } else if (sql.startsWith("UPDATE") && sql.includes("'failed'")) {
            const row = rows.get(bindings[0]);
            row.status = "failed";
          } else {
            throw new Error("unexpected UPDATE");
          }
        },
      };
    },
  };
  const workingEnv = {
    ...env,
    DB: fakeDb,
    JOBS: {
      async send(message) {
        sent.push(message);
      },
    },
  };
  const create = await core.fetch(request("/api/v1/contract-diff/jobs", "POST", specs), workingEnv);
  assert.equal(create.status, 202);
  const job = await create.json();
  assert.equal(job.status, "queued");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].id, job.job_id);
  let acknowledgements = 0;
  let retries = 0;
  const message = {
    body: sent[0],
    ack() {
      acknowledgements++;
    },
    retry() {
      retries++;
    },
  };
  await core.queue({ messages: [message] }, workingEnv);
  await core.queue({ messages: [message] }, workingEnv);
  assert.equal(acknowledgements, 2);
  assert.equal(retries, 0);
  const poll = await core.fetch(request("/api/v1/contract-diff/jobs/" + job.job_id), workingEnv);
  assert.equal(poll.status, 200);
  const result = await poll.json();
  assert.equal(result.status, "completed");
  assert.equal(result.breaking, true);
  assert.equal(result.changes[0].kind, "operation_removed");
});
