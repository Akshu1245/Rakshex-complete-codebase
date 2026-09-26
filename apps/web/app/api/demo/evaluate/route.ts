import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

/** Minimal shape of the RAKSHEX_API service binding (avoids workers-types). */
interface ApiServiceBinding {
  fetch(input: string, init?: RequestInit): Promise<Response>;
}

interface DemoEnv {
  RAKSHEX_API?: ApiServiceBinding;
  DEMO_API_KEY?: string;
  DEMO_WORKSPACE_ID?: string;
}

/**
 * Basic abuse guard for the demo route: it spends a server-held API key and
 * every call appends a signed receipt to the D1 ledger, so an unthrottled
 * endpoint is a ledger-spam / quota-burn vector. Best-effort per-isolate
 * bucket (10 calls / 60s / client IP); the API worker enforces its own
 * per-key limit behind this.
 */
const DEMO_LIMIT = 10;
const DEMO_WINDOW_MS = 60_000;
const demoHits = new Map<string, number[]>();

function demoRateLimited(ip: string): boolean {
  const now = Date.now();
  const fresh = (demoHits.get(ip) ?? []).filter((t) => now - t < DEMO_WINDOW_MS);
  if (fresh.length >= DEMO_LIMIT) {
    demoHits.set(ip, fresh);
    return true;
  }
  fresh.push(now);
  if (demoHits.size > 5000) demoHits.clear();
  demoHits.set(ip, fresh);
  return false;
}

/**
 * POST /api/demo/evaluate — runs the public demo's financial.refund action
 * through the REAL firewall (POST /v1/evaluate via the RAKSHEX_API service
 * binding), then returns the full signed receipt entry so the receipt
 * printer shows genuine hashes and signatures.
 *
 * Requires DEMO_API_KEY + DEMO_WORKSPACE_ID on the web worker (server-side
 * only, never exposed to the browser). Without them this route answers 503
 * `demo_not_configured` and the demo page falls back to clearly-labeled
 * local demo data — never a silent fake.
 */
export async function POST(request: Request) {
  let amount = 0;
  try {
    const body = (await request.json()) as { amount?: unknown };
    amount = Number(body.amount);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount < 1 || amount > 10000) {
    return NextResponse.json({ error: "amount must be between 1 and 10000" }, { status: 400 });
  }

  const clientIp = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (demoRateLimited(clientIp)) {
    return NextResponse.json(
      { ok: false, error: "demo rate limit exceeded, try again shortly" },
      { status: 429, headers: { "retry-after": "60" } },
    );
  }

  let env: DemoEnv;
  try {
    env = (await getCloudflareContext()).env as unknown as DemoEnv;
  } catch {
    return NextResponse.json({ ok: false, error: "API unreachable" }, { status: 502 });
  }
  const { RAKSHEX_API: api, DEMO_API_KEY: demoKey, DEMO_WORKSPACE_ID: demoWorkspace } = env;
  if (!api || !demoKey || !demoWorkspace) {
    return NextResponse.json({ ok: false, error: "demo_not_configured" }, { status: 503 });
  }
  const workspaceId = Number(demoWorkspace);
  if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
    return NextResponse.json({ ok: false, error: "demo_not_configured" }, { status: 503 });
  }

  const evaluateBody = {
    workspaceId,
    requestId: `demo-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
    mode: "enforce",
    action: {
      name: "financial.refund",
      domain: "financial",
      effect: "write",
      parameters: { orderId: "8932" },
      resource: "order:8932",
      amountMinor: Math.round(amount * 100),
      currency: "USD",
      raw: { provider: "demo", operation: "financial.refund" },
    },
    authority: {
      actions: ["financial.refund"],
      maxAmountMinor: 5000,
      currency: "USD",
      purpose: "demo-delegated-refund",
    },
    agentId: "finance-support-prod",
  };

  try {
    const res = await api.fetch("https://rakshex-firewall.internal/v1/evaluate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${demoKey}`,
      },
      body: JSON.stringify(evaluateBody),
    });
    const data = (await res.json().catch(() => null)) as {
      receipt?: { id?: number };
      error?: string;
    } | null;
    if (!res.ok || !data || typeof data.receipt?.id !== "number") {
      return NextResponse.json(
        { ok: false, error: data?.error ?? "evaluate failed" },
        { status: res.status || 502 },
      );
    }
    // Fetch the full signed entry (signature, hashes, payload) for the printer.
    // Receipt endpoints require bearer auth (same key as the evaluate call).
    const full = await api.fetch(
      `https://rakshex-firewall.internal/v1/receipts/${data.receipt.id}`,
      { headers: { authorization: `Bearer ${demoKey}` } },
    );
    const fullData = (await full.json().catch(() => null)) as {
      receipt?: Record<string, unknown>;
    } | null;
    if (!full.ok || !fullData?.receipt) {
      return NextResponse.json({ ok: false, error: "receipt fetch failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, live: true, receipt: fullData.receipt, amount });
  } catch {
    return NextResponse.json({ ok: false, error: "API unreachable" }, { status: 502 });
  }
}
