export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { AsyncLocalStorage } = await import("node:async_hooks");
      if (typeof globalThis !== "undefined" && !globalThis.AsyncLocalStorage) {
        (globalThis as any).AsyncLocalStorage = AsyncLocalStorage;
      }
    } catch (e) {
      // ignore
    }
  }
}
