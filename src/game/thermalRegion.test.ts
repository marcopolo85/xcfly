import { expect, it } from "vitest";
import { inThermalRegion, thermalRegionBounds } from "./thermalRegion";
import { localToPixel } from "./realTerrain";
import { SITES } from "./sites";
import { rasterHeatAt, type ThermalRaster } from "./thermalRaster";

it("covers every Swiss launch and Domodossola, but does not load the world", () => {
  for (const site of SITES) expect(inThermalRegion(site.lat, site.lon)).toBe(true);
  expect(inThermalRegion(46.115, 8.291)).toBe(true);
  expect(inThermalRegion(51.5, -0.1)).toBe(false);
  const b = thermalRegionBounds();
  const domodossola = localToPixel({ lat: 46.115, lon: 8.291 }, 0, 0);
  expect(Math.floor(domodossola.px / 256)).toBeGreaterThanOrEqual(b.x0);
  expect(Math.floor(domodossola.px / 256)).toBeLessThanOrEqual(b.x1);
  expect(Math.floor(domodossola.py / 256)).toBeGreaterThanOrEqual(b.y0);
  expect(Math.floor(domodossola.py / 256)).toBeLessThanOrEqual(b.y1);
});

it("samples the full regional raster across tile seams in the launch projection", () => {
  const b = thermalRegionBounds();
  // At longitude 8.4375 the zoom-12 pixel coordinate is exactly a tile seam.
  const site = { ...SITES[0], lat: 46.1, lon: 8.4375 };
  const p = localToPixel(site, 0, 0);
  const tx = Math.floor(p.px / 256), ty = Math.floor(p.py / 256);
  const tiles = new Map<string, Uint8Array>();
  for (const x of [tx - 1, tx]) for (const y of [ty - 1, ty]) tiles.set(`${x},${y}`, new Uint8Array(65536).fill(x === tx ? 255 : 51));
  const raster: ThermalRaster = { site, left: b.x0 * 256, top: b.y0 * 256, width: (b.x1 - b.x0 + 1) * 256, height: (b.y1 - b.y0 + 1) * 256, strength: new Float32Array(0), tiles };
  expect(rasterHeatAt(raster, 0, 0)).toBeCloseTo(0.6, 5);
  tiles.clear();
  expect(rasterHeatAt(raster, 0, 0)).toBe(0);
});