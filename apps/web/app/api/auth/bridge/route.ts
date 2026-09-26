import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/bridge — social-auth session sync.
 *
 * Previously proxied `${BACKEND_URL}/api/trpc/auth.oauthSync` (the Express
 * backend), which does not exist on the Cloudflare Workers deployment, and
 * the Workers firewall API exposes no /v1 auth equivalent. Answers 501
 * `not_connected` instead of 404ing: the auth stream owns wiring this to a
 * real session backend.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      code: "not_connected",
      error: "not_connected",
      resource: "Auth session bridge",
      message:
        "Social-auth session sync is not connected on this deployment: there is no backend to sync the session with. Nothing here is mocked.",
    },
    { status: 501 },
  );
}
