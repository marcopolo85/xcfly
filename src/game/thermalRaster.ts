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
  /** Sparse, byte-quantized full-region tiles; empty provider tiles stay empty. */
  tiles?: Map<string, Uint8Array>;
}

/** KK7 uses TMS: invert the XYZ row, not the image itself. */
export function thermalTileUrl(x: number, y: number, source: string, z = THERMAL_ZOOM) {
  return `https://thermal.kk7.ch/tiles/thermals_${THERMAL_DATASET}/${z}/${x}/${2 ** z - 1 - y}.png?src=${encodeURIComponent(source)}`;
}

/** Relative heat from KK7's rainbow palette, not a calibrated m/s forecast.
 * Transparent pixels mean no provider data. Lift strength follows the color
 * scale: blue is weak climb, rising through cyan/green/yellow to dark red,
 * which gives full strength. */
export function thermalHeat(r: number, g: number, b: number, alpha: number) {
  if (alpha < 40) return 0;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  if (delta === 0) return 0;
  let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  const t = Math.max(0, Math.min(1, (240 - hue) / 240)); // blue 0 → dark red 1
  return 0.1 + 0.9 * t;
}

/** Bilinear sampling keeps broad thermal areas continuous, without hotspots. */
export function rasterHeatAt(raster: ThermalRaster, x: number, y: number) {
  const { px, py } = localToPixel(raster.site, x, y, THERMAL_ZOOM);
  const fx = px - raster.left - 0.5, fy = py - raster.top - 0.5;
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
  if (i < 0 || j < 0 || i + 1 >= raster.width || j + 1 >= raster.height) return 0;
  const at = (col: number, row: number) => {
    if (!raster.tiles) return raster.strength[row * raster.width + col];
    const px = raster.left + col, py = raster.top + row;
    const tile = raster.tiles.get(`${Math.floor(px / 256)},${Math.floor(py / 256)}`);
    return tile ? tile[(py % 256) * 256 + px % 256] / 255 : 0;
  };
  const a = at(i, j), b = at(i + 1, j);
  const c = at(i, j + 1), d = at(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}