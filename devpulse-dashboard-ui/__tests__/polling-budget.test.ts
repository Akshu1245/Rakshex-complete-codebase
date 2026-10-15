import { startPolling, nextDelay, MAX_BACKOFF_MS } from '../src/lib/polling';
import { apiFetch, getRateLimitedUntil } from '../src/lib/transport';

const fakeResponse = (status: number, body: unknown, headers: Record<string, string> = {}) => ({
  status, ok: status < 400, headers: { get: (k: string) => headers[k] ?? null }, json: async () => body,
});

describe('polling budget protections', () => {
  let stop: (() => void) | undefined;
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(document, 'visibilityState', 'get').mockImplementation(() => 'visible');
  });
  afterEach(() => { stop?.(); stop = undefined; jest.useRealTimers(); jest.restoreAllMocks(); });

  it('backs off exponentially on failure, capped, and honors 429 Retry-After', () => {
    expect(nextDelay(60000, 0)).toBe(60000);
    expect(nextDelay(60000, 1)).toBe(120000);
    expect(nextDelay(60000, 20)).toBe(MAX_BACKOFF_MS);
    expect(nextDelay(60000, 1, { status: 429, retryAfterSeconds: 900 })).toBe(900000);
  });

  it('a failing task is retried with growing gaps, then resets after success', async () => {
    const task = jest.fn().mockRejectedValueOnce(new Error('x')).mockRejectedValueOnce(new Error('x')).mockResolvedValue(undefined);
    stop = startPolling(task);
    await jest.advanceTimersByTimeAsync(0);
    expect(task).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(119999); expect(task).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1); expect(task).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(240000); expect(task).toHaveBeenCalledTimes(3);
    await jest.advanceTimersByTimeAsync(60000); expect(task).toHaveBeenCalledTimes(4);
  });

  it('a 429 from the server pauses all polling until Retry-After', async () => {
    global.fetch = jest.fn().mockResolvedValue(fakeResponse(429, { status: 'error', error: 'Rate limit exceeded', retry_after_seconds: 600 }, { 'Retry-After': '600' })) as unknown as typeof fetch;
    window.addEventListener('devpulse-api-error', () => {});
    await expect(apiFetch('/api/dashboard')).rejects.toMatchObject({ status: 429 });
    expect(getRateLimitedUntil() - Date.now()).toBeGreaterThan(599000);
    const task = jest.fn().mockResolvedValue(undefined);
    stop = startPolling(task);
    await jest.advanceTimersByTimeAsync(599000);
    expect(task).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(2000);
    expect(task).toHaveBeenCalledTimes(1);
  });
});
