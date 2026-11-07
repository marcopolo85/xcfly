import { describe, expect, it } from "vitest";
import { parseSimPrefs, flightZoomTarget, type FlightZoomState } from "./simPrefs";
import { timeScale } from "./physicsEngine";
describe("sim prefs", () => {
  it("defaults keep current tempo 1× / 40×", () => {
    const p = parseSimPrefs(null);
    expect([p.normalSpeed, p.accelSpeed]).toEqual([1, 40]);
  });
  it("clamps normal tempo to 1–5", () => expect(parseSimPrefs('{"normalSpeed":9}').normalSpeed).toBe(5));
  it("clamps accelerated tempo to at least 10", () => expect(parseSimPrefs('{"accelSpeed":3}').accelSpeed).toBe(10));
  it("accelerated factor is configurable", () => expect(timeScale(true, 1, 20)).toBe(20));
  it("restores the map-selected thermal zoom after accelerated flight", () => {
    const prefs = { ...parseSimPrefs(null), autoZoom: true, zoomAccel: 0.5 };
    const state: FlightZoomState = { accel: null, thermal: 1 };
    expect(flightZoomTarget(state, false, 1, prefs)).toBeNull();
    expect(flightZoomTarget(state, true, 2.75, prefs)).toBe(0.5);
    expect(flightZoomTarget(state, true, 0.8, prefs)).toBeNull();
    expect(flightZoomTarget(state, false, 0.8, prefs)).toBe(2.75);
    expect(flightZoomTarget(state, true, 1.6, prefs)).toBe(0.5);
    expect(flightZoomTarget(state, false, 0.5, prefs)).toBe(1.6);
  });
  it("leaves map zoom unchanged when automatic switching is off", () => {
    const state: FlightZoomState = { accel: false, thermal: 1 };
    expect(flightZoomTarget(state, true, 2.5, parseSimPrefs(null))).toBeNull();
    expect(flightZoomTarget(state, false, 0.5, parseSimPrefs(null))).toBeNull();
  });
});
