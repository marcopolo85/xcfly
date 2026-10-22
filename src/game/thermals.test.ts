import { describe, expect, it } from "vitest";
import { SITES } from "./sites";
import { generateTerrain, heightAt } from "./terrain";
import { airLift, generateThermals } from "./thermals";
import { sunPosition, sunVector } from "./sun";
import { mulberry32 } from "./rng";
import { POLAR } from "./physicsEngine";

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
