import { MAX_OFFLINE_TILES, OFFLINE_DATA_CACHE, OFFLINE_KEY, OFFLINE_PAGE_CACHE } from "./offline-policy";

export function offlineEnabled() {
  return typeof window !== "undefined" && localStorage.getItem(OFFLINE_KEY) === "true";
}

export async function savedResponse(url: string) {
  if (!offlineEnabled() || !("caches" in window)) return undefined;
  return (await caches.open(OFFLINE_DATA_CACHE)).match(url);
}

export async function saveTile(url: string, signal?: AbortSignal): Promise<Response> {
  if (!("caches" in window)) throw new Error("Dieser Browser erlaubt keine Offline-Speicherung.");
  const cache = await caches.open(OFFLINE_DATA_CACHE);
  const existing = await cache.match(url);
  if (existing) return existing;
  const response = await fetch(url, { mode: "cors", signal: signal ?? null });
  if (!response.ok || response.type === "opaque") throw new Error("Karten- oder Flugdaten nicht erreichbar.");
  if ((await cache.keys()).length >= MAX_OFFLINE_TILES) throw new Error("Offline-Speicher voll. Gespeicherte Daten zuerst löschen.");
  await cache.put(url, response.clone());
  return response;
}

export async function tileResponse(url: string) {
  const saved = await savedResponse(url);
  if (saved) return saved;
  if (offlineEnabled()) {
    try { return await saveTile(url); }
    catch (error) {
      if (!navigator.onLine) throw error;
      // Storage denial must not prevent normal online flight.
    }
  }
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) throw new Error("Kachel nicht erreichbar");
  return response;
}

export async function deleteOfflineData() {
  localStorage.removeItem(OFFLINE_KEY);
  localStorage.removeItem("xcfly-offline-area");
  await Promise.all([OFFLINE_DATA_CACHE, OFFLINE_PAGE_CACHE, "xcfly-assets-v1"].map((name) => caches.delete(name)));
  // Only remove this app's Workbox precache, not unrelated messaging caches.
  const scope = new URL("/", location.origin).href;
  const names = await caches.keys();
  await Promise.all(names.filter((name) => name.startsWith("xcfly-precache-") && name.endsWith(scope)).map((name) => caches.delete(name)));
}