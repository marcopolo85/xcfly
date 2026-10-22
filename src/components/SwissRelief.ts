import { reliefTileUrl, visibleReliefTiles } from "@/game/swissMap";
import type { Site } from "@/game/sites";

type Tile = { image: HTMLImageElement; loaded: boolean; failedAt: number };
const cache = new Map<string, Tile>();

function tileImage(x: number, y: number): Tile {
  const key = `${x}/${y}`;
  const existing = cache.get(key);
  if (existing && (!existing.failedAt || Date.now() - existing.failedAt < 30000)) return existing;
  const image = new Image();
  image.crossOrigin = "anonymous";
  const tile: Tile = { image, loaded: false, failedAt: 0 };
  image.onload = () => { tile.loaded = true; };
  image.onerror = () => { tile.failedAt = Date.now(); };
  image.src = reliefTileUrl(x, y);
  cache.set(key, tile);
  if (cache.size > 128) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return tile;
}

/** Browser-only tile rendering; the flight engine remains independent of the map. */
export function drawSwissRelief(ctx: CanvasRenderingContext2D, site: Site, x: number, y: number, width: number, height: number, zoom: number) {
  let loaded = 0, failed = 0;
  for (const position of visibleReliefTiles(site, x, y, width, height, zoom)) {
    const tile = tileImage(position.x, position.y);
    if (tile.loaded) {
      ctx.drawImage(tile.image, position.left, position.top, position.size + 0.5, position.size + 0.5);
      loaded++;
    } else if (tile.failedAt) failed++;
  }
  return { loaded, failed };
}