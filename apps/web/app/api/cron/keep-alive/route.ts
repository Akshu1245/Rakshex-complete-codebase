import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const backendUrl =
    process.env.NEXT_PUBLIC_TS_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "https://rakshex-backend.onrender.com";

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
