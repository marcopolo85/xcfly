import { reliefTileUrl, waterTileUrl, forestTileUrl, riverTileUrl, visibleReliefTiles } from "@/game/swissMap";
import type { Site } from "@/game/sites";

export type MapStyle = "relief" | "landeskarte" | "grau" | "luftbild" | "topo" | "osm" | "dunkel";
export const MAP_STYLES: { v: MapStyle; label: string; credit: string; url: (z: number, x: number, y: number) => string }[] = [
  { v: "relief", label: "Relief", credit: "© swisstopo", url: (z, x, y) => reliefTileUrl(x, y, z) },
  { v: "landeskarte", label: "Landeskarte", credit: "© swisstopo", url: (z, x, y) => `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/${z}/${x}/${y}.jpeg` },
  { v: "grau", label: "Landeskarte grau", credit: "© swisstopo", url: (z, x, y) => `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/${z}/${x}/${y}.jpeg` },
  { v: "luftbild", label: "Luftbild", credit: "© swisstopo SWISSIMAGE", url: (z, x, y) => `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/${z}/${x}/${y}.jpeg` },
  { v: "topo", label: "Topo", credit: "© OpenTopoMap (CC-BY-SA)", url: (z, x, y) => `https://${"abc"[(x + y) % 3]}.tile.opentopomap.org/${z}/${x}/${y}.png` },
  { v: "osm", label: "OSM Farbe", credit: "© OpenStreetMap", url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png` },
  { v: "dunkel", label: "Dunkel", credit: "© OpenStreetMap © CARTO", url: (z, x, y) => `https://${"abcd"[(x + y) % 4]}.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png` },
];
let activeStyle: MapStyle = "relief";
/** Selected base map; read by the animation loops on every frame. */
export function setMapStyle(v: MapStyle) { activeStyle = v; }

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
  const forestColor = theme.getPropertyValue("--map-forest").trim();
  const style = MAP_STYLES.find((m) => m.v === activeStyle) ?? MAP_STYLES[0];
  const relief = style.v === "relief";
  for (const position of visibleReliefTiles(site, x, y, width, height, zoom, dpr)) {
    const tile = tileImage(style.url(Math.min(position.level, style.v === "topo" ? 17 : 18), position.x, position.y), relief ? reliefFilter : "none");
    if (tile.loaded) {
      ctx.drawImage(tile.surface ?? tile.image, position.left, position.top, position.size + 0.5, position.size + 0.5);
      loaded++;
    } else if (tile.failedAt) failed++;
    if (!relief) continue;
    const water = tileImage(waterTileUrl(position.x, position.y, position.level), "none", waterColor);
    if (tile.loaded && water.loaded) {
      ctx.drawImage(water.surface ?? water.image, position.left, position.top, position.size + 0.5, position.size + 0.5);
    }
    const forest = tileImage(forestTileUrl(position.x, position.y, position.level), "none", forestColor);
    if (tile.loaded && forest.loaded) {
      ctx.drawImage(forest.surface ?? forest.image, position.left, position.top, position.size + 0.5, position.size + 0.5);
    }
    const river = tileImage(riverTileUrl(position.x, position.y, position.level), "none", waterColor);
    if (tile.loaded && river.loaded) {
      ctx.drawImage(river.surface ?? river.image, position.left, position.top, position.size + 0.5, position.size + 0.5);
    }
  }
  return { loaded, failed };
}