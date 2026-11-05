import { thermalRegionBounds } from "./thermalRegion";

/** Tiles per scheduled run: 16 tiles at 10 req/s stays within the short scheduler timeout. */
export const KK7_REFRESH_BATCH = 16;

export function regionTiles() {
  const b = thermalRegionBounds();
  const tiles: { x: number; y: number }[] = [];
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) tiles.push({ x, y });
  return tiles;
}

/** Stateless batch selection: one batch per minute of the refresh day (00:00–02:59 UTC). */
export function refreshBatch(now: Date) {
  const all = regionTiles();
  const index = now.getUTCHours() * 60 + now.getUTCMinutes();
  const batches = Math.ceil(all.length / KK7_REFRESH_BATCH);
  return { index, batches, last: index === batches - 1, tiles: all.slice(index * KK7_REFRESH_BATCH, (index + 1) * KK7_REFRESH_BATCH) };
}

/** Quarter label of a refresh, e.g. "2027-Q1"; also busts device caches. */
export function refreshVersion(now: Date) {
  return `${now.getUTCFullYear()}-Q${Math.floor(now.getUTCMonth() / 3) + 1}`;
}
