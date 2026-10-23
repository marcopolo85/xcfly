import { describe, expect, it } from "vitest";
import { bestTriangle, closingGap, faiRange, isFai } from "./xcTriangle";

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
  it("faiRange bounds the achievable FAI perimeter", () => {
    const eq = { a: { x: 0, y: 0 }, b: { x: 1000, y: 0 }, c: { x: 500, y: 866.0254 }, perimeter: 3000, fai: true, closing: 0 };
    expect(faiRange(eq).min).toBeCloseTo(1000 / 0.44, 0);
    expect(faiRange(eq).max).toBeCloseTo(1000 / 0.28, 0);
  });
  it("closingGap measures the missing distance to the closing cylinder", () => {
    const eq = { a: { x: 0, y: 0 }, b: { x: 1000, y: 0 }, c: { x: 500, y: 866.0254 }, perimeter: 3000, fai: true, closing: 700 };
    expect(closingGap(eq)).toBeCloseTo(100, 0);
    expect(closingGap({ ...eq, closing: 500 })).toBe(0);
  });
});
