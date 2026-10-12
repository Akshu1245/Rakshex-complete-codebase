/**
 * Cloudflare migration probe only — NOT the RaksHex API or Agent Firewall.
 *
 * Verifies staging resource bindings without accessing user data. No auth,
 * billing, ledger, scanning or gateway action is accepted by this Worker.
 * Remove this probe as business endpoints are migrated and verified.
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

    return new Response(
      JSON.stringify({
        code: "NOT_MIGRATED",
        message: "RaksHex application API is not available in this staging probe.",
      }),
      { status: 501, headers },
    );
  },
};
