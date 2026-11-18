import { reliefTileUrl, waterTileUrl, forestTileUrl, riverTileUrl, visibleReliefTiles } from "@/game/swissMap";
import type { Site } from "@/game/sites";
import { offlineEnabled, tileResponse } from "@/lib/offline-data";
import { mapOrigin } from "@/game/swissMap";
import { PEAKS, tintTerrarium } from "@/game/xcRelief";

export type MapStyle = "relief" | "xcrelief" | "landeskarte" | "grau" | "luftbild" | "topo" | "osm";
export const MAP_STYLES: { v: MapStyle; label: string; credit: string; url: (z: number, x: number, y: number) => string; fallback?: (z: number, x: number, y: number) => string }[] = [
  // swisstopo serves data only around Switzerland; `fallback` fills transparent tile areas worldwide.
  { v: "relief", label: "Relief", credit: "© swisstopo · OpenTopoMap (CC-BY-SA)", url: (z, x, y) => reliefTileUrl(x, y, z), fallback: (z, x, y) => `https://${"abc"[(x + y) % 3]}.tile.opentopomap.org/${z}/${x}/${y}.png` },
  { v: "xcrelief", label: "XC Relief", credit: "© swisstopo · Höhen: Mapzen Terrarium (AWS)", url: (z, x, y) => reliefTileUrl(x, y, z) },
  { v: "landeskarte", label: "Landeskarte", credit: "© swisstopo · © OpenStreetMap", url: (z, x, y) => `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/${z}/${x}/${y}.jpeg`, fallback: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png` },
  { v: "grau", label: "Landeskarte grau", credit: "© swisstopo · © OpenStreetMap © CARTO", url: (z, x, y) => `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-grau/default/current/3857/${z}/${x}/${y}.jpeg`, fallback: (z, x, y) => `https://${"abcd"[(x + y) % 4]}.basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png` },
  { v: "luftbild", label: "Luftbild", credit: "© swisstopo SWISSIMAGE · © Esri", url: (z, x, y) => `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/${z}/${x}/${y}.jpeg`, fallback: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}.png` },
  { v: "topo", label: "Topo", credit: "© OpenTopoMap (CC-BY-SA)", url: (z, x, y) => `https://${"abc"[(x + y) % 3]}.tile.opentopomap.org/${z}/${x}/${y}.png` },
  { v: "osm", label: "OSM Farbe", credit: "© OpenStreetMap", url: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png` },
];
let activeStyle: MapStyle = "relief";
/** Selected base map; read by the animation loops on every frame. */
export function setMapStyle(v: MapStyle) { activeStyle = v; }
export function getMapStyle(): MapStyle {
  const saved = typeof window === "undefined" ? null : window.localStorage.getItem("mapStyle");
  return MAP_STYLES.find((style) => style.v === saved)?.v ?? activeStyle;
}

type Tile = { image: HTMLImageElement; surface?: HTMLCanvasElement; loaded: boolean; failedAt: number };
const cache = new Map<string, Tile>();
const composites = new Map<string, { sources: CanvasImageSource[]; surface: HTMLCanvasElement }>();

/** Rebuild only when a layer arrives or its processed surface changes. */
function composedTile(key: string, layers: Tile[]) {
  const sources = layers.filter((layer) => layer.loaded).map((layer) => layer.surface ?? layer.image);
  const existing = composites.get(key);
  if (existing && existing.sources.length === sources.length && sources.every((source, i) => source === existing.sources[i])) return existing.surface;
  const base = layers[0];
  if (!base?.loaded) return null;
  const surface = existing?.surface ?? document.createElement("canvas");
  surface.width = base.image.naturalWidth;
  surface.height = base.image.naturalHeight;
  const context = surface.getContext("2d");
  if (!context) return null;
  for (const source of sources) context.drawImage(source, 0, 0);
  composites.delete(key);
  composites.set(key, { sources, surface });
  if (composites.size > 64) {
    const oldest = composites.keys().next().value;
    if (oldest !== undefined) { const old = composites.get(oldest); composites.delete(oldest); if (old) { old.surface.width = 0; old.surface.height = 0; } }
  }
  return surface;
}

function loadImageElement(url: string, onready: (image: HTMLImageElement) => void, onfail: () => void) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  if (offlineEnabled()) {
    tileResponse(url).then((r) => r.blob()).then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      image.onload = () => { URL.revokeObjectURL(objectUrl); onready(image); };
      image.src = objectUrl;
    }).catch(onfail);
  } else {
    image.onload = () => onready(image);
    image.onerror = onfail;
    image.src = url;
  }
}

/** swisstopo serves data only around Switzerland: fill transparent tile areas once from a global underlay. */
function mergeUnderlay(tile: Tile, surface: HTMLCanvasElement, underlayUrl: string, filter: string) {
  const context = surface.getContext("2d", { willReadFrequently: true });
  if (!context || typeof context.getImageData !== "function") return;
  const data = context.getImageData(0, 0, surface.width, surface.height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) {
      loadImageElement(underlayUrl, (under) => {
        const merged = document.createElement("canvas");
        merged.width = surface.width;
        merged.height = surface.height;
        const mergedContext = merged.getContext("2d");
        if (mergedContext) {
          mergedContext.filter = filter;
          mergedContext.drawImage(under, 0, 0);
          mergedContext.filter = "none";
          mergedContext.drawImage(surface, 0, 0);
          tile.surface = merged;
        }
      }, () => { /* keep the swisstopo content; uncovered areas stay transparent */ });
      return;
    }
  }
}

function tileImage(url: string, filter = "none", tint = "", underlayUrl?: string): Tile {
  const key = `${url}/${filter}/${tint}`;
  const existing = cache.get(key);
  if (existing && (!existing.failedAt || Date.now() - existing.failedAt < 30000)) {
    // Keep recently visible tiles when the pilot pans into a new area.
    cache.delete(key);
    cache.set(key, existing);
    return existing;
  }
  const tile: Tile = { image: null as unknown as HTMLImageElement, loaded: false, failedAt: 0 };
  loadImageElement(url, (image) => {
    tile.image = image;
    if (tint || filter !== "none" || underlayUrl) {
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
    if (underlayUrl && tile.surface) mergeUnderlay(tile, tile.surface, underlayUrl, filter);
    tile.loaded = true;
  }, () => { tile.failedAt = Date.now(); });
  cache.set(key, tile);
  if (cache.size > 160) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      // Free GPU/bitmap memory immediately; mobile Chrome crashes when it piles up on long flights.
      const old = cache.get(oldest); cache.delete(oldest);
      if (old?.surface) { old.surface.width = 0; old.surface.height = 0; }
      if (old?.image) old.image.src = "";
    }
  }
  return tile;
}

const XC_WATER = "rgba(70, 140, 215, 0.9)";
const XC_CACHE = "xcfly-xcrelief-v1";
/** Hypsometric colours are smooth: DEM level 12 is enough, only the hillshade stays sharp. */
const XC_DEM_MAX_LEVEL = 12;
const xcCache = new Map<string, Tile>();
// Pixel tinting is spread over frames so several arriving tiles never block the animation.
const xcQueue: (() => void)[] = [];
let xcPumping = false;
function pumpXc() {
  if (xcPumping) return;
  xcPumping = true;
  const step = () => {
    const end = performance.now() + 6;
    while (xcQueue.length && performance.now() < end) xcQueue.shift()!();
    if (xcQueue.length) requestAnimationFrame(step); else xcPumping = false;
  };
  requestAnimationFrame(step);
}
function persistXc(key: string, surface: HTMLCanvasElement) {
  if (typeof caches === "undefined") return;
  surface.toBlob((blob) => {
    if (!blob) return;
    caches.open(XC_CACHE).then((c) => c.put(`/xcrelief/${key}`, new Response(blob, { headers: { "Content-Type": blob.type } }))).catch(() => {});
  }, "image/webp", 0.9);
}
function computeXc(tile: Tile, key: string, level: number, x: number, y: number) {
  const dz = Math.max(0, level - XC_DEM_MAX_LEVEL), dl = level - dz;
  const demUrl = `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${dl}/${x >> dz}/${y >> dz}.png`;
  let relief: HTMLImageElement | null = null, dem: HTMLImageElement | null = null, pending = 2;
  const done = () => {
    if (--pending > 0) return;
    if (!dem) { tile.failedAt = Date.now(); return; }
    xcQueue.push(() => {
      const surface = document.createElement("canvas");
      surface.width = surface.height = 256;
      const c = surface.getContext("2d", { willReadFrequently: true });
      if (!c || !dem) return;
      const part = 256 >> dz, sx = (x & ((1 << dz) - 1)) * part, sy = (y & ((1 << dz) - 1)) * part;
      if (dz > 0) {
        // Tint the small DEM source once, then upscale smoothly instead of tinting blocky pixels.
        const src = document.createElement("canvas");
        src.width = src.height = Math.max(1, part);
        const sc = src.getContext("2d", { willReadFrequently: true });
        if (!sc) return;
        sc.drawImage(dem, sx, sy, part, part, 0, 0, part, part);
        const img = sc.getImageData(0, 0, part, part);
        tintTerrarium(img.data);
        sc.putImageData(img, 0, 0);
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = "high";
        c.drawImage(src, 0, 0, 256, 256);
        src.width = src.height = 0;
      } else {
        c.drawImage(dem, 0, 0);
        const img = c.getImageData(0, 0, 256, 256);
        tintTerrarium(img.data);
        c.putImageData(img, 0, 0);
      }
      if (relief) { c.globalCompositeOperation = "multiply"; c.drawImage(relief, 0, 0, 256, 256); c.globalCompositeOperation = "source-over"; }
      tile.image = (relief ?? dem); tile.surface = surface; tile.loaded = true;
      if (relief) persistXc(key, surface);
    });
    pumpXc();
  };
  loadImageElement(reliefTileUrl(x, y, level), (i) => { relief = i; done(); }, done);
  loadImageElement(demUrl, (i) => { dem = i; done(); }, done);
}
/** XC Relief base: hypsometric DEM tint multiplied with swisstopo hillshade, built once per tile and kept on the device. */
function xcTile(level: number, x: number, y: number): Tile {
  const key = `${level}/${x}/${y}`;
  const existing = xcCache.get(key);
  if (existing && (!existing.failedAt || Date.now() - existing.failedAt < 30000)) { xcCache.delete(key); xcCache.set(key, existing); return existing; }
  const tile: Tile = { image: null as unknown as HTMLImageElement, loaded: false, failedAt: 0 };
  const fromStore = typeof caches === "undefined" ? Promise.resolve(undefined) : caches.open(XC_CACHE).then((c) => c.match(`/xcrelief/${key}`)).catch(() => undefined);
  fromStore.then((res) => res ? res.blob() : null).then((blob) => {
    if (!blob) { computeXc(tile, key, level, x, y); return; }
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); tile.image = image; tile.loaded = true; };
    image.onerror = () => { URL.revokeObjectURL(url); computeXc(tile, key, level, x, y); };
    image.src = url;
  }).catch(() => computeXc(tile, key, level, x, y));
  xcCache.set(key, tile);
  if (xcCache.size > 256) {
    const oldest = xcCache.keys().next().value;
    if (oldest !== undefined) { const old = xcCache.get(oldest); xcCache.delete(oldest); if (old?.surface) { old.surface.width = 0; old.surface.height = 0; } }
  }
  return tile;
}

function drawPeaks(ctx: CanvasRenderingContext2D, site: Pick<Site, "lat" | "lon">, x: number, y: number, width: number, height: number, zoom: number, level: number) {
  const o = mapOrigin(site), cx = o.x + x / o.scale, cy = o.y + y / o.scale, R = 6378137;
  const placed: [number, number, number, number][] = [];
  ctx.save();
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  for (const [name, lat, lon, h, minLevel] of PEAKS) {
    if (level < minLevel) continue;
    const px = R * lon * Math.PI / 180, py = R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
    const sx = width / 2 + (px - cx) * o.scale * zoom, sy = height * 0.55 - (py - cy) * o.scale * zoom;
    if (sx < -100 || sx > width + 20 || sy < -20 || sy > height + 20) continue;
    const text = `${name} ${h}m`, w = ctx.measureText(text).width + 14;
    if (placed.some(([a, b, c, d]) => sx < c && sx + w > a && sy - 8 < d && sy + 8 > b)) continue;
    placed.push([sx - 6, sy - 8, sx + w, sy + 8]);
    ctx.fillStyle = "rgba(40,30,25,0.85)";
    ctx.beginPath(); ctx.moveTo(sx, sy - 5); ctx.lineTo(sx + 5, sy + 4); ctx.lineTo(sx - 5, sy + 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 3;
    ctx.strokeText(text, sx + 8, sy); ctx.fillText(text, sx + 8, sy);
  }
  ctx.restore();
}

/** Browser-only tile rendering; the flight engine remains independent of the map. */
export function drawSwissRelief(ctx: CanvasRenderingContext2D, site: Pick<Site, "lat" | "lon">, x: number, y: number, width: number, height: number, zoom: number, dpr = 1, mapStyle = activeStyle) {
  let loaded = 0, failed = 0;
  const theme = getComputedStyle(ctx.canvas);
  const reliefFilter = theme.getPropertyValue("--map-relief-filter").trim() || "none";
  const waterColor = theme.getPropertyValue("--map-water").trim();
  const forestColor = theme.getPropertyValue("--map-forest").trim();
  const offline = offlineEnabled() && !navigator.onLine;
  const style = MAP_STYLES.find((m) => m.v === (offline ? "relief" : mapStyle)) ?? MAP_STYLES[0];
  const relief = style.v === "relief";
  if (style.v === "xcrelief") {
    let level = 0;
    for (const p of visibleReliefTiles(site, x, y, width, height, zoom, dpr, 17)) {
      level = p.level;
      const tile = xcTile(p.level, p.x, p.y);
      if (tile.loaded) loaded++; else if (tile.failedAt) failed++;
      if (!tile.loaded) {
        // Show the plain hillshade until the coloured tile is ready instead of a blank gap.
        const base = tileImage(reliefTileUrl(p.x, p.y, p.level));
        if (base.loaded) ctx.drawImage(base.surface ?? base.image, p.left, p.top, p.size + 0.5, p.size + 0.5);
        continue;
      }
      const water = tileImage(waterTileUrl(p.x, p.y, p.level), "none", XC_WATER);
      const river = tileImage(riverTileUrl(p.x, p.y, p.level), "none", XC_WATER);
      const surface = composedTile(`xc/${p.level}/${p.x}/${p.y}`, [tile, water, river]);
      if (surface) ctx.drawImage(surface, p.left, p.top, p.size + 0.5, p.size + 0.5);
    }
    drawPeaks(ctx, site, x, y, width, height, zoom, level);
    return { loaded, failed };
  }
  for (const position of visibleReliefTiles(site, x, y, width, height, zoom, dpr, offline ? 12 : 17)) {
    const tile = tileImage(style.url(position.level, position.x, position.y), relief ? reliefFilter : "none", "", style.fallback?.(position.level, position.x, position.y));
    if (tile.loaded) {
      if (!relief) ctx.drawImage(tile.surface ?? tile.image, position.left, position.top, position.size + 0.5, position.size + 0.5);
      loaded++;
    } else if (tile.failedAt) failed++;
    if (!relief) continue;
    const water = tileImage(waterTileUrl(position.x, position.y, position.level), "none", waterColor);
    const forest = tileImage(forestTileUrl(position.x, position.y, position.level), "none", forestColor);
    const river = tileImage(riverTileUrl(position.x, position.y, position.level), "none", waterColor);
    const surface = composedTile(`${position.level}/${position.x}/${position.y}/${reliefFilter}/${waterColor}/${forestColor}`, [tile, water, forest, river]);
    if (surface) ctx.drawImage(surface, position.left, position.top, position.size + 0.5, position.size + 0.5);
  }
  return { loaded, failed };
}