/** Poll only while someone can see the result. Never overlap slow requests. */
export function startPolling(task: () => Promise<unknown>, intervalMs = 60000) {
  let stopped = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const available = () => document.visibilityState !== 'hidden' && navigator.onLine !== false;
  const schedule = () => { timer = setTimeout(run, intervalMs); };
  async function run() {
    if (stopped || running) return;
    if (timer) clearTimeout(timer);
    if (!available()) return; // Resume from visibility/online events, without waking timers.
    running = true;
    try { await task(); } catch { /* Request layer displays errors; retry on the next tick. */ }
    finally {
      running = false;
      if (!stopped && available()) schedule();
    }
  }
  function resume() {
    if (timer) clearTimeout(timer);
    if (available()) void run();
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
