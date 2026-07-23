/**
 * Minimal IndexedDB key/value helper (no dependencies).
 *
 * One database, two object stores:
 *   - "kv"        → arbitrary key/value blobs (React Query cache snapshot)
 *   - "syncQueue" → offline mutation queue entries (keyed by op.id)
 *
 * All calls are SSR/no-IDB safe: if IndexedDB is unavailable they resolve to
 * no-ops / empty so the app degrades gracefully.
 */
import type { QueueStorage, QueuedOp } from "./syncQueue";

const DB_NAME = "rakshex-offline";
const DB_VERSION = 1;
const KV_STORE = "kv";
const QUEUE_STORE = "syncQueue";

function hasIDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase | null> {
  if (!hasIDB()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE);
      if (!db.objectStoreNames.contains(QUEUE_STORE))
        db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        const t = db.transaction(storeName, mode);
        const req = fn(t.objectStore(storeName));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => resolve(null);
      }),
  );
}

export async function kvGet<T>(key: string): Promise<T | null> {
  return (await tx<T>(KV_STORE, "readonly", (s) => s.get(key) as IDBRequest<T>)) ?? null;
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  await tx(KV_STORE, "readwrite", (s) => s.put(value as unknown as never, key));
}

export async function kvDel(key: string): Promise<void> {
  await tx(KV_STORE, "readwrite", (s) => s.delete(key));
}

/** IndexedDB-backed implementation of the SyncQueue storage contract. */
export function createIdbQueueStorage(): QueueStorage {
  return {
    async getAll() {
      const all = await tx<QueuedOp[]>(
        QUEUE_STORE,
        "readonly",
        (s) => s.getAll() as IDBRequest<QueuedOp[]>,
      );
      return all ?? [];
    },
    async put(op) {
      await tx(QUEUE_STORE, "readwrite", (s) => s.put(op));
    },
    async remove(id) {
      await tx(QUEUE_STORE, "readwrite", (s) => s.delete(id));
    },
  };
}

export { hasIDB };
