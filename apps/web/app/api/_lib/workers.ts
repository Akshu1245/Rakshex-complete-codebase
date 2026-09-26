import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Minimal shape of the RAKSHEX_API service binding (avoids workers-types). */
export interface ApiServiceBinding {
  fetch(input: string, init?: RequestInit): Promise<Response>;
}

/**
 * Internal origin for service-binding calls. The hostname is ignored by
 * service bindings; only path + method route to the rakshex-firewall worker.
 * (Same pattern as app/api/health/route.ts: Worker -> Worker fetches over
 * public *.workers.dev URLs fail on the same account, so we never use them.)
 */
const INTERNAL_ORIGIN = "https://rakshex-firewall.internal";

export async function getApiBinding(): Promise<ApiServiceBinding | null> {
  try {
    const { env } = await getCloudflareContext();
    return (env as unknown as { RAKSHEX_API?: ApiServiceBinding }).RAKSHEX_API ?? null;
  } catch {
    return null;
  }
}

export function bindingMissing(): Response {
  return Response.json(
    {
      ok: false,
      code: "binding_missing",
      error: "RAKSHEX_API service binding not configured",
    },
    { status: 503 },
  );
}

/**
 * Proxy a request to the firewall Workers API through the RAKSHEX_API
 * service binding. Preserves the upstream status code and JSON body.
 */
export async function proxyToWorkers(path: string, init?: RequestInit): Promise<Response> {
  const api = await getApiBinding();
  if (!api) return bindingMissing();
  const res = await api.fetch(`${INTERNAL_ORIGIN}${path}`, init);
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}
