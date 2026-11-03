import { describe, expect, it } from "vitest";
import { timeScale, steer, stepPhysics, TURN_RATE, STEER_ANALOG_FACTOR, holdBoost, HOLD_BOOST_FACTOR, setTurnInput, type HoldStarts, type Sim } from "./physicsEngine";
import { cloudbaseAt, cloudbaseFromPeak, finalizeTerrain, heightAt, N } from "./terrain";
import { SITES } from "./sites";
import { mulberry32 } from "./rng";
import { slopeTrigger } from "./thermals";
import { sunPosition, sunVector } from "./sun";

const newSim = (alt = 2000, vz = -1): Sim => ({ x: 0, y: 0, alt, heading: 0, vz, airLift: 0, speed: 10.5, distance: 0, flightTime: 0, clock: 12, trackX: [], trackY: [], xcDist: 0, landed: false, maxAlt: alt, climbTotal: 0, thermals: 0, circles: 0, turnAcc: 0, inLift: false });

describe("game rules", () => {
  it("speedbar runs game time 40x faster", () => {
    expect(timeScale(true)).toBe(40);
    expect(timeScale(false)).toBe(1);
  });
  it("speedbar is a multiple of the chosen simulation speed", () => {
    expect(timeScale(false, 3)).toBe(3);
    expect(timeScale(true, 3)).toBe(120);
  });
  it.each(["left", "right"] as const)("holding the %s arrow with keyboard repeats boosts 20x after 2s until release", (key) => {
    const input = { left: false, right: false, accel: false };
    const starts: HoldStarts = { left: null, right: null };
    setTurnInput(input, starts, key, true, 1000);
    for (let now = 1300; now < 4000; now += 100) {
      setTurnInput(input, starts, key, true, now);
      expect(starts[key]).toBe(1000);
      expect(holdBoost(input, starts, now)).toBe(now < 3000 ? 1 : 20);
    }
    setTurnInput(input, starts, key, false, 4000);
    expect(holdBoost(input, starts, 4000)).toBe(1);
    expect(starts[key]).toBeNull();
    setTurnInput(input, starts, key, true, 5000);
    expect(holdBoost(input, starts, 6999)).toBe(1);
    expect(holdBoost(input, starts, 7000)).toBe(20);
  });
  it("holding a turn button for 2s boosts the simulation rate 20x until release", () => {
    const input = { left: false, right: true, accel: false };
    const starts = { left: null, right: 1000 };
    expect(holdBoost(input, starts, 1000 + 1999)).toBe(1);
    expect(holdBoost(input, starts, 1000 + 2000)).toBe(HOLD_BOOST_FACTOR);
    expect(holdBoost({ ...input, right: false }, starts, 1000 + 5000)).toBe(1);
    expect(holdBoost(input, { left: null, right: null }, 5000)).toBe(1);
  });
  it("turn radius is the same at any simulation speed", () => {
    const turnAt = (simSpeed: number) => {
      const sim = newSim();
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
  it("sliding on the speed button steers slowly, at a quarter of the full turn rate", () => {
    const sim = newSim();
    steer(sim, { left: false, right: false, accel: false, steer: 1 }, 1, 1);
    expect(sim.heading).toBeCloseTo(TURN_RATE * STEER_ANALOG_FACTOR, 6);
    steer(sim, { left: false, right: false, accel: false, steer: -0.5 }, 1, 1);
    expect(sim.heading).toBeCloseTo((TURN_RATE * STEER_ANALOG_FACTOR) / 2, 6);
  });
  it("on the speed bar the arrows turn at 2° per real second", () => {
    const sim = newSim();
    steer(sim, { left: false, right: true, accel: true }, 1, 1);
    expect(sim.heading).toBeCloseTo((2 * Math.PI) / 180, 6);
    // The hold boost speeds up flight time but not the arrow turn rate.
    steer(sim, { left: false, right: true, accel: true }, 1, HOLD_BOOST_FACTOR);
    expect(sim.heading).toBeCloseTo(2 * ((2 * Math.PI) / 180), 6);
  });
  it("cloudbase is 500 m above the peaks", () => {
    expect(cloudbaseFromPeak(2800)).toBe(3300);
  });
  it("flatland thermals reach 1500 m above ground", () => {
    const h = new Float32Array(N * N).fill(500);
    const t = finalizeTerrain({ ...SITES[0], valley: 500, peak: 500, launchAlt: 500 }, h);
    expect(cloudbaseAt(t, 0, 0)).toBe(2000);
    expect(cloudbaseAt(t, 0, 0) - heightAt(t, 0, 0)).toBe(1500);
  });
  it("XC distance is the XContest-style optimized free distance, not the distance flown", () => {
    const flat = { h: new Float32Array(N * N), cb: new Float32Array(16).fill(5000), cbN: 4, site: { x: 0, y: 0, alt: 0 } as never };
    const sim = newSim(2000, 0);
    const fly = (seconds: number) => {
      for (let i = 0; i < seconds * 20; i++) stepPhysics(sim, { left: false, right: false, accel: false }, 0.05, flat, 0);
    };
    // Fly 3 km straight out, then turn around and fly 3 km back to the launch.
    fly(3000 / 10.5);
    expect(sim.xcDist).toBeGreaterThan(2900);
    expect(sim.xcDist).toBeLessThan(3100);
    sim.heading = Math.PI;
    fly(3000 / 10.5);
    // Back at the launch: flown distance stays 6 km, but XC distance counts
    // launch -> turnpoint -> current position = 3 km + 3 km, like XContest.
    expect(Math.hypot(sim.x, sim.y)).toBeLessThan(200);
    expect(sim.xcDist).toBeGreaterThan(5750);
    expect(sim.xcDist).toBeLessThan(5950);
  });
  it("east slopes trigger in the morning, west slopes in the evening", () => {
    const east = { x: 0.6, y: 0, z: 0.8 }, west = { x: -0.6, y: 0, z: 0.8 };
    const am = sunVector(sunPosition(46.7, 172, 9, true));
    const pm = sunVector(sunPosition(46.7, 172, 18, true));
    expect(slopeTrigger(east, am)).toBeGreaterThan(slopeTrigger(west, am));
    expect(slopeTrigger(west, pm)).toBeGreaterThan(slopeTrigger(east, pm));
  });
  it("counts thermals, thermalling circles and cumulative climb", () => {
    const flat = { h: new Float32Array(N * N), cb: new Float32Array(16).fill(5000), cbN: 4, site: { x: 0, y: 0, alt: 0 } as never };
    const sim = newSim();
    // Entering core lift counts one thermal and accumulates climb.
    stepPhysics(sim, { left: false, right: false, accel: false }, 0.05, flat, 2);
    expect(sim.thermals).toBe(1);
    expect(sim.climbTotal).toBeGreaterThan(0);
    expect(sim.maxAlt).toBeGreaterThan(2000);
    // A full 360° rotation while climbing counts one thermalling circle.
    const input = { left: false, right: true, accel: false };
    const fullTurn = (2 * Math.PI) / TURN_RATE;
    for (let i = 0; i < 120; i++) {
      steer(sim, input, fullTurn / 120, 1);
      stepPhysics(sim, input, fullTurn / 120, flat, 2);
    }
    expect(sim.circles).toBe(1);
    // A full rotation without lift does not count as a thermalling circle.
    for (let i = 0; i < 120; i++) {
      steer(sim, input, fullTurn / 120, 1);
      stepPhysics(sim, input, fullTurn / 120, flat, 0);
    }
    expect(sim.circles).toBe(1);
    expect(sim.thermals).toBe(1);
  });
});
