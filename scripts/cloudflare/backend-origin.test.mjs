import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const {
  resolveBackendOrigin,
  LEGACY_RAILWAY_ORIGIN,
} = require("../../apps/web/backend-origin.cjs");

test("existing production routing is unchanged until cutover", () => {
  assert.equal(resolveBackendOrigin({ NODE_ENV: "production" }), LEGACY_RAILWAY_ORIGIN);
  assert.equal(
    resolveBackendOrigin({ RAKSHEX_BACKEND_URL: "https://api.example.org" }),
    "https://api.example.org",
  );
});

test("Cloudflare staging requires a distinct explicit HTTPS backend", () => {
  const staging = {
    RAKSHEX_DEPLOY_TARGET: "cloudflare",
    RAKSHEX_CLOUDFLARE_ENV: "staging",
  };
  assert.equal(
    resolveBackendOrigin({
      ...staging,
      RAKSHEX_BACKEND_URL: "https://rakshex-api-staging.example.com",
    }),
    "https://rakshex-api-staging.example.com",
  );
  for (const overrides of [
    {},
    { RAKSHEX_BACKEND_URL: LEGACY_RAILWAY_ORIGIN },
    { RAKSHEX_BACKEND_URL: "http://rakshex-api-staging.example.com" },
    { RAKSHEX_BACKEND_URL: "https://localhost" },
    { RAKSHEX_BACKEND_URL: "https://user:pass@rakshex-api-staging.example.com" },
    { RAKSHEX_BACKEND_URL: "https://rakshex-api-staging.example.com/api" },
    { RAKSHEX_BACKEND_URL: "https://rakshex-api-staging.example.com?key=1" },
    { RAKSHEX_BACKEND_URL: "https://rakshex-api.example.com" },
  ]) {
    assert.throws(() => resolveBackendOrigin({ ...staging, ...overrides }));
  }
});

test("Next.js rewrites and CSP respect Cloudflare target without Railway", async () => {
  const previous = {
    RAKSHEX_DEPLOY_TARGET: process.env.RAKSHEX_DEPLOY_TARGET,
    RAKSHEX_CLOUDFLARE_ENV: process.env.RAKSHEX_CLOUDFLARE_ENV,
    RAKSHEX_BACKEND_URL: process.env.RAKSHEX_BACKEND_URL,
    NODE_ENV: process.env.NODE_ENV,
  };
  try {
    process.env.RAKSHEX_DEPLOY_TARGET = "cloudflare";
    process.env.RAKSHEX_CLOUDFLARE_ENV = "staging";
    process.env.RAKSHEX_BACKEND_URL = "https://rakshex-api-staging.example.com";
    process.env.NODE_ENV = "production";
    const config = require("../../apps/web/next.config.js");
    const rewrites = await config.rewrites();
    assert.ok(rewrites.length > 0);
    for (const route of rewrites) {
      assert.ok(
        route.destination.startsWith("https://rakshex-api-staging.example.com/"),
        `Unexpected backend rewrite: ${route.destination}`,
      );
      assert.ok(!route.destination.includes("railway.app"));
    }
    const headers = await config.headers();
    const csp = headers
      .flatMap((item) => item.headers)
      .find((item) => item.key === "Content-Security-Policy")?.value;
    assert.ok(csp?.includes("https://rakshex-api-staging.example.com"));
    assert.ok(!csp.includes("railway.app"));
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
