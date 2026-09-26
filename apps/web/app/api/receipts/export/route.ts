import { NextResponse } from "next/server";
import { proxyToWorkers } from "../../_lib/workers";

export const dynamic = "force-dynamic";

/**
 * GET /api/receipts/export?workspaceId=1[&requestId=...] — proxies
 * GET /v1/receipts/export: the signed action-ledger bundle (JSON) for a
 * workspace. Query params are passed through untouched.
 */
export async function GET(req: Request) {
  const search = new URL(req.url).search;
  try {
    // The API requires a workspace-scoped bearer key; forward the caller's.
    const authorization = req.headers.get("authorization");
    return await proxyToWorkers(`/v1/receipts/export${search}`, {
      method: "GET",
      headers: authorization ? { authorization } : undefined,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "API unreachable" }, { status: 502 });
  }
}
