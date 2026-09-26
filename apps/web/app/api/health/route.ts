import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

/** Minimal shape of the RAKSHEX_API service binding (avoids workers-types). */
interface ApiServiceBinding {
  fetch(input: string, init?: RequestInit): Promise<Response>;
}

/**
 * GET /api/health — proxies the firewall API worker's /v1/health through the
 * RAKSHEX_API service binding.
 *
 * A service binding (not a public-URL fetch, not a next.config.js external
 * rewrite): Cloudflare blocks Worker -> Worker fetches over public
 * *.workers.dev URLs on the same account with HTTP 404 "error code: 1042",
 * and the adapter does not honor external-URL rewrites either.
 */
export async function GET() {
  try {
    const { env } = await getCloudflareContext();
    const api = (env as unknown as { RAKSHEX_API?: ApiServiceBinding }).RAKSHEX_API;
    if (!api) {
      return NextResponse.json(
        { ok: false, error: "RAKSHEX_API service binding not configured" },
        { status: 503 },
      );
    }
    // Hostname is ignored by service bindings; path + method route to rakshex-firewall.
    const res = await api.fetch("https://rakshex-firewall.internal/v1/health");
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "API unreachable" }, { status: 502 });
  }
}
