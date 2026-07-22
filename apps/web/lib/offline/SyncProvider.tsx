"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getDeviceId } from "./deviceId";
import { createIdbQueueStorage, hasIDB } from "./idb";
import { initQueryPersistence } from "./queryPersistence";
import { useOnlineStatus } from "./networkStatus";
import { createMemoryQueueStorage, SyncQueue, type OpProcessor, type QueuedOp } from "./syncQueue";

interface SyncContextValue {
  online: boolean;
  pendingCount: number;
  deviceId: string;
  /** Enqueue an operation to run now (if online) or later (if offline). */
  enqueue: <T>(type: string, payload: T) => Promise<QueuedOp<T>>;
  /** Force a flush of the queue. */
  syncNow: () => Promise<void>;
  /** Register the processor that knows how to replay each op type. */
  registerProcessor: (processor: OpProcessor) => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const deviceId = useMemo(() => getDeviceId(), []);

  const queueRef = useRef<SyncQueue | null>(null);
  const processorRef = useRef<OpProcessor>(async () => {
    throw new Error("No sync processor registered");
  });

  if (!queueRef.current) {
    queueRef.current = new SyncQueue(
      hasIDB() ? createIdbQueueStorage() : createMemoryQueueStorage(),
    );
  }

  const refreshCount = useCallback(async () => {
    const q = queueRef.current;
    if (!q) return;
    setPendingCount(await q.count());
  }, []);

  const syncNow = useCallback(async () => {
    const q = queueRef.current;
    if (!q || !getNavigatorOnline()) return;
    await q.flush(processorRef.current);
    await refreshCount();
  }, [refreshCount]);

  const enqueue = useCallback(
    async <T,>(type: string, payload: T) => {
      const q = queueRef.current!;
      const op = await q.enqueue<T>(type, payload, { deviceId });
      await refreshCount();
      // Best-effort immediate flush when online.
      if (getNavigatorOnline()) void syncNow();
      return op;
    },
    [deviceId, refreshCount, syncNow],
  );

  const registerProcessor = useCallback((processor: OpProcessor) => {
    processorRef.current = processor;
  }, []);

  // Set up React Query cache persistence (read-your-data offline).
  useEffect(() => {
    let dispose: (() => void) | undefined;
    void initQueryPersistence(queryClient).then((d) => {
      dispose = d;
    });
    return () => dispose?.();
  }, [queryClient]);

  // Flush the queue whenever connectivity is (re)gained, and on mount.
  useEffect(() => {
    void refreshCount();
    if (online) void syncNow();
  }, [online, refreshCount, syncNow]);

  const value: SyncContextValue = {
    online,
    pendingCount,
    deviceId,
    enqueue,
    syncNow,
    registerProcessor,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    // SSR / outside-provider fallback: no-op so consumers don't crash.
    return {
      online: true,
      pendingCount: 0,
      deviceId: "server",
      enqueue: async () => {
        throw new Error("SyncProvider not mounted");
      },
      syncNow: async () => {},
      registerProcessor: () => {},
    };
  }
  return ctx;
}

function getNavigatorOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}
