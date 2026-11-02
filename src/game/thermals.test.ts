import { describe, expect, it } from "vitest";
import { SITES } from "./sites";
import { generateTerrain, heightAt } from "./terrain";
import { airLift, generateThermals, peakLift, type ThermalField } from "./thermals";
import { sunPosition, sunVector } from "./sun";
import { mulberry32 } from "./rng";
import { POLAR } from "./physicsEngine";
import { localToPixel } from "./realTerrain";
import { THERMAL_ZOOM } from "./thermalRaster";

describe("usable solar thermals", () => {
  for (const site of SITES) {
    it(`${site.name}: encounters positive net climb at a sunlit summer launch`, () => {
      const terrain = generateTerrain(site);
      const sun = sunVector(sunPosition(site.lat, 172, 11, true));
      for (const seed of [1, 7, 42]) {
        const field = generateThermals(terrain, mulberry32(seed));
        const lift = airLift(field, terrain, 0, 0, heightAt(terrain, 0, 0) + 40, 39600, sun, 4.5);
        expect(lift - POLAR.trim.sink).toBeGreaterThan(0.15);
      }
    });
  }
  it("solar thermals cannot create climb at night", () => {
    const terrain = generateTerrain(SITES[0]);
    const field = generateThermals(terrain, mulberry32(1));
    expect(airLift(field, terrain, 0, 0, 1990, 0, { x: 0, y: 0, z: -1 }, 4.5)).toBeLessThanOrEqual(0);
  });
  it("KK7 colors give randomized lift: blue 1–3 m/s, red 6–9 m/s", () => {
    const site = SITES[0];
    const terrain = generateTerrain(site);
    const sun = sunVector(sunPosition(site.lat, 172, 11, true));
    const field = (heat: number): ThermalField => {
      const { px, py } = localToPixel(site, 0, 0, THERMAL_ZOOM);
      return {
        grid: new Map(), count: 0,
        raster: { site, left: Math.floor(px) - 1, top: Math.floor(py) - 1, width: 8, height: 8, strength: new Float32Array(64).fill(heat) },
      };
    };
    const alt = 1000; // well below cloudbase, so fade = 1
    const blue = airLift(field(0.1), terrain, 0, 0, alt, 39600, sun, 4.5);
    expect(blue).toBeGreaterThanOrEqual(1);
    expect(blue).toBeLessThanOrEqual(3);
    const red = airLift(field(1), terrain, 0, 0, alt, 39600, sun, 4.5);
    expect(red).toBeGreaterThanOrEqual(6);
    expect(red).toBeLessThanOrEqual(9);
    // Strength is randomized but deterministic per position: same place, same lift.
    expect(airLift(field(0.1), terrain, 0, 0, alt, 39600, sun, 4.5)).toBe(blue);
  });
});
describe("thermal release points", () => {
  it("summits release more readily than mid-slope points", async () => {
    const { releaseScore } = await import("./thermals");
    const t = generateTerrain(SITES[0]);
    let best = { x: 0, y: 0, h: -1 };
    for (let y = -8000; y <= 8000; y += 400) for (let x = -8000; x <= 8000; x += 400) {
      const h = heightAt(t, x, y); if (h > best.h) best = { x, y, h };
    }
    expect(releaseScore(t, best.x, best.y)).toBeGreaterThan(0.5);
  });
});
describe("summit thermals", () => {
  const flat = (hp: number, cx = 0, cy = 0) => {
    const t = generateTerrain(SITES[0]);
    t.h.fill(400);
    // cone-shaped peak centred at (cx, cy) in metres
    const N = Math.sqrt(t.h.length), c = (N - 1) / 2;
    const ci = c + cx / 25, cj = c - cy / 25; // row 0 = north
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const d = Math.hypot(i - ci, j - cj) * 25;
      if (d < 2000) t.h[j * N + i] = 400 + (hp - 400) * (1 - d / 2000);
    }
    return peakLift(t, cx, cy);
  };
  it("strength is randomized and independent of summit height", () => {
    const low = flat(1400), high = flat(3500);
    // Same position, different heights: identical random strength.
    expect(high).toBe(low);
    expect(low).toBeGreaterThanOrEqual(1.5);
    expect(low).toBeLessThanOrEqual(6);
    // Different summits get different random strengths.
    const other = flat(3500, 4000, 4000);
    expect(other).not.toBe(low);
    expect(other).toBeGreaterThanOrEqual(1.5);
    expect(other).toBeLessThanOrEqual(6);
  });
});
