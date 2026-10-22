import { describe, expect, it } from "vitest";
import { timeScale, steer, stepPhysics, TURN_RATE, type Sim } from "./physicsEngine";
import { cloudbaseFromPeak, N } from "./terrain";
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
  it("turn radius is the same at any simulation speed", () => {
    const turnAt = (simSpeed: number) => {
      const sim: Sim = { x: 0, y: 0, alt: 2000, heading: 0, vz: -1, airLift: 0, speed: 10.5, distance: 0, flightTime: 0, clock: 12, landed: false };
      const input = { left: false, right: true, accel: false };
      const flat = { h: new Float32Array(N * N), cb: new Float32Array(16).fill(5000), cbN: 4, site: { x: 0, y: 0, alt: 0 } as never };
      // Simulate the same real-time span a full turn would need at ×1.
      const totalReal = (2 * Math.PI) / ((32 * Math.PI) / 180);
      const realFrames = 120;
      let turned = 0;
      for (let i = 0; i < realFrames; i++) {
        const dtReal = totalReal / realFrames;
        turned += TURN_RATE * dtReal * timeScale(input.accel, simSpeed);
        steer(sim, input, dtReal, simSpeed);
        stepPhysics(sim, input, dtReal * simSpeed, flat, 0);
      }
      // Distance flown per radian of turn = turn radius.
      return sim.distance / turned;
    };
    const r1 = turnAt(1);
    expect(Math.abs(r1 - 10.5 / TURN_RATE)).toBeLessThan(1);
    expect(turnAt(8)).toBeCloseTo(r1, 0);
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
