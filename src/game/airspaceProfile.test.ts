import { describe, expect, it } from "vitest";
import type { Airspace } from "./airspace";
import { airspaceProfileIntervals } from "./airspaceProfile";

const box = (minX: number, minY: number, maxX: number, maxY: number) => [
  { x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY },
];
const a: Airspace = { kind: "CTR", name: "Test", lower: { value: 0, type: "AGL" }, upper: { value: 100, type: "FL" }, label: { x: 0, y: 0 }, rings: [box(-100, 200, 100, 1000)] };

describe("heading-relative airspace cross section", () => {
  it("intersects only areas along the flight heading", () => {
    expect(airspaceProfileIntervals(a, { x: 0, y: 0 }, 0, -700, 5800)).toEqual([[200, 1000]]);
    expect(airspaceProfileIntervals(a, { x: 0, y: 0 }, Math.PI / 2, -700, 5800)).toEqual([]);
  });
  it("clips to the visible range including a viewpoint inside the area", () => {
    expect(airspaceProfileIntervals(a, { x: 0, y: 500 }, 0, -100, 300)).toEqual([[-100, 300]]);
  });
  it("preserves holes rather than filling them with airspace", () => {
    expect(airspaceProfileIntervals({ ...a, rings: [...a.rings, box(-50, 400, 50, 600)] }, { x: 0, y: 0 }, 0, -700, 5800)).toEqual([[200, 400], [600, 1000]]);
  });
});