import { NextResponse } from "next/server";
import { proxyToWorkers } from "../../_lib/workers";

export const dynamic = "force-dynamic";

/**
 * POST /api/receipts/verify — proxies POST /v1/receipts/verify (offline
 * WebCrypto verification of a receipt entry or full bundle against a
 * caller-supplied trusted key ring).
 */
export async function POST(req: Request) {
  const raw = await req.text();
  try {
    return await proxyToWorkers("/v1/receipts/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "API unreachable" }, { status: 502 });
  }
}
