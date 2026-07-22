/**
 * Stable per-device identifier used as change-tracking metadata on offline
 * operations (so the server / conflict resolver can attribute the origin of a
 * change). Persisted in localStorage; regenerated only if cleared.
 */
const KEY = "rakshex.deviceId";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "unknown-device";
  }
}
