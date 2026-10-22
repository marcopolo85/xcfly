import type { Site } from "./sites";

const EARTH_RADIUS = 6378137;
export const MAP_ZOOM = 13;
export const TILE_SIZE = 256;
export const MERCATOR_EXTENT = Math.PI * EARTH_RADIUS;
export const TILE_METRES = (2 * MERCATOR_EXTENT) / 2 ** MAP_ZOOM;
export const RELIEF_LAYER = "ch.swisstopo.pixelkarte-farbe";

/** Local flight coordinates: east/north metres relative to the launch site. */
export function mapOrigin(site: Pick<Site, "lat" | "lon">) {
  const latitude = site.lat * Math.PI / 180;
  return {
    x: EARTH_RADIUS * site.lon * Math.PI / 180,
    y: EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + latitude / 2)),
    scale: Math.cos(latitude),
  };
}

export function reliefTileUrl(x: number, y: number) {
  return `https://wmts.geo.admin.ch/1.0.0/${RELIEF_LAYER}/default/current/3857/${MAP_ZOOM}/${x}/${y}.jpeg`;
}

export function visibleReliefTiles(site: Pick<Site, "lat" | "lon">, x: number, y: number, width: number, height: number, zoom: number) {
  const origin = mapOrigin(site);
  const centerX = origin.x + x / origin.scale;
  const centerY = origin.y + y / origin.scale;
  const left = centerX - width / 2 / zoom / origin.scale;
  const right = centerX + width / 2 / zoom / origin.scale;
  const top = centerY + height * 0.55 / zoom / origin.scale;
  const bottom = centerY - height * 0.45 / zoom / origin.scale;
  const tiles: { x: number; y: number; left: number; top: number; size: number }[] = [];
  for (let ty = Math.floor((MERCATOR_EXTENT - top) / TILE_METRES); ty <= Math.floor((MERCATOR_EXTENT - bottom) / TILE_METRES); ty++) {
    for (let tx = Math.floor((left + MERCATOR_EXTENT) / TILE_METRES); tx <= Math.floor((right + MERCATOR_EXTENT) / TILE_METRES); tx++) {
      tiles.push({
        x: tx, y: ty,
        left: width / 2 + (tx * TILE_METRES - MERCATOR_EXTENT - centerX) * origin.scale * zoom,
        top: height * 0.55 - (MERCATOR_EXTENT - ty * TILE_METRES - centerY) * origin.scale * zoom,
        size: TILE_METRES * origin.scale * zoom,
      });
    }
  }
  return tiles;
}