export const OFFLINE_DATA_CACHE = "xcfly-flight-data-v1";
export const OFFLINE_PAGE_CACHE = "xcfly-pages-v1";
export const OFFLINE_KEY = "xcfly-offline-enabled";
export const MAX_OFFLINE_TILES = 2000;

export function refuseOfflineWorker(production: boolean, hostname: string, framed: boolean, search: string) {
  const host = hostname.toLowerCase();
  const label = host.split(".")[0];
  const lovableDomain = /\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(host);
  return !production || framed || new URLSearchParams(search).get("sw") === "off"
    || (lovableDomain && (/^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(label) || /^project--.+-dev$/.test(label)))
    || ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"].some((domain) => host === domain || host.endsWith(`.${domain}`));
}