import { localToPixel } from "./realTerrain";
import { THERMAL_ZOOM } from "./thermalRaster";

/** Switzerland with a cross-border margin, including Domodossola. */
export const THERMAL_REGION = { west: 5.8, east: 10.8, south: 45.4, north: 48.2 };

export function thermalRegionBounds() {
  const a = localToPixel({ lat: THERMAL_REGION.north, lon: THERMAL_REGION.west }, 0, 0, THERMAL_ZOOM);
  const b = localToPixel({ lat: THERMAL_REGION.south, lon: THERMAL_REGION.east }, 0, 0, THERMAL_ZOOM);
  return { x0: Math.floor(a.px / 256), y0: Math.floor(a.py / 256), x1: Math.floor(b.px / 256), y1: Math.floor(b.py / 256) };
}

export function inThermalRegion(lat: number, lon: number) {
  return lat >= THERMAL_REGION.south && lat <= THERMAL_REGION.north && lon >= THERMAL_REGION.west && lon <= THERMAL_REGION.east;
}