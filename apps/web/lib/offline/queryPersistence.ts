"use client";

import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";
import { kvGet, kvSet } from "./idb";

const CACHE_KEY = "reactQueryCache.v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // don't restore caches older than a day

interface PersistedCache {
  savedAt: number;
  state: unknown;
}

/**
 * Hydrate a QueryClient from the IndexedDB-persisted snapshot (read-your-data
 * offline), then subscribe to the cache and persist a debounced snapshot on
 * every change. Returns an unsubscribe function.
 */
export async function initQueryPersistence(queryClient: QueryClient): Promise<() => void> {
  try {
    const persisted = await kvGet<PersistedCache>(CACHE_KEY);
    if (persisted && Date.now() - persisted.savedAt < MAX_AGE_MS) {
      hydrate(queryClient, persisted.state);
    }
  } catch {
    /* ignore restore errors — start with an empty cache */
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const persist = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        // Only persist successful queries to avoid caching error/loading states.
        const state = dehydrate(queryClient, {
          shouldDehydrateQuery: (q) => q.state.status === "success",
        });
        void kvSet<PersistedCache>(CACHE_KEY, { savedAt: Date.now(), state });
      } catch {
        /* ignore persist errors */
      }
    }, 1000);
  };

  const unsub = queryClient.getQueryCache().subscribe(persist);
  return () => {
    if (timer) clearTimeout(timer);
    unsub();
  };
}
