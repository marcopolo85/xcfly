import { describe, expect, it } from "vitest";
import { compassLabel, shadowOffset } from "./sunDisplay";
describe("sun display", () => {
  it("labels south and west", () => {
    expect(compassLabel(Math.PI)).toBe("S");
    expect(compassLabel(Math.PI * 1.5)).toBe("W");
  });
  it("casts the shadow away from the sun", () => {
    const o = shadowOffset({ x: 0, y: -0.7071, z: 0.7071 }, 100)!;
    expect(o.y).toBeCloseTo(100, 0);
    expect(shadowOffset({ x: 0, y: -1, z: 0 }, 100)).toBeNull();
  });
});
