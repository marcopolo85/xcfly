import { describe, expect, it } from "vitest";
import { bestTriangle, closingGap, faiRange, isFai, type Pt, type XcTriangle } from "./xcTriangle";

describe("xc triangle", () => {
  it("equilateral triangle is FAI, a flat one is not", () => {
    expect(isFai({ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 500, y: 866 })).toBe(true);
    expect(isFai({ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 500, y: 100 })).toBe(false);
  });
  it("finds the flown triangle and its closing distance", () => {
    const t = bestTriangle([1000, 2000, 1500], [0, 0, 1732], { x: 1000, y: 1732 });
    expect(t?.fai).toBe(true);
    expect(t?.perimeter).toBeGreaterThan(5000);
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
  it("pairwise distance reuse preserves the exact exhaustive scoring and vertices", () => {
    const xs = Array.from({ length: 180 }, (_, i) => Math.sin(i * 0.23) * i * 100);
    const ys = xs.map((_, i) => Math.cos(i * 0.17) * i * 75);
    const cur = { x: 2300, y: -1600 };
    const pts: Pt[] = [{ x: 0, y: 0 }];
    for (let i = 0; i < xs.length; i += Math.ceil(xs.length / 70)) pts.push({ x: xs[i], y: ys[i] });
    pts.push(cur);
    const distance = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
    let expected: XcTriangle | null = null, bestScore = 0;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) for (let k = j + 1; k < pts.length; k++) {
      const a = pts[i], b = pts[j], c = pts[k];
      const l1 = distance(a, b), l2 = distance(b, c), l3 = distance(c, a);
      const perimeter = l1 + l2 + l3;
      const fai = Math.min(l1, l2, l3) >= 0.28 * perimeter;
      const score = perimeter * (fai ? 1.4 : 1.2);
      if (score > bestScore) { bestScore = score; expected = { a, b, c, perimeter, fai, closing: distance(cur, a) }; }
    }
    expect(bestTriangle(xs, ys, cur)).toEqual(expected);
  });
});
