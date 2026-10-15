/**
 * Poll only while someone can see the result. Never overlap slow requests.
 * On failure, back off exponentially (capped); on HTTP 429 wait at least the server's Retry-After.
 * A successful run restores the normal interval. Hidden tabs and offline browsers make no requests.
 */
import { getRateLimitedUntil } from './transport';

export const MAX_BACKOFF_MS = 10 * 60 * 1000;

export function nextDelay(intervalMs: number, failures: number, error?: unknown): number {
  if (failures <= 0) return intervalMs;
  let delay = Math.min(intervalMs * 2 ** failures, MAX_BACKOFF_MS);
  const e = error as { status?: number; retryAfterSeconds?: number } | undefined;
  if (e?.status === 429) delay = Math.max(delay, (e.retryAfterSeconds ?? 60) * 1000);
  return delay;
}

export function startPolling(task: () => Promise<unknown>, intervalMs = 60000) {
  let stopped = false;
  let running = false;
  let failures = 0;
  let lastError: unknown;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const available = () => document.visibilityState !== 'hidden' && navigator.onLine !== false;
  const schedule = () => { timer = setTimeout(run, nextDelay(intervalMs, failures, lastError)); };
  async function run() {
    if (stopped || running) return;
    if (timer) clearTimeout(timer);
    if (!available()) return; // Resume from visibility/online events, without waking timers.
    const wait = getRateLimitedUntil() - Date.now();
    if (wait > 0) { timer = setTimeout(run, wait); return; } // honor the server's Retry-After
    running = true;
    try { await task(); failures = 0; lastError = undefined; }
    catch (e) { failures += 1; lastError = e; /* Request layer displays errors. */ }
    finally {
      running = false;
      if (!stopped && available()) schedule();
    }
  }
  function resume() {
    if (timer) clearTimeout(timer);
    if (!available()) return;
    // Becoming visible again should not bypass an active rate-limit backoff.
    if (failures > 0) schedule(); else void run();
  }
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('online', resume);
  window.addEventListener('offline', resume);
  timer = setTimeout(run, 0);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    document.removeEventListener('visibilitychange', resume);
    window.removeEventListener('online', resume);
    window.removeEventListener('offline', resume);
  };
}
