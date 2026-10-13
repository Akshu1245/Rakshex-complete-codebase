export async function routeFrontendApi(request, env) {
  const url = new URL(request.url);
  // NextAuth routes enforce the existing Cloudflare auth migration guard.
  if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/auth/")) {
    if (!env.RAKSHEX_API) {
      return Response.json(
        { code: "BACKEND_NOT_CONFIGURED" },
        {
          status: 503,
          headers: { "cache-control": "no-store" },
        },
      );
    }
    const upstream = new URL(
      url.pathname + url.search,
      "https://rakshex-api-staging.rakshex.workers.dev",
    );
    try {
      return await env.RAKSHEX_API.fetch(new Request(upstream, request));
    } catch {
      return Response.json(
        { code: "BACKEND_UNAVAILABLE" },
        {
          status: 503,
          headers: { "cache-control": "no-store" },
        },
      );
    }
  }
  return null;
}
