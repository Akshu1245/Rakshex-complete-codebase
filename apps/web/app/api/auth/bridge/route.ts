import { NextRequest, NextResponse } from "next/server";
import { resolveBackendOrigin } from "../../../../backend-origin.cjs";

/**
 * A NextAuth OAuth login is NOT an authoritative RaksHex app session.
 * Until the legacy backend auth.oauthSync and its signed app cookies have
 * security parity on Cloudflare, reject the bridge before reading/forwarding
 * cookies. This prevents Cloudflare preview logins from forwarding user
 * cookies to stopped Railway infrastructure or a partial staging backend.
 */
export async function POST(request: NextRequest) {
  if (process.env.RAKSHEX_DEPLOY_TARGET === "cloudflare") {
    return NextResponse.json(
      { error: "Cloudflare session bridge not yet migrated" },
      {
        status: 503,
        headers: { "cache-control": "no-store" },
      },
    );
  }

  const BACKEND_URL = resolveBackendOrigin(process.env);
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
