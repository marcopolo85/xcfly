import { describe, expect, it } from "vitest";
import { SITES } from "./sites";
import { generateTerrain, heightAt, N, type Terrain } from "./terrain";
import { airLift, generateThermals, peakLift, summitCore, sunlitSurfaceLift, type ThermalField } from "./thermals";
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
  it("higher and more exposed summits give stronger lift", () => {
    const low = flat(1400), high = flat(3500);
    expect(high).toBeGreaterThan(low + 2);
    expect(low).toBeGreaterThanOrEqual(2.5);
    expect(high).toBeLessThanOrEqual(8);
    
    expect(summitCore({ x: 0, y: 0, h: 2500, prom: 600 })).toBeGreaterThan(summitCore({ x: 0, y: 0, h: 2500, prom: 160 }) + 1.2);
  });
});

describe("sunlit surfaces below ridge height", () => {
  const terrain: Terrain = {
    h: new Float32Array(N * N).fill(500),
    cb: new Float32Array(1600).fill(2500), cbN: 40, site: SITES[0],
  };
  const sun = { x: 0, y: 0, z: 1 };
  const candidates: { x: number; y: number; lift: number }[] = [];
  for (let y = -2000; y <= 2000; y += 100) for (let x = -2000; x <= 2000; x += 100) {
    candidates.push({ x, y, lift: sunlitSurfaceLift(terrain, x, y, 550, sun) });
  }
  const best = candidates.reduce((a, b) => a.lift > b.lift ? a : b);

  it("provides net climb close to sunlit ground without a summit or KK7 heat", () => {
    const { px, py } = localToPixel(terrain.site, best.x, best.y, THERMAL_ZOOM);
    const field: ThermalField = { grid: new Map(), count: 0, raster: {
      site: terrain.site, left: Math.floor(px) - 1, top: Math.floor(py) - 1,
      width: 8, height: 8, strength: new Float32Array(64),
    } };
    expect(airLift(field, terrain, best.x, best.y, 550, 39600, sun, 4.5) - POLAR.trim.sink).toBeGreaterThan(0);
    expect(candidates.some(p => p.lift < 0.1)).toBe(true);
  });
  it("keeps random sources stable across frames and moving terrain windows", () => {
    expect(sunlitSurfaceLift(terrain, best.x, best.y, 550, sun)).toBe(best.lift);
    expect(sunlitSurfaceLift({ ...terrain, centerX: 1000, centerY: 1000 }, best.x, best.y, 550, sun)).toBe(best.lift);
  });
  it("does not produce surface thermals at night or on poorly illuminated surfaces", () => {
    expect(sunlitSurfaceLift(terrain, best.x, best.y, 550, { x: 0, y: 0, z: -1 })).toBe(0);
    expect(sunlitSurfaceLift(terrain, best.x, best.y, 550, { x: 0.98, y: 0, z: 0.2 })).toBe(0);
  });
  it("stops at cloudbase and does not create lift below ground", () => {
    expect(sunlitSurfaceLift(terrain, best.x, best.y, 2500, sun)).toBe(0);
    expect(sunlitSurfaceLift(terrain, best.x, best.y, 500, sun)).toBe(0);
  });
  it("does not fabricate lift outside loaded terrain", () => {
    expect(sunlitSurfaceLift({ ...terrain, centerX: best.x + 50000 }, best.x, best.y, 550, sun)).toBe(0);
  });
});
