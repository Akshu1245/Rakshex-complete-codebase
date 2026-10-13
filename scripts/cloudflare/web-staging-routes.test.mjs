import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { resolveBackendOrigin } = require("../../apps/web/backend-origin.cjs");
const bridge = fs.readFileSync(
  new URL("../../apps/web/app/api/auth/bridge/route.ts", import.meta.url),
  "utf8",
);
const oauth = fs.readFileSync(
  new URL("../../apps/web/app/api/auth/[...nextauth]/route.ts", import.meta.url),
  "utf8",
);
const cfg = fs.readFileSync(new URL("../../apps/web/wrangler.toml", import.meta.url), "utf8");

test("staging Worker routes to Cloudflare and never Railway", () => {
  const env = {
    RAKSHEX_DEPLOY_TARGET: "cloudflare",
    RAKSHEX_CLOUDFLARE_ENV: "staging",
    RAKSHEX_BACKEND_URL: "https://rakshex-api-staging.rakshex.workers.dev",
  };
  assert.equal(resolveBackendOrigin(env), env.RAKSHEX_BACKEND_URL);
  assert.throws(() =>
    resolveBackendOrigin({
      ...env,
      RAKSHEX_BACKEND_URL: "https://api-production-0a2b.up.railway.app",
    }),
  );
  assert.match(cfg, /name = "rakshex-frontend"/);
  assert.doesNotMatch(cfg, /rakshex-firewall|railway\.app|zone_id|\[\[routes\]\]/);
});

test("Cloudflare OAuth bridge refuses requests before reading cookies", () => {
  const gate = bridge.indexOf('process.env.RAKSHEX_DEPLOY_TARGET === "cloudflare"');
  const cookie = bridge.indexOf('request.headers.get("cookie")');
  assert.ok(gate >= 0 && cookie > gate);
  assert.match(bridge, /status: 503/);
  assert.match(bridge, /cache-control/);
  assert.match(bridge, /process\.env\.NEXT_PUBLIC_TS_API_URL/);
  assert.doesNotMatch(bridge, /railway\.app/);
});

test("NextAuth routes cannot create false app sessions on Cloudflare", () => {
  assert.match(oauth, /RAKSHEX_DEPLOY_TARGET/);
  assert.match(oauth, /APP_AUTH_NOT_MIGRATED/);
  assert.match(oauth, /status: 503/);
  assert.match(oauth, /export async function (GET|POST)/);
});

test("production RaksHex Worker is never overwritten by staging config", () => {
  assert.match(cfg, /workers_dev = true/);
  assert.match(cfg, /nodejs_compat/);
  assert.doesNotMatch(cfg, /name = "rakshex-web"/);
});
