#!/usr/bin/env node
/**
 * Smoke test against a running stack (API health + optional web).
 * Usage: pnpm smoke:test
 * Env: API_URL (default http://127.0.0.1:3000), WEB_URL (optional)
 */
const API_URL = (process.env.API_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const WEB_URL = process.env.WEB_URL ? process.env.WEB_URL.replace(/\/$/, "") : null;

async function check(url, label) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(`${label} ${url} → HTTP ${res.status}`);
  }
  return res;
}

async function main() {
  console.log("smoke:test starting…");
  // Prefer /api/health; fall back to /health for older mounts
  let health;
  let healthPath = "/api/health";
  try {
    health = await check(`${API_URL}/api/health`, "health");
  } catch {
    healthPath = "/health";
    health = await check(`${API_URL}/health`, "health");
  }
  const body = await health.json().catch(() => ({}));
  console.log("health:", healthPath, body);

  if (body.status && body.status !== "ok" && body.status !== "degraded") {
    throw new Error(`Unexpected health status: ${body.status}`);
  }
  // Ready endpoint (optional — 404 is not fatal if health passed)
  const ready = await fetch(`${API_URL}/api/health/ready`, {
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (ready) console.log("ready status:", ready.status);

  if (WEB_URL) {
    const web = await check(WEB_URL, "web");
    console.log("web OK", web.status);
  }

  console.log("smoke:test PASSED");
}

main().catch((err) => {
  console.error("smoke:test FAILED:", err.message || err);
  process.exit(1);
});
