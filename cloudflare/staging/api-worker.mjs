/**
 * Cloudflare staging API entry — NOT the complete RaksHex API or Agent Firewall.
 *
 * Verifies staging resource bindings without accessing user data. No auth,
 * billing, ledger, scanning or gateway action is accepted by this Worker.
 * Only verified contract-diff routes are relayed to the staging core.
 */
const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && path === "/__health") {
      const wired = Boolean(env.DB && env.CONFIG_KV && env.JOBS && env.OBJECTS);
      return new Response(
        JSON.stringify({
          service: "rakshex-api-staging-probe",
          state: wired ? "bindings-configured" : "missing-bindings",
          application_api_migrated: false,
        }),
        { status: wired ? 200 : 503, headers },
      );
    }

    if (path.startsWith("/api/v1/control/")) {
      if (typeof env.APP_API?.fetch !== "function") {
        return new Response(JSON.stringify({ code: "APP_UNAVAILABLE" }), { status: 503, headers });
      }
      try {
        return await env.APP_API.fetch(request);
      } catch {
        return new Response(JSON.stringify({ code: "APP_UNAVAILABLE" }), { status: 503, headers });
      }
    }

    const coreRoute =
      (request.method === "GET" &&
        ["/api/health", "/api/health/ready", "/api/v1/capabilities"].includes(path)) ||
      (request.method === "POST" &&
        ["/api/v1/contract-diff", "/api/v1/contract-diff/jobs"].includes(path)) ||
      (request.method === "GET" && /^\/api\/v1\/contract-diff\/jobs\/[0-9a-f-]{36}$/.test(path));
    if (coreRoute) {
      if (typeof env.CORE_API?.fetch !== "function") {
        return new Response(JSON.stringify({ code: "CORE_UNAVAILABLE" }), { status: 503, headers });
      }
      try {
        // Pass through the caller's authorization; never inject an admin key.
        return await env.CORE_API.fetch(request);
      } catch {
        return new Response(JSON.stringify({ code: "CORE_UNAVAILABLE" }), { status: 503, headers });
      }
    }

    return new Response(
      JSON.stringify({
        code: "NOT_MIGRATED",
        message: "RaksHex application API is not available in this staging probe.",
      }),
      { status: 501, headers },
    );
  },
};
