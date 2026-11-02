import { describe, expect, it } from "vitest";
import { xcScore, XC_FACTORS } from "./xcScore";

describe("xcScore (XContest)", () => {
  it("Faktoren frei 1.0, Dreieck 1.2, FAI 1.4", () => {
    expect(XC_FACTORS).toEqual({ free: 1.0, tri: 1.2, fai: 1.4 });
  });
  it("gerade Strecke zählt als freie Strecke", () => {
    const s = xcScore([5000, 10000], [0, 0]);
    expect(s.type).toBe("free");
    expect(s.points).toBeCloseTo(10, 3);
  });
  it("geschlossenes gleichseitiges Dreieck zählt als FAI ×1.4", () => {
    const s = xcScore([10000, 5000, 0], [0, 8660, 0]);
    expect(s.type).toBe("fai");
    expect(s.points).toBeCloseTo(30 * 1.4, 0);
  });
  it("offenes Dreieck über 20 % Schliessdistanz wird nicht gewertet", () => {
    expect(xcScore([10000, 5000, 7000], [0, 8660, 6000]).type).toBe("free");
  });
});
