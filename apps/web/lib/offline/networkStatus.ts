"use client";

import { useEffect, useState } from "react";

/** SSR-safe current online state. */
export function getOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

/**
 * Reactive online/offline status. Updates on the browser `online`/`offline`
 * events. Defaults to `true` during SSR / first paint to avoid a flash.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(true);

  useEffect(() => {
    setOnline(getOnline());
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return online;
}
