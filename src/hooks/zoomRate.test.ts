import { describe, expect, it } from "vitest";
import { zoomRateFactor } from "./zoomRate";

describe("mobile rate zoom", () => {
  it("does not zoom at the neutral midpoint", () => expect(zoomRateFactor(0, 1)).toBe(1));
  it("zooms in when dragged down", () => expect(zoomRateFactor(1, 1)).toBe(2));
  it("zooms out when dragged up", () => expect(zoomRateFactor(-1, 1)).toBe(0.5));
  it("changes zoom speed in proportion to displacement", () => {
    expect(Math.log(zoomRateFactor(0.5, 1))).toBeCloseTo(Math.log(zoomRateFactor(1, 1)) / 2);
  });
  it("is independent of frame rate", () => {
    expect(zoomRateFactor(0.7, 1 / 60) ** 60).toBeCloseTo(zoomRateFactor(0.7, 1));
  });
});