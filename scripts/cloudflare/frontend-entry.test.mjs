import assert from "node:assert/strict";
import { test } from "node:test";
import { routeFrontendApi } from "../../apps/web/cloudflare-api-proxy.mjs";

test("API forwarding preserves method, body, caller credentials and query", async () => {
  const request = new Request("https://frontend.example/api/v1/control/actions?check=1", {
    method: "POST",
    headers: { authorization: "Bearer caller-key", "content-type": "application/json" },
    body: JSON.stringify({ action: "data.read" }),
  });
  const result = await routeFrontendApi(request, {
    RAKSHEX_API: {
      async fetch(upstream) {
        assert.equal(
          upstream.url,
          "https://rakshex-api-staging.rakshex.workers.dev/api/v1/control/actions?check=1",
        );
        assert.equal(upstream.method, "POST");
        assert.equal(upstream.headers.get("authorization"), "Bearer caller-key");
        assert.deepEqual(await upstream.json(), { action: "data.read" });
        return Response.json({ code: "DENIED" }, { status: 403 });
      },
    },
  });
  assert.equal(result.status, 403);
});

test("pages and NextAuth routes remain with Next.js", async () => {
  const env = {
    RAKSHEX_API: {
      fetch() {
        throw new Error("Must not forward");
      },
    },
  };
  for (const path of ["/", "/overview", "/api/auth/session", "/api/auth/bridge"]) {
    assert.equal(await routeFrontendApi(new Request("https://frontend.example" + path), env), null);
  }
});

test("missing service binding fails closed", async () => {
  const result = await routeFrontendApi(new Request("https://frontend.example/api/health"), {});
  assert.equal(result.status, 503);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal((await result.json()).code, "BACKEND_NOT_CONFIGURED");
});

test("service outage returns a structured unavailable error", async () => {
  const result = await routeFrontendApi(new Request("https://frontend.example/api/health"), {
    RAKSHEX_API: {
      fetch() {
        throw new Error("private backend detail");
      },
    },
  });
  assert.equal(result.status, 503);
  assert.equal((await result.json()).code, "BACKEND_UNAVAILABLE");
});
