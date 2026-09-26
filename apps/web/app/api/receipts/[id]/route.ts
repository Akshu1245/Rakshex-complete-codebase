import { NextResponse } from "next/server";
import { proxyToWorkers } from "../../_lib/workers";

export const dynamic = "force-dynamic";

/** GET /api/receipts/:id — proxies GET /v1/receipts/:id (one signed entry). */
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid receipt id" }, { status: 400 });
  }
  try {
    // The API requires a workspace-scoped bearer key; forward the caller's.
    const authorization = req.headers.get("authorization");
    return await proxyToWorkers(`/v1/receipts/${id}`, {
      method: "GET",
      headers: authorization ? { authorization } : undefined,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "API unreachable" }, { status: 502 });
  }
}
