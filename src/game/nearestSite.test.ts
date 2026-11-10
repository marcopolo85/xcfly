import { describe, it, expect } from "vitest";
import { findNearestSiteOrPeak } from "./nearestSite";
describe("findNearestSiteOrPeak", () => {
  it("names nearby places", () => {
    expect(findNearestSiteOrPeak(47.05, 8.49)).toBe("Rigi Kulm");
    expect(findNearestSiteOrPeak(46.41, 8.11)).toBe("Fiesch (Heimat)");
    expect(findNearestSiteOrPeak(47.13, 7.06)).toBe("Chasseral");
    expect(findNearestSiteOrPeak(46.8, 10.28)).toBe("Scuol Motta Naluns");
  });
});
