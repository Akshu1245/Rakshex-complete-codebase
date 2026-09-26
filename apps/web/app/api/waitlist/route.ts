import { proxyToWorkers } from "../_lib/workers";

export const dynamic = "force-dynamic";

/**
 * POST /api/waitlist — proxies the private-beta signup to the firewall
 * Workers API (POST /v1/waitlist), which stores the email in D1 and sends
 * the welcome email. Upstream status/body are preserved so the UI's error
 * handling keeps working.
 */
export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // Fall through: the upstream validator returns the 400.
  }
  return proxyToWorkers("/v1/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}
