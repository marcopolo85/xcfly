import { describe, expect, it } from "vitest";
import { parseSimPrefs } from "./simPrefs";
import { timeScale } from "./physicsEngine";
describe("sim prefs", () => {
  it("defaults keep current tempo 1× / 40×", () => {
    const p = parseSimPrefs(null);
    expect([p.normalSpeed, p.accelSpeed]).toEqual([1, 40]);
  });
  it("clamps normal tempo to 1–5", () => expect(parseSimPrefs('{"normalSpeed":9}').normalSpeed).toBe(5));
  it("clamps accelerated tempo to at least 10", () => expect(parseSimPrefs('{"accelSpeed":3}').accelSpeed).toBe(10));
  it("accelerated factor is configurable", () => expect(timeScale(true, 1, 20)).toBe(20));
});
