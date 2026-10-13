import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import worker from "../../cloudflare/staging/core-worker.mjs";
const key = "x".repeat(40);
const before = {
  openapi: "3.0.3",
  paths: { "/sample": { get: { responses: { 200: { description: "OK" } } } } },
};
const after = { openapi: "3.0.3", paths: {} };
const digest = createHash("sha256").update(JSON.stringify({ before, after })).digest("hex");
function envFixture(row = { status: "queued", input_sha256: digest }) {
  const writes = [];
  const env = {
    STAGING_API_KEY: key,
    JOBS: { send: async () => {} },
    DB: {
      prepare(sql) {
        return {
          bind(...values) {
            this.values = values;
            return this;
          },
          async first() {
            return sql.includes("sqlite_master") ? { name: "contract_diff_jobs" } : row;
          },
          async run() {
            writes.push({ sql, values: this.values });
            return {};
          },
        };
      },
    },
  };
  return { env, writes };
}
test("readiness requires database, authentication and queue; remains staging-only", async () => {
  const { env } = envFixture();
  const request = () => new Request("https://example/api/health/ready");
  let r = await worker.fetch(request(), env);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).production, false);
  for (const missing of ["STAGING_API_KEY", "JOBS", "DB"]) {
    r = await worker.fetch(request(), { ...env, [missing]: undefined });
    assert.equal(r.status, 503);
  }
});
test("business route rejects missing or wrong token", async () => {
  const { env } = envFixture();
  for (const authorization of ["", `Bearer ${"y".repeat(40)}`]) {
    const r = await worker.fetch(
      new Request("https://example/api/v1/contract-diff", {
        method: "POST",
        headers: { authorization },
      }),
      env,
    );
    assert.equal(r.status, 401);
  }
});
test("authenticated diff identifies removed operation", async () => {
  const { env } = envFixture();
  const r = await worker.fetch(
    new Request("https://example/api/v1/contract-diff", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ before, after }),
    }),
    env,
  );
  assert.equal(r.status, 200);
  assert.equal((await r.json()).changes[0].kind, "operation_removed");
});
test("queue completes matching input and acknowledges", async () => {
  const { env, writes } = envFixture();
  let ack = 0;
  let retry = 0;
  await worker.queue(
    {
      messages: [
        {
          body: {
            kind: "contract_diff_v1",
            id: "bc775860-f982-4bd0-821a-0d73744ea310",
            before,
            after,
          },
          ack() {
            ack++;
          },
          retry() {
            retry++;
          },
        },
      ],
    },
    env,
  );
  assert.equal(ack, 1);
  assert.equal(retry, 0);
  assert.match(writes[0].sql, /completed/);
});
test("changed queue input fails permanently rather than evaluating it", async () => {
  const { env, writes } = envFixture({ status: "queued", input_sha256: "0".repeat(64) });
  let ack = 0;
  await worker.queue(
    {
      messages: [
        {
          body: {
            kind: "contract_diff_v1",
            id: "bc775860-f982-4bd0-821a-0d73744ea310",
            before,
            after,
          },
          ack() {
            ack++;
          },
          retry() {
            assert.fail("must not retry tampered input");
          },
        },
      ],
    },
    env,
  );
  assert.equal(ack, 1);
  assert.match(writes[0].sql, /INPUT_HASH_MISMATCH/);
});
test("duplicate completed message performs no writes", async () => {
  const { env, writes } = envFixture({ status: "completed", input_sha256: digest });
  await worker.queue(
    {
      messages: [
        {
          body: {
            kind: "contract_diff_v1",
            id: "bc775860-f982-4bd0-821a-0d73744ea310",
            before,
            after,
          },
          ack() {},
          retry() {
            assert.fail();
          },
        },
      ],
    },
    env,
  );
  assert.equal(writes.length, 0);
});
test("database outage retries without acknowledgement", async () => {
  const env = {
    DB: {
      prepare() {
        throw new Error("down");
      },
    },
  };
  let retry = 0;
  await worker.queue(
    {
      messages: [
        {
          body: {
            kind: "contract_diff_v1",
            id: "bc775860-f982-4bd0-821a-0d73744ea310",
            before,
            after,
          },
          ack() {
            assert.fail();
          },
          retry() {
            retry++;
          },
        },
      ],
    },
    env,
  );
  assert.equal(retry, 1);
});
