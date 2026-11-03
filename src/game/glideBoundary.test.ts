import { describe, expect, it } from "vitest";
import { GLIDE_BOUNDARY_RAYS, traceGlideBoundary } from "./glideBoundary";
import { N, RES, EXTENT, type Terrain } from "./terrain";

const flat = { h: new Float32Array(N * N).fill(1000), centerX: 0, centerY: 0 } as Terrain;
const sim = { x: 0, y: 0, alt: 1200, speed: 10, vz: -1 };
const trace = (terrain = flat, state = sim) => {
  const points = new Float64Array(GLIDE_BOUNDARY_RAYS * 2);
  traceGlideBoundary(terrain, state, points);
  return points;
};

describe("current glide terrain boundary", () => {
  it("reaches 2000 m with 200 m AGL and current glide ratio 1:10", () => {
    const points = trace();
    for (let i = 0; i < GLIDE_BOUNDARY_RAYS; i++) expect(Math.hypot(points[i * 2], points[i * 2 + 1])).toBeCloseTo(2000, 1);
  });
  it("shrinks to 1000 m when the current glide ratio becomes 1:5", () => {
    expect(trace(flat, { ...sim, vz: -2 })[1]).toBeCloseTo(1000, 1);
  });
  it("stops at the first ridge rather than showing unreachable terrain behind it", () => {
    const h = flat.h.slice();
    for (let j = 0; j < N; j++) {
      const y = EXTENT - j * RES;
      if (y >= 400 && y <= 600) h.fill(1400, j * N, (j + 1) * N);
    }
    const points = trace({ ...flat, h });
    expect(points[1]).toBeGreaterThan(375);
    expect(points[1]).toBeLessThan(400);
  });
  it("does not invent a finite boundary while climbing or beyond loaded coverage", () => {
    expect(Array.from(trace(flat, { ...sim, vz: 2 })).every(Number.isNaN)).toBe(true);
    expect(Array.from(trace(flat, { ...sim, alt: 10000 })).every(Number.isNaN)).toBe(true);
  });
});
import { addGlideSample, averageGlideVz } from "./glideBoundary";
describe("average glide ratio", () => {
  it("averages only glide segments and ignores climbs", () => {
    const avg = { dist: 0, drop: 0 };
    addGlideSample(avg, 10, -1, 0, 100); // 1:10
    addGlideSample(avg, 10, -2, 0, 100); // 1:5
    addGlideSample(avg, 10, 2, 3, 100); // thermal, ignored
    expect(avg.dist / avg.drop).toBeCloseTo(2000 / 300, 6);
    expect(averageGlideVz(avg, 10, -1)).toBeCloseTo(-1.5, 6);
  });
});
