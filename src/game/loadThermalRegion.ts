import type { Site } from "./sites";
import type { ThermalMap } from "./loadThermalRaster";
import { thermalRegionBounds } from "./thermalRegion";
import { thermalHeat, thermalTileUrl } from "./thermalRaster";
import { tileResponse } from "@/lib/offline-data";

export interface RegionalTile { x: number; y: number; blob: Blob; image?: ImageBitmap; pending?: boolean }
export interface ThermalProgress { loaded: number; total: number }
const tiles = new Map<string, RegionalTile>();
const heat = new Map<string, Uint8Array>();
const decoded = new Map<string, RegionalTile>();

/** Decode only visible tiles; keep the full region as compressed PNGs and sparse heat bytes. */
export function regionalTileImage(tile: RegionalTile) {
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
  return undefined;
}

/** Fetch the complete rectangle once per session, retaining successful tiles for retries. */
export async function loadThermalRegion(site: Site, onProgress: (p: ThermalProgress) => void): Promise<ThermalMap> {
  const bounds = thermalRegionBounds();
  const jobs: { x: number; y: number }[] = [];
  for (let y = bounds.y0; y <= bounds.y1; y++) for (let x = bounds.x0; x <= bounds.x1; x++) jobs.push({ x, y });
  let loaded = jobs.filter(({ x, y }) => tiles.has(`${x},${y}`)).length;
  const report = () => onProgress({ loaded, total: jobs.length });
  report();
  let next = 0, failed = false;
  await Promise.all(Array.from({ length: 6 }, async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Thermikkarte nicht lesbar");
    while (next < jobs.length && !failed) {
      const job = jobs[next++];
      const key = `${job.x},${job.y}`;
      if (tiles.has(key)) continue;
      try {
        const response = await tileResponse(thermalTileUrl(job.x, job.y, window.location.hostname));
        const blob = await response.blob();
        const image = await createImageBitmap(blob);
        try {
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
          tiles.set(key, { ...job, blob });
          loaded++;
          report();
        } finally { image.close(); }
      } catch (error) { failed = true; throw error; }
    }
  }));
  return {
    regionalTiles: tiles,
    raster: { site, left: bounds.x0 * 256, top: bounds.y0 * 256,
      width: (bounds.x1 - bounds.x0 + 1) * 256, height: (bounds.y1 - bounds.y0 + 1) * 256,
      strength: new Float32Array(0), tiles: heat },
  };
}