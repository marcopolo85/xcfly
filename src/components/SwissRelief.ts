import { reliefTileUrl, waterTileUrl, visibleReliefTiles } from "@/game/swissMap";
import type { Site } from "@/game/sites";

type Tile = { image: HTMLImageElement; tinted?: HTMLCanvasElement; loaded: boolean; failedAt: number };
const cache = new Map<string, Tile>();

function tileImage(url: string, tint?: string): Tile {
  const key = `${url}/${tint ?? ""}`;
  const existing = cache.get(key);
  if (existing && (!existing.failedAt || Date.now() - existing.failedAt < 30000)) return existing;
  const image = new Image();
  image.crossOrigin = "anonymous";
  const tile: Tile = { image, loaded: false, failedAt: 0 };
  image.onload = () => {
    if (tint) {
      const surface = document.createElement("canvas");
      surface.width = image.naturalWidth;
      surface.height = image.naturalHeight;
      const context = surface.getContext("2d");
      if (context) {
        context.drawImage(image, 0, 0);
        context.globalCompositeOperation = "source-in";
        context.fillStyle = tint;
        context.fillRect(0, 0, surface.width, surface.height);
        tile.tinted = surface;
      }
    }
    tile.loaded = true;
  };
  image.onerror = () => { tile.failedAt = Date.now(); };
  image.src = url;
  cache.set(key, tile);
  if (cache.size > 256) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return tile;
}

/** Browser-only tile rendering; the flight engine remains independent of the map. */
export function drawSwissRelief(ctx: CanvasRenderingContext2D, site: Site, x: number, y: number, width: number, height: number, zoom: number, dpr = 1) {
  let loaded = 0, failed = 0;
  const theme = getComputedStyle(ctx.canvas);
  const reliefFilter = theme.getPropertyValue("--map-relief-filter").trim() || "none";
  const waterColor = theme.getPropertyValue("--map-water").trim();
  for (const position of visibleReliefTiles(site, x, y, width, height, zoom, dpr)) {
    const tile = tileImage(reliefTileUrl(position.x, position.y, position.level));
    if (tile.loaded) {
      ctx.save();
      ctx.filter = reliefFilter;
      ctx.drawImage(tile.image, position.left, position.top, position.size + 0.5, position.size + 0.5);
      ctx.restore();
      loaded++;
    } else if (tile.failedAt) failed++;
    const water = tileImage(waterTileUrl(position.x, position.y, position.level), waterColor);
    if (tile.loaded && water.loaded) {
      ctx.drawImage(water.tinted ?? water.image, position.left, position.top, position.size + 0.5, position.size + 0.5);
    }
  }
  return { loaded, failed };
}