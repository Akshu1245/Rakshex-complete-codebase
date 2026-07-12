import type { TransportResult, UsageEvent } from "./types.js";

export interface TransportOptions {
  gatewayUrl: string;
  apiKey: string;
  maxRetries: number;
  fetchImpl: typeof fetch;
  failOpen: boolean;
}

/**
 * HTTP transport for batched telemetry.
 * Never includes provider API keys. Uses Rakshex workspace API key only.
 */
export async function sendBatch(
  events: UsageEvent[],
  opts: TransportOptions,
): Promise<TransportResult> {
  if (events.length === 0) return { ok: true };

  const url = `${opts.gatewayUrl.replace(/\/$/, "")}/api/telemetry/ingest`;
  let lastError = "unknown";

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const res = await opts.fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${opts.apiKey}`,
          "x-rakshex-sdk": "agentguard-node",
        },
        body: JSON.stringify({
          events,
          sdkVersion: events[0]?.sdkVersion,
        }),
      });

      if (res.ok) {
        return { ok: true, status: res.status };
      }

      // 4xx (except 429) — do not retry endlessly
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        lastError = `HTTP ${res.status}`;
        if (opts.failOpen) {
          return { ok: false, status: res.status, error: lastError };
        }
        return { ok: false, status: res.status, error: lastError };
      }

      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (attempt < opts.maxRetries) {
      await sleep(backoffMs(attempt));
    }
  }

  return { ok: false, error: lastError };
}

function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 10_000) + Math.floor(Math.random() * 100);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
