import type { Site } from "./sites";
import type { ThermalMap } from "./loadThermalRaster";
import { thermalRegionBounds } from "./thermalRegion";
import { thermalHeat, bundledThermalTileUrl, THERMAL_ZOOM } from "./thermalRaster";
import { localToPixel } from "./realTerrain";

export interface RegionalTile { x: number; y: number; blob: Blob; preview: ImageBitmap; image?: ImageBitmap | undefined; pending?: boolean }
export interface ThermalProgress { loaded: number; total: number }
const tiles = new Map<string, RegionalTile>();
const heat = new Map<string, Uint8Array>();
const decoded = new Map<string, RegionalTile>();

/** Decode only visible tiles; keep the full region as compressed PNGs and sparse heat bytes. */
export function regionalTileImage(tile: RegionalTile, size = 256) {
  if (size < 64) return tile.preview;
  const key = `${tile.x},${tile.y}`;
  if (tile.image) {
    decoded.delete(key); decoded.set(key, tile);
    return tile.image;
  }
  if (!tile.pending) {
    tile.pending = true;
    createImageBitmap(tile.blob).then((image) => {
      tile.image = image;
      decoded.set(key, tile);
      while (decoded.size > 64) {
        const oldest = decoded.keys().next().value;
        if (oldest === undefined) break;
        const previous = decoded.get(oldest);
        previous?.image?.close();
        if (previous) previous.image = undefined;
        decoded.delete(oldest);
      }
    }).catch(() => {}).finally(() => { tile.pending = false; });
  }
  return tile.preview;
}

const inflight = new Map<string, Promise<void>>();
const failedAt = new Map<string, number>();
let scratch: CanvasRenderingContext2D | null = null;

export const KK7_BUNDLE_CACHE = "xcfly-kk7-bundle-v1";
/** Bundled KK7 tiles: downloaded from this app once per device, then served from Cache Storage. */
async function bundledTile(x: number, y: number): Promise<Response> {
  const url = bundledThermalTileUrl(x, y);
  const cache = typeof caches !== "undefined" ? await caches.open(KK7_BUNDLE_CACHE).catch(() => undefined) : undefined;
  const saved = await cache?.match(url);
  if (saved) return saved;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Thermikkachel nicht erreichbar");
  await cache?.put(url, response.clone()).catch(() => {});
  return response;
}

async function fetchTile(x: number, y: number) {
  const key = `${x},${y}`;
  const response = await bundledTile(x, y);
  const blob = await response.blob();
  const image = await createImageBitmap(blob);
  try {
    if (!scratch) {
      const canvas = document.createElement("canvas");
      canvas.width = 256; canvas.height = 256;
      scratch = canvas.getContext("2d", { willReadFrequently: true });
    }
    const ctx = scratch;
    if (!ctx) throw new Error("Thermikkarte nicht lesbar");
    ctx.clearRect(0, 0, 256, 256);
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, 256, 256).data;
    const strength = new Uint8Array(256 * 256);
    let hasHeat = false;
    for (let i = 0; i < strength.length; i++) {
      strength[i] = Math.round(255 * thermalHeat(pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2], pixels[i * 4 + 3]));
      if (strength[i]) hasHeat = true;
    }
    if (hasHeat) heat.set(key, strength);
    // Thousands of tiny canvases exhaust mobile Chrome's canvas memory; bitmaps are cheap.
    const preview = await createImageBitmap(image, { resizeWidth: 32, resizeHeight: 32 });
    tiles.set(key, { x, y, blob, preview });
  } finally { image.close(); }
}

/** On-demand fetch of one regional tile (deduplicated; failed tiles retry after 10 s). Requests are paced by the KK7 limiter. */
export function requestRegionalTile(x: number, y: number, now = Date.now()): Promise<void> {
  const key = `${x},${y}`;
  const b = thermalRegionBounds();
  if (tiles.has(key) || x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) return Promise.resolve();
  const pending = inflight.get(key);
  if (pending) return pending;
  if (now - (failedAt.get(key) ?? -Infinity) < 10000) return Promise.reject(new Error("Thermikkachel nicht erreichbar"));
  const job = fetchTile(x, y)
    .then(() => { failedAt.delete(key); })
    .catch((error) => { failedAt.set(key, Date.now()); throw error; })
    .finally(() => { inflight.delete(key); });
  inflight.set(key, job);
  return job;
}

/** Tiles under the pilot's surroundings so the simulated lift is available where the pilot flies. */
export function requestTilesAround(site: Site, x: number, y: number, radius = 1) {
  const { px, py } = localToPixel(site, x, y, THERMAL_ZOOM);
  const cx = Math.floor(px / 256), cy = Math.floor(py / 256);
  const jobs: Promise<void>[] = [];
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    jobs.push(requestRegionalTile(cx + dx, cy + dy).catch(() => {}));
  }
  return jobs;
}

/** No bulk download: only tiles around the launch are awaited; others load when they come into view. */
export async function loadThermalRegion(site: Site, onProgress: (p: ThermalProgress) => void): Promise<ThermalMap> {
  const { px, py } = localToPixel(site, 0, 0, THERMAL_ZOOM);
  const cx = Math.floor(px / 256), cy = Math.floor(py / 256);
  const jobs: Promise<void>[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) jobs.push(requestRegionalTile(cx + dx, cy + dy, 0));
  let loaded = 0;
  onProgress({ loaded, total: jobs.length });
  await Promise.all(jobs.map((job) => job.then(() => onProgress({ loaded: ++loaded, total: jobs.length }))));
  const bounds = thermalRegionBounds();
  return {
    regionalTiles: tiles,
    raster: { site, left: bounds.x0 * 256, top: bounds.y0 * 256,
      width: (bounds.x1 - bounds.x0 + 1) * 256, height: (bounds.y1 - bounds.y0 + 1) * 256,
      strength: new Float32Array(0), tiles: heat },
  };
}
