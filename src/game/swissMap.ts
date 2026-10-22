import type { Site } from "./sites";

const EARTH_RADIUS = 6378137;
export const TILE_SIZE = 256;
export const MERCATOR_EXTENT = Math.PI * EARTH_RADIUS;
export const RELIEF_LAYER = "ch.swisstopo.leichte-basiskarte_reliefschattierung";
export const WATER_LAYER = "ch.swisstopo.swisstlm3d-gewaessernetz";
export const MIN_RELIEF_LEVEL = 8;
export const MAX_RELIEF_LEVEL = 17;

/** Highest WMTS level whose tiles still render at least ~256 device pixels wide. */
export function reliefLevel(scale: number, zoom: number, dpr = 1) {
  const level = Math.floor(Math.log2((2 * MERCATOR_EXTENT * scale * zoom * dpr) / TILE_SIZE));
  return Math.min(MAX_RELIEF_LEVEL, Math.max(MIN_RELIEF_LEVEL, level));
}

function tileMetres(level: number) {
  return (2 * MERCATOR_EXTENT) / 2 ** level;
}

/** Local flight coordinates: east/north metres relative to the launch site. */
export function mapOrigin(site: Pick<Site, "lat" | "lon">) {
  const latitude = site.lat * Math.PI / 180;
  return {
    x: EARTH_RADIUS * site.lon * Math.PI / 180,
    y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + latitude / 2)),
    scale: Math.cos(latitude),
  };
}

export function reliefTileUrl(x: number, y: number, level: number) {
  return `https://wmts.geo.admin.ch/1.0.0/${RELIEF_LAYER}/default/current/3857/${level}/${x}/${y}.png`;
}

export function waterTileUrl(x: number, y: number, level: number) {
  return `https://wmts.geo.admin.ch/1.0.0/${WATER_LAYER}/default/current/3857/${level}/${x}/${y}.png`;
}

export function visibleReliefTiles(site: Pick<Site, "lat" | "lon">, x: number, y: number, width: number, height: number, zoom: number, dpr = 1) {
  const origin = mapOrigin(site);
  const level = reliefLevel(origin.scale, zoom, dpr);
  const tileMetresAtLevel = tileMetres(level);
  const centerX = origin.x + x / origin.scale;
  const centerY = origin.y + y / origin.scale;
  const left = centerX - width / 2 / zoom / origin.scale;
  const right = centerX + width / 2 / zoom / origin.scale;
  const top = centerY + height * 0.55 / zoom / origin.scale;
  const bottom = centerY - height * 0.45 / zoom / origin.scale;
  const tiles: { x: number; y: number; level: number; left: number; top: number; size: number }[] = [];
  for (let ty = Math.floor((MERCATOR_EXTENT - top) / tileMetresAtLevel); ty <= Math.floor((MERCATOR_EXTENT - bottom) / tileMetresAtLevel); ty++) {
    for (let tx = Math.floor((left + MERCATOR_EXTENT) / tileMetresAtLevel); tx <= Math.floor((right + MERCATOR_EXTENT) / tileMetresAtLevel); tx++) {
      tiles.push({
        x: tx, y: ty, level,
        left: width / 2 + (tx * tileMetresAtLevel - MERCATOR_EXTENT - centerX) * origin.scale * zoom,
        top: height * 0.55 - (MERCATOR_EXTENT - ty * tileMetresAtLevel - centerY) * origin.scale * zoom,
        size: tileMetresAtLevel * origin.scale * zoom,
      });
    }
  }
  return tiles;
}
