/**
 * `fetchWithTimeout` — drop-in replacement for `globalThis.fetch` that
 * aborts the request if the remote host doesn't respond within
 * `timeoutMs` (default 10s).
 *
 * Why this exists:
 *   Node's `fetch` (undici) has *no* default timeout. A misbehaving
 *   third-party API (Razorpay, Slack, Forge, MiniMax, S3, Google Maps,
 *   user-supplied webhook receivers, …) can stall a request indefinitely,
 *   pinning an event-loop-bound socket and starving the rest of the
 *   server. We wrap every outbound network call so a single slow upstream
 *   can't take production down.
 *
 * Usage:
 *   const res = await fetchWithTimeout("https://api.razorpay.com/...", {
 *     method: "POST",
 *     timeoutMs: 8_000,
 *   });
 *
 * Throws:
 *   - `TimeoutError` (subclass of `Error`, name === "TimeoutError") on
 *     deadline exceeded — callers can `instanceof` check or compare on
 *     `err.name === "TimeoutError"`.
 *   - Any other fetch error (DNS, refused connection, etc.) is rethrown
 *     unchanged.
 */

export interface FetchWithTimeoutOptions extends RequestInit {
  /** Hard deadline in ms. Default: 10_000 (10s). */
  timeoutMs?: number;
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

export async function fetchWithTimeout(
  input: string | URL,
  init: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...rest } = init;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // If the caller already passed a signal, link it so either side can
  // abort the request. Lets the call site combine `fetchWithTimeout`
  // with their own cancellation logic without losing the safety net.
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }

  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new TimeoutError(
        `Request to ${input.toString()} timed out after ${timeoutMs}ms`
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
