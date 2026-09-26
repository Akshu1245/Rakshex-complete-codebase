import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/import/execute — persist a previewed import to the firewall API.
 *
 * There is currently NO import endpoint on the Workers API
 * (apps/api/workers/src/routes/ has only evaluate, health, receipts), so
 * this route answers an honest 501 instead of faking a success. The preview
 * route (/api/import/preview) is fully functional and non-persistent.
 */
export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be a JSON object." }, { status: 400 });
  }

  return NextResponse.json(
    {
      error:
        "Server import is not available yet — the firewall API has no import endpoint. " +
        "Use Preview to inspect the collection; nothing was persisted.",
      code: "import_not_implemented",
    },
    { status: 501 },
  );
}
