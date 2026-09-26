import { NextResponse } from "next/server";

/**
 * Honest 501 handlers for /api/* proxy routes whose data has NO equivalent
 * on the Workers firewall API (/v1/*) yet.
 *
 * The web app used to call these datasets through tRPC
 * (`${origin}/api/trpc`), which 404s on the Cloudflare Workers deployment.
 * Rather than fake numbers, each route answers 501 `not_connected` so the UI
 * can render an honest "not connected yet" empty state. When the Workers API
 * grows the endpoint, replace the 501 with a proxyToWorkers() call.
 */
export function notConnectedHandler(resource: string) {
  const handler = () =>
    NextResponse.json(
      {
        ok: false,
        code: "not_connected",
        error: "not_connected",
        resource,
        message:
          `${resource} is not connected on this deployment: the Workers firewall API ` +
          `does not expose this data yet. Nothing here is mocked — connect the backend to enable it.`,
      },
      { status: 501 },
    );
  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    PATCH: handler,
    DELETE: handler,
  };
}
