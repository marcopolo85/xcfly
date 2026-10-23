import { describe, expect, it } from "vitest";
import { needsFlightCoverage, flightCoverageReady, nextCoverageCenter } from "./flightCoverage";
import { N, RES, EXTENT, heightAt, cloudbaseAt, type Terrain } from "./terrain";
import { localToPixel } from "./realTerrain";
import { rasterHeatAt, type ThermalRaster } from "./thermalRaster";
import { airLift } from "./thermals";
import { SITES } from "./sites";

const terrain = (x = 0, y = 0): Terrain => ({ site: SITES[0], centerX: x, centerY: y, h: new Float32Array(N * N).fill(700), cb: new Float32Array(1600).fill(2200), cbN: 40 });

describe("long flight coverage", () => {
  it("prefetches ahead of the old 20 km limit and waits before using clamped terrain", () => {
    const t = terrain();
    expect(needsFlightCoverage(t, 9999, 0)).toBe(false);
    expect(needsFlightCoverage(t, 10000, 0)).toBe(true);
    expect(flightCoverageReady(t, 17999, 0)).toBe(true);
    expect(flightCoverageReady(t, 18000, 0)).toBe(false);
    expect(nextCoverageCenter(51000, -29000)).toEqual({ x: 50000, y: -30000 });
  });
  it("samples true terrain and cloudbase 50 km from launch in original coordinates", () => {
    const t = terrain(50000, -30000);
    const mid = (N - 1) / 2;
    t.h[mid * N + mid] = 1600;
    t.h[mid * N + mid + 1] = 1800;
    t.cb[20 * 40 + 20] = 3100;
    expect(heightAt(t, 50000, -30000)).toBe(1600);
    expect(heightAt(t, 50000 + RES / 2, -30000)).toBe(1700);
    expect(cloudbaseAt(t, 50000, -30000)).toBe(3100);
    expect(flightCoverageReady(t, 50000 + EXTENT / 2, -30000)).toBe(true);
    expect(needsFlightCoverage(t, 60000, -30000)).toBe(true);
  });
  it("retains KK7 heat and lift beyond launch coverage without changing the projection", () => {
    const t = terrain(50000, -30000);
    const p = localToPixel(t.site, 50000, -30000);
    const raster: ThermalRaster = { site: t.site, left: p.px - 1, top: p.py - 1, width: 2, height: 2, strength: new Float32Array(4).fill(1) };
    expect(rasterHeatAt(raster, 0, 0)).toBe(0);
    expect(rasterHeatAt(raster, 50000, -30000)).toBe(1);
    expect(airLift({ grid: new Map(), count: 0, raster }, t, 50000, -30000, 1700, 0, { x: 0, y: 0, z: 0.87 }, 4.5)).toBe(6);
  });
});