import { reliefTileUrl, waterTileUrl, visibleReliefTiles } from "@/game/swissMap";
import type { Site } from "@/game/sites";

type Tile = { image: HTMLImageElement; surface?: HTMLCanvasElement; loaded: boolean; failedAt: number };
const cache = new Map<string, Tile>();

function tileImage(url: string, filter = "none", tint = ""): Tile {
  const key = `${url}/${filter}/${tint}`;
  const existing = cache.get(key);
  if (existing && (!existing.failedAt || Date.now() - existing.failedAt < 30000)) {
    // Keep recently visible tiles when the pilot pans into a new area.
    cache.delete(key);
    cache.set(key, existing);
    return existing;
  }
  const image = new Image();
  image.crossOrigin = "anonymous";
  const tile: Tile = { image, loaded: false, failedAt: 0 };
  image.onload = () => {
    if (tint || filter !== "none") {
      const surface = document.createElement("canvas");
      surface.width = image.naturalWidth;
      surface.height = image.naturalHeight;
      const context = surface.getContext("2d");
      if (context) {
        // Apply the expensive relief filter once at native tile resolution,
        // never to the enlarged high-DPI map on every animation frame.
        context.filter = filter;
        context.drawImage(image, 0, 0);
        context.filter = "none";
        if (tint) {
          context.globalCompositeOperation = "source-in";
          context.fillStyle = tint;
          context.fillRect(0, 0, surface.width, surface.height);
        }
        tile.surface = surface;
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
    const tile = tileImage(reliefTileUrl(position.x, position.y, position.level), reliefFilter);
    if (tile.loaded) {
      ctx.drawImage(tile.surface ?? tile.image, position.left, position.top, position.size + 0.5, position.size + 0.5);
      loaded++;
    } else if (tile.failedAt) failed++;
    const water = tileImage(waterTileUrl(position.x, position.y, position.level), "none", waterColor);
    if (tile.loaded && water.loaded) {
      ctx.drawImage(water.surface ?? water.image, position.left, position.top, position.size + 0.5, position.size + 0.5);
    }
  }
  return { loaded, failed };
}