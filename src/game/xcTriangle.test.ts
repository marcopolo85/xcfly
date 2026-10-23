import { describe, expect, it } from "vitest";
import { bestTriangle, closingDistance, isFai } from "./xcTriangle";

describe("xc triangle", () => {
  it("equilateral triangle is FAI, a flat one is not", () => {
    expect(isFai({ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 500, y: 866 })).toBe(true);
    expect(isFai({ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 500, y: 100 })).toBe(false);
  });
  it("finds the flown triangle and its closing distance", () => {
    const t = bestTriangle([1000, 2000, 1500], [0, 0, 1732], { x: 1000, y: 1732 });
    expect(t?.fai).toBe(true);
    expect(t!.perimeter).toBeGreaterThan(5000);
  });
  it("reports min/max FAI size of the closing sector and the closing-cylinder distance", () => {
    const t = bestTriangle([3000], [0], { x: 3000, y: 4000 })!;
    // legs 3000 / 4000 / 5000, closing sector sits on the 4000 m leg b–c
    expect(t.minP).toBeCloseTo((25 / 11) * 4000);
    expect(t.maxP).toBeCloseTo((25 / 7) * 4000);
    // 5000 m to the start vertex, cylinder radius 20 % of the 12000 m perimeter
    expect(closingDistance(t)).toBeCloseTo(5000 - 0.2 * 12000);
  });
});
