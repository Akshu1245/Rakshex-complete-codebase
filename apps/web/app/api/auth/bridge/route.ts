import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.RAKSHEX_BACKEND_URL ||
  process.env.NEXT_PUBLIC_TS_API_URL ||
  "https://api-production-0a2b.up.railway.app";

export async function POST(request: NextRequest) {
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
