import assert from "node:assert/strict";
import { test } from "node:test";
import probe from "../../cloudflare/staging/api-worker.mjs";

const bindings = {
  DB: {},
  CONFIG_KV: {},
  JOBS: {},
  OBJECTS: {},
};

test("staging probe checks isolated bindings without accessing storage", async () => {
  const response = await probe.fetch(
    new Request("https://rakshex-api-staging.rakshex.workers.dev/__health"),
    bindings,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    service: "rakshex-api-staging-probe",
    state: "bindings-configured",
    application_api_migrated: false,
  });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("staging probe fails visibly if a binding is missing", async () => {
  const response = await probe.fetch(
    new Request("https://rakshex-api-staging.rakshex.workers.dev/__health"),
    { DB: {} },
  );
  assert.equal(response.status, 503);
});

test("staging probe never advertises business API or authorizes actions", async () => {
  for (const path of [
    "/api/health",
    "/api/trpc/agentFirewall.evaluate",
    "/api/scan",
    "/api/webhooks/github",
  ]) {
    const response = await probe.fetch(
      new Request(`https://rakshex-api-staging.rakshex.workers.dev${path}`, {
        method: "POST",
        body: "{}",
      }),
      bindings,
    );
    assert.equal(response.status, 501);
    const json = await response.json();
    assert.equal(json.code, "NOT_MIGRATED");
  }
});

test("staging entry relays the real core without changing caller authorization or body", async () => {
  const { default: core } = await import("../../cloudflare/staging/core-worker.mjs");
  const key = "x".repeat(40);
  const input = {
    before: {
      openapi: "3.0.3",
      paths: { "/sample": { get: { responses: { 200: { description: "OK" } } } } },
    },
    after: { openapi: "3.0.3", paths: {} },
  };
  const bound = {
    ...bindings,
    CORE_API: { fetch: (request) => core.fetch(request, { STAGING_API_KEY: key }) },
  };
  for (const authorized of [false, true]) {
    const response = await probe.fetch(
      new Request("https://entry/api/v1/contract-diff", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(authorized ? { authorization: `Bearer ${key}` } : {}),
        },
        body: JSON.stringify(input),
      }),
      bound,
    );
    assert.equal(response.status, authorized ? 200 : 401);
    if (authorized) assert.equal((await response.json()).changes[0].kind, "operation_removed");
  }
});

test("staging entry preserves job polling status rather than inventing a success", async () => {
  const response = await probe.fetch(
    new Request("https://entry/api/v1/contract-diff/jobs/bc775860-f982-4bd0-821a-0d73744ea310"),
    { CORE_API: { fetch: async () => new Response('{"code":"NOT_FOUND"}', { status: 404 }) } },
  );
  assert.equal(response.status, 404);
});

test("missing or failed core service is a visible dependency failure", async () => {
  for (const env of [
    {},
    {
      CORE_API: {
        fetch: async () => {
          throw new Error("private internal detail");
        },
      },
    },
  ]) {
    const response = await probe.fetch(new Request("https://entry/api/health/ready"), env);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { code: "CORE_UNAVAILABLE" });
  }
});

test("unmigrated application routes never enter the narrow core relay", async () => {
  const env = {
    CORE_API: { fetch: async () => assert.fail("must not forward unsupported routes") },
  };
  for (const path of ["/api/trpc/auth.me", "/api/create-order", "/api/v1/unknown"])
    assert.equal((await probe.fetch(new Request("https://entry" + path), env)).status, 501);
});

test("control-plane routes use only the application service and preserve errors", async () => {
  let calls = 0;
  const env = {
    APP_API: {
      fetch: async (request) => {
        calls++;
        assert.equal(request.headers.get("authorization"), "Bearer sample");
        return new Response('{"code":"UNAUTHORIZED"}', { status: 401 });
      },
    },
    CORE_API: { fetch: async () => assert.fail("wrong service") },
  };
  const r = await probe.fetch(
    new Request("https://entry/api/v1/control/workspace", {
      headers: { authorization: "Bearer sample" },
    }),
    env,
  );
  assert.equal(r.status, 401);
  assert.equal(calls, 1);
  assert.equal(
    (await probe.fetch(new Request("https://entry/api/v1/control/health"), {})).status,
    503,
  );
});
