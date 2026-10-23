import { localToPixel } from "./realTerrain";
import type { Site } from "./sites";

export const THERMAL_ZOOM = 12;
export const THERMAL_DATASET = "jul_all";
export interface ThermalRaster {
  site: Site;
  left: number;
  top: number;
  width: number;
  height: number;
  strength: Float32Array;
}

/** KK7 uses TMS: invert the XYZ row, not the image itself. */
export function thermalTileUrl(x: number, y: number, source: string, z = THERMAL_ZOOM) {
  return `https://thermal.kk7.ch/tiles/thermals_${THERMAL_DATASET}/${z}/${x}/${2 ** z - 1 - y}.png?src=${encodeURIComponent(source)}`;
}

/** Relative heat from KK7's rainbow palette, not a calibrated m/s forecast.
 * Transparent pixels mean no provider data; blue is cool, red is hot. */
export function thermalHeat(r: number, g: number, b: number, alpha: number) {
  if (alpha === 0) return 0;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  if (delta === 0) return 0;
  let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  return (0.05 + 0.95 * Math.max(0, Math.min(1, (240 - hue) / 240))) * alpha / 255;
}

/** Bilinear sampling keeps broad thermal areas continuous, without hotspots. */
export function rasterHeatAt(raster: ThermalRaster, x: number, y: number) {
  const { px, py } = localToPixel(raster.site, x, y, THERMAL_ZOOM);
  const fx = px - raster.left - 0.5, fy = py - raster.top - 0.5;
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
  if (i < 0 || j < 0 || i + 1 >= raster.width || j + 1 >= raster.height) return 0;
  const a = raster.strength[j * raster.width + i], b = raster.strength[j * raster.width + i + 1];
  const c = raster.strength[(j + 1) * raster.width + i], d = raster.strength[(j + 1) * raster.width + i + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}