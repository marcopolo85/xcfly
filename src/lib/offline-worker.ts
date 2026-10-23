import { OFFLINE_KEY, OFFLINE_PAGE_CACHE, refuseOfflineWorker } from "./offline-policy";

async function unregisterAppWorker() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.filter((r) => [r.active, r.waiting, r.installing].some((w) => w && new URL(w.scriptURL).pathname === "/sw.js" && new URL(w.scriptURL).origin === location.origin)).map((r) => r.unregister()));
}

/** The only registrar. Never register an app-shell worker inside the editor. */
export async function syncOfflineWorker(enabled = localStorage.getItem(OFFLINE_KEY) === "true"): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  if (refuseOfflineWorker(import.meta.env.PROD, location.hostname, window.self !== window.top, location.search)) {
    await unregisterAppWorker();
    return false;
  }
  if (!enabled) {
    await unregisterAppWorker();
    return false;
  }
  const { registerSW } = await import("virtual:pwa-register");
  await new Promise<void>((resolve, reject) => {
    registerSW({ immediate: true, onRegisteredSW: (_url, registration) => registration ? resolve() : reject(new Error("Offline-App konnte nicht eingerichtet werden.")), onRegisterError: reject });
  });
  await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error("Offline-App nicht bereit. Bitte erneut versuchen.")), 30000))]);
  const response = await fetch("/", { cache: "reload" });
  if (!response.ok) throw new Error("Startseite konnte nicht gespeichert werden.");
  await (await caches.open(OFFLINE_PAGE_CACHE)).put(new URL("/", location.origin).href, response);
  return true;
}