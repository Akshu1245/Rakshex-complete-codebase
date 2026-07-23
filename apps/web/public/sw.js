/* RaksHex offline-first service worker.
 *
 * Strategy:
 *   - Navigations (HTML): network-first, fall back to the cached page, then to
 *     the cached app shell ("/"), then to a minimal offline page.
 *   - Next.js static assets (/_next/static, images, fonts): cache-first
 *     (stale-while-revalidate) — safe because these are content-hashed.
 *   - API / tRPC and any non-GET or cross-origin request: bypass (handled by
 *     the app's React Query cache + offline mutation queue).
 */
const CACHE = "rakshex-offline-v1";
const APP_SHELL = "/";
const OFFLINE_FALLBACK =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline — RaksHex</title><style>body{background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}div{text-align:center;max-width:28rem;padding:2rem}h1{color:#06d6a0}</style></head><body><div><h1>You are offline</h1><p>RaksHex could not reach the network. Previously loaded pages and data are still available; new changes will sync automatically when you reconnect.</p></div></body></html>';

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(APP_SHELL))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon") ||
    url.pathname.startsWith("/favicon") ||
    /\.(?:js|css|woff2?|png|jpg|jpeg|svg|gif|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let cross-origin (fonts/CDN) pass
  if (url.pathname.startsWith("/api/")) return; // API handled by the app layer

  // Navigations → network-first with cached fallbacks.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(CACHE)
            .then((c) => c.put(req, copy))
            .catch(() => undefined);
          return res;
        })
        .catch(async () => {
          const cached = (await caches.match(req)) || (await caches.match(APP_SHELL));
          return (
            cached || new Response(OFFLINE_FALLBACK, { headers: { "Content-Type": "text/html" } })
          );
        }),
    );
    return;
  }

  // Static assets → cache-first, revalidate in background.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches
              .open(CACHE)
              .then((c) => c.put(req, copy))
              .catch(() => undefined);
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});
