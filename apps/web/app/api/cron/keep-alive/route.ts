import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // Vercel-legacy keep-alive ping. Env-first so a Workers deployment never
  // touches the stale Render fallback; on Workers this route is a no-op
  // (the API worker owns its own cron triggers — see PORT_NOTES.md).
  // RAKSHEX_CF_BUILD is inlined at build time: the Render fallback is compiled
  // out of the Workers bundle entirely (fail closed, not silent wrong-backend).
  const backendUrl = (
    process.env.RAKSHEX_BACKEND_URL ||
    process.env.RAKSHEX_API_ORIGIN ||
    process.env.NEXT_PUBLIC_TS_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.RAKSHEX_CF_BUILD ? "" : "https://rakshex-backend.onrender.com")
  ).replace(/\/+$/, "");
  if (!backendUrl) {
    return NextResponse.json(
      { success: false, error: "Backend origin not configured (set RAKSHEX_API_ORIGIN)" },
      { status: 500 },
    );
  }

  const target = `${backendUrl.replace(/\/$/, "")}/api/health/live`;

  try {
    const res = await fetch(target, {
      cache: "no-store",
      headers: {
        "User-Agent": "RaksHex-Vercel-Cron-KeepAlive/1.0",
      },
    });

    const status = res.status;
    const body = await res.text();

    console.log(`[Vercel Cron Keep-Alive] Pinged ${target} -> Status ${status}`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      target,
      backendStatus: status,
      backendResponse: body,
    });
  } catch (error: any) {
    console.error(`[Vercel Cron Keep-Alive] Ping error for ${target}:`, error);

    return NextResponse.json(
      {
        success: false,
        timestamp: new Date().toISOString(),
        target,
        error: error?.message || String(error),
      },
      { status: 500 },
    );
  }
}
