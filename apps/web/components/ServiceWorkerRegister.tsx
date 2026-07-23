"use client";

import { useEffect } from "react";

/**
 * Registers the offline-first service worker. Registered only in production
 * builds — in dev the SW would cache Next.js HMR chunks and break fast refresh.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* SW registration is best-effort; app still works without it */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
