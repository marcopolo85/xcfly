import { describe, expect, it } from "vitest";
import { bestTriangle, isFai } from "./xcTriangle";

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
});
