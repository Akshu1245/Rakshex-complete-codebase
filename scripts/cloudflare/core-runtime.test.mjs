import assert from "node:assert/strict";
import { test } from "node:test";
import core from "../../cloudflare/staging/core-worker.mjs";

const key = "test-cloudflare-staging-api-key-123456789";
const base = "https://rakshex-core-staging.rakshex.workers.dev";
const op = { responses: { "200": { description: "OK" } } };
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
  const missingToken = await core.fetch(request("/api/v1/contract-diff", "POST", specs, false), env);
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
      JOBS: { send: async () => { enqueues++; } },
    },
  );
  assert.equal(response.status, 422);
  assert.equal(enqueues, 0);
});
