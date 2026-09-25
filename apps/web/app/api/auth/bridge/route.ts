import { NextRequest, NextResponse } from "next/server";

// Backend origin: explicit env wins on every platform. The Workers deployment
// sets RAKSHEX_API_ORIGIN via wrangler.toml [vars] (see apps/web/wrangler.toml).
// RAKSHEX_CF_BUILD is inlined at build time (next.config.js `env`): in the
// Workers bundle the legacy Railway fallback is compiled out entirely, so a
// misconfigured Workers deployment fails closed instead of proxying to Railway.
const BACKEND_URL = (
  process.env.RAKSHEX_BACKEND_URL ||
  process.env.RAKSHEX_API_ORIGIN ||
  process.env.NEXT_PUBLIC_TS_API_URL ||
  (process.env.RAKSHEX_CF_BUILD ? "" : "https://api-production-0a2b.up.railway.app")
).replace(/\/+$/, "");

export async function POST(request: NextRequest) {
  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: "Backend origin not configured (set RAKSHEX_API_ORIGIN)" },
      { status: 500 },
    );
  }
  const cookieHeader = request.headers.get("cookie") ?? "";
  const csrfToken = request.cookies.get("csrf-token")?.value;

  if (!csrfToken) {
    return NextResponse.json({ error: "Missing CSRF token" }, { status: 400 });
  }

  const upstream = await fetch(`${BACKEND_URL}/api/trpc/auth.oauthSync?batch=1`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
      "x-csrf-token": csrfToken,
      "user-agent": request.headers.get("user-agent") ?? "RaksHex social auth bridge",
    },
    body: JSON.stringify({ 0: { json: null } }),
    cache: "no-store",
  });

  const body = await upstream.text();
  const response = new NextResponse(body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });

  // The backend establishes the authoritative RaksHex app session here.
  // Preserve every Set-Cookie header across the Vercel -> Railway boundary.
  const headersWithCookies = upstream.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = headersWithCookies.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    for (const cookie of setCookies) response.headers.append("set-cookie", cookie);
  } else {
    const combined = upstream.headers.get("set-cookie");
    if (combined) response.headers.append("set-cookie", combined);
  }

  return response;
}
