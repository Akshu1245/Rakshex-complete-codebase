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
