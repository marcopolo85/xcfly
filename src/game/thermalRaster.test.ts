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
    expect(thermalHeat(0, 0, 255, 255)).toBeCloseTo(0.1);
    expect(thermalHeat(255, 255, 0, 255)).toBeGreaterThan(thermalHeat(0, 255, 255, 255));
  });
  it("lift strength rises monotonically from blue to dark red", () => {
    const blue = thermalHeat(0, 0, 255, 255);
    const cyan = thermalHeat(0, 255, 255, 255);
    const green = thermalHeat(0, 255, 0, 255);
    const yellow = thermalHeat(255, 255, 0, 255);
    const red = thermalHeat(255, 0, 0, 255);
    const darkRed = thermalHeat(128, 0, 0, 255);
    expect(blue).toBeLessThan(cyan);
    expect(cyan).toBeLessThan(green);
    expect(green).toBeLessThan(yellow);
    expect(yellow).toBeLessThan(red);
    expect(darkRed).toBe(1);
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
  it("maps the color scale to climb rates: blue 2 m/s, dark red 6 m/s", () => {
    const site = SITES[0], pixel = localToPixel(site, 0, 0);
    const terrain: Terrain = { site, h: new Float32Array(N * N), cb: new Float32Array(1600).fill(3000), cbN: 40 };
    const raster: ThermalRaster = { site, left: pixel.px - 1, top: pixel.py - 1, width: 2, height: 2, strength: new Float32Array(4) };
    const field = { grid: new Map(), count: 0, raster };
    const sun = { x: 0, y: 0, z: 0.87 };
    raster.strength.fill(0.1); // blue
    expect(airLift(field, terrain, 0, 0, 1000, 0, sun, 4.5)).toBeCloseTo(2, 1);
    raster.strength.fill(1); // dark red
    expect(airLift(field, terrain, 0, 0, 1000, 0, sun, 4.5)).toBeCloseTo(6, 1);
  });
});