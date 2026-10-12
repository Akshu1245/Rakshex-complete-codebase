import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// The OAuth provider callback cannot be treated as a working RaksHex account
// until the authoritative backend auth.oauthSync/session bridge is migrated.
// Never issue stand-alone NextAuth sessions in a Cloudflare preview.
const handler = NextAuth(authOptions);

function unsupportedOnCloudflare(): Response | null {
  if (process.env.RAKSHEX_DEPLOY_TARGET !== "cloudflare") return null;
  return new Response(
    JSON.stringify({ code: "APP_AUTH_NOT_MIGRATED" }),
    {
      status: 503,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

export async function GET(request: Request, context: unknown) {
  return unsupportedOnCloudflare() ?? handler(request, context);
}

export async function POST(request: Request, context: unknown) {
  return unsupportedOnCloudflare() ?? handler(request, context);
}
