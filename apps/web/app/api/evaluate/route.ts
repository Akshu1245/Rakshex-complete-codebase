import { NextResponse } from "next/server";
import { proxyToWorkers } from "../_lib/workers";

export const dynamic = "force-dynamic";

/**
 * POST /api/evaluate — proxies POST /v1/evaluate on the firewall Workers API
 * through the RAKSHEX_API service binding.
 *
 * Body: { apiKey, workspaceId, provider, operation, resource?, environment?,
 *   amountMinor?, currency?, parameters?, mode?, authority?, estimatedCostUsd?,
 *   agentId?, requestId? }
 *
 * The caller supplies their RaksHex API key (per-request, never stored or
 * logged here); it is forwarded as the Bearer <redacted> the Workers route requires.
 * The Workers API derives the semantic action server-side from the raw
 * provider/operation reference, evaluates policy, and appends a signed
 * receipt to the D1 action ledger.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const apiKey = body.apiKey;
  const workspaceId = body.workspaceId;
  const provider = body.provider;
  const operation = body.operation;
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }
  if (!Number.isInteger(workspaceId) || (workspaceId as number) <= 0) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }
  if (
    typeof provider !== "string" ||
    provider.length === 0 ||
    typeof operation !== "string" ||
    operation.length === 0
  ) {
    return NextResponse.json({ error: "provider and operation are required" }, { status: 400 });
  }

  const requestId =
    typeof body.requestId === "string" && body.requestId.length > 0
      ? body.requestId
      : crypto.randomUUID();

  const upstreamBody = {
    workspaceId,
    requestId,
    mode: body.mode,
    action: {
      // Untrusted hint only — the Workers route re-derives name/domain/effect
      // server-side from the raw reference (fail-closed on unknown actions).
      name: `${provider}.${operation}`,
      raw: { provider, operation, requestId, toolName: body.toolName },
      parameters: body.parameters ?? {},
      resource: body.resource,
      environment: body.environment,
      amountMinor: body.amountMinor,
      currency: body.currency,
    },
    authority: body.authority ?? null,
    estimatedCostUsd: body.estimatedCostUsd,
    agentId: body.agentId,
  };

  try {
    return await proxyToWorkers("/v1/evaluate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(upstreamBody),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "API unreachable" }, { status: 502 });
  }
}
