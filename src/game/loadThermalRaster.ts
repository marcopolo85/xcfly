import { EXTENT } from "./terrain";
import { localToPixel } from "./realTerrain";
import { thermalHeat, thermalTileUrl, THERMAL_ZOOM, type ThermalRaster } from "./thermalRaster";
import type { Site } from "./sites";
import { loadRasterTile } from "./rasterTileCache";

export interface ThermalMap { raster: ThermalRaster; image: HTMLCanvasElement }
const cache = new Map<string, ThermalMap>();

const loadTile = loadRasterTile;

/** Load the actual July / All day raster once; never invent missing sources. */
export async function loadThermalRaster(site: Site, centerX = 0, centerY = 0): Promise<ThermalMap> {
  const key = `${site.id}:${centerX}:${centerY}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const a = localToPixel(site, centerX - EXTENT, centerY + EXTENT, THERMAL_ZOOM);
  const b = localToPixel(site, centerX + EXTENT, centerY - EXTENT, THERMAL_ZOOM);
  const tx0 = Math.floor(a.px / 256), ty0 = Math.floor(a.py / 256);
  const tx1 = Math.floor(b.px / 256), ty1 = Math.floor(b.py / 256);
  const image = document.createElement("canvas");
  image.width = (tx1 - tx0 + 1) * 256;
  image.height = (ty1 - ty0 + 1) * 256;
  const ctx = image.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Thermikkarte nicht lesbar");
  const jobs: { x: number; y: number }[] = [];
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) jobs.push({ x, y });
  // Limit parallel traffic to the public provider.
  let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const tile = await loadTile(thermalTileUrl(job.x, job.y, window.location.hostname));
      ctx.drawImage(tile, (job.x - tx0) * 256, (job.y - ty0) * 256);
    }
  }));
  const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
  const strength = new Float32Array(image.width * image.height);
  for (let i = 0; i < strength.length; i++) strength[i] = thermalHeat(pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2], pixels[i * 4 + 3]);
  const map = { image, raster: { site, left: tx0 * 256, top: ty0 * 256, width: image.width, height: image.height, strength } };
  cache.set(key, map);
  if (cache.size > 2) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return map;
}