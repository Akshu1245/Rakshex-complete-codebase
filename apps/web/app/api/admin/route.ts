import { NextResponse } from "next/server";
import { notConnectedHandler } from "../_lib/notConnected";
import { proxyToWorkers } from "../_lib/workers";
import { readWorkerEnv, requireAdminSession } from "./_auth";

export const dynamic = "force-dynamic";

const notConnected = notConnectedHandler("Admin");

/**
 * GET /api/admin?kind=waitlist — CEO-only waitlist listing.
 *
 * 1. NextAuth session must belong to an ADMIN_EMAILS address (401/403).
 * 2. Proxies to the firewall worker's GET /v1/waitlist through the
 *    RAKSHEX_API service binding, authorized with the server-side
 *    ADMIN_API_KEY (never exposed to the browser).
 *
 * Every other kind keeps the honest 501 not_connected: no backend exists
 * for it on the Workers deployment yet.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("kind") !== "waitlist") return notConnected.GET();

  const gate = await requireAdminSession();
  if ("response" in gate) return gate.response;

  const adminKey = await readWorkerEnv("ADMIN_API_KEY");
  if (!adminKey) {
    return NextResponse.json(
      { ok: false, error: "Admin API key is not configured" },
      { status: 500 },
    );
  }

  return proxyToWorkers("/v1/waitlist", {
    headers: { Authorization: `Bearer ${adminKey}` },
  });
}

export const { POST, PUT, PATCH, DELETE } = notConnected;
