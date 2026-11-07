import { describe, expect, it } from "vitest";
import { recenterTransform, flightAnchorFraction } from "./recenterTransform";

describe("recenter flight view", () => {
  it("places the mobile pilot halfway between map top and instrument top", () => {
    expect(flightAnchorFraction(844, 496, true, false) * 844).toBe(248);
    expect(flightAnchorFraction(844, 496, true, true) * 844).toBe(248);
  });
  it("preserves desktop anchors", () => {
    expect(flightAnchorFraction(1800, 1500, false, false)).toBe(0.5);
    expect(flightAnchorFraction(1800, 1500, false, true)).toBe(1 / 3);
  });
  it("centres the pilot without changing zoom", () => {
    const view = recenterTransform(3, 400, 800);
    expect(view.k).toBe(3);
    expect(view.apply([200, 400])).toEqual([200, 400]);
  });
  it("keeps the profile-mode pilot anchor", () => {
    const view = recenterTransform(0.5, 1200, 900, 1 / 3);
    expect(view.k).toBe(0.5);
    expect(view.apply([600, 300])).toEqual([600, 300]);
  });
});