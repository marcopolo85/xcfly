import { describe, expect, it } from "vitest";
import { SITES } from "./sites";
import { localToPixel } from "./realTerrain";
import { thermalHeat, thermalTileUrl, rasterHeatAt, type ThermalRaster } from "./thermalRaster";
import { airLift } from "./thermals";
import { N, type Terrain } from "./terrain";

describe("KK7 July / All day thermal areas", () => {
  it("requests July and All day, with inverted TMS rows and the required source", () => {
    expect(thermalTileUrl(2150, 1450, "example.com")).toBe("https://thermal.kk7.ch/tiles/thermals_jul_all/12/2150/2645.png?src=example.com");
  });
  it("retains full colored areas and never invents heat in transparent pixels", () => {
    expect(thermalHeat(255, 0, 0, 0)).toBe(0);
    expect(thermalHeat(255, 0, 0, 255)).toBe(1);
    expect(thermalHeat(0, 0, 255, 255)).toBeCloseTo(0.05);
    expect(thermalHeat(255, 255, 0, 255)).toBeGreaterThan(thermalHeat(0, 255, 255, 255));
  });
  it("samples a continuous area between pixels, rather than isolated sources", () => {
    const site = SITES[0], pixel = localToPixel(site, 0, 0);
    const raster: ThermalRaster = { site, left: pixel.px - 1, top: pixel.py - 1, width: 2, height: 2, strength: new Float32Array([0, 1, 0, 1]) };
    expect(rasterHeatAt(raster, 0, 0)).toBeCloseTo(0.5);
    const terrain: Terrain = { site, h: new Float32Array(N * N), cb: new Float32Array(1600).fill(3000), cbN: 40 };
    const field = { grid: new Map(), count: 0, raster };
    expect(airLift(field, terrain, 0, 0, 1000, 0, { x: 0, y: 0, z: 0.87 }, 4.5)).toBeGreaterThan(1);
    expect(airLift(field, terrain, 0, 0, 1000, 0, { x: 0, y: 0, z: -1 }, 4.5)).toBeLessThan(0);
    raster.strength.fill(0);
    expect(airLift(field, terrain, 0, 0, 1000, 0, { x: 0, y: 0, z: 0.87 }, 4.5)).toBeLessThan(0);
  });
});