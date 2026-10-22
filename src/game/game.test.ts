import { describe, expect, it } from "vitest";
import { timeScale } from "./physicsEngine";
import { cloudbaseFromPeak } from "./terrain";
import { inCylinder, generateTask, mulberry32 } from "./task";
import { slopeTrigger } from "./thermals";
import { sunPosition, sunVector } from "./sun";

describe("game rules", () => {
  it("speedbar runs game time 5x faster", () => {
    expect(timeScale(true)).toBe(5);
    expect(timeScale(false)).toBe(1);
  });
  it("speedbar is a multiple of the chosen simulation speed", () => {
    expect(timeScale(false, 3)).toBe(3);
    expect(timeScale(true, 3)).toBe(15);
  });
  it("cloudbase is 500 m above the peaks", () => {
    expect(cloudbaseFromPeak(2800)).toBe(3300);
  });
  it("waypoint is reached inside a 400 m cylinder", () => {
    expect(inCylinder(399, 0, { x: 0, y: 0 })).toBe(true);
    expect(inCylinder(401, 0, { x: 0, y: 0 })).toBe(false);
  });
  it("task has 3 waypoints", () => {
    expect(generateTask(mulberry32(3)).waypoints).toHaveLength(3);
  });
  it("east slopes trigger in the morning, west slopes in the evening", () => {
    const east = { x: 0.6, y: 0, z: 0.8 }, west = { x: -0.6, y: 0, z: 0.8 };
    const am = sunVector(sunPosition(46.7, 172, 9, true));
    const pm = sunVector(sunPosition(46.7, 172, 18, true));
    expect(slopeTrigger(east, am)).toBeGreaterThan(slopeTrigger(west, am));
    expect(slopeTrigger(west, pm)).toBeGreaterThan(slopeTrigger(east, pm));
  });
});
