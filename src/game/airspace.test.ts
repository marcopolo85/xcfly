import { describe, expect, it } from "vitest";
import { formatLimit, insideVertical, limitMetres, type Airspace } from "./airspace";

const ctr: Airspace = { kind: "CTR", name: "X", lower: { value: 0, type: "AGL" }, upper: { value: 100, type: "FL" }, rings: [], label: { x: 0, y: 0 } };

describe("airspace limits", () => {
  it("FL100 is 3048 m", () => expect(limitMetres({ value: 100, type: "FL" }, 0)).toBeCloseTo(3048));
  it("inside between GND and FL100", () => {
    expect(insideVertical(ctr, 2000, 500)).toBe(true);
    expect(insideVertical(ctr, 3200, 500)).toBe(false);
  });
  it("labels", () => {
    expect(formatLimit(ctr.lower)).toBe("GND");
    expect(formatLimit(ctr.upper)).toBe("FL100");
  });
});
