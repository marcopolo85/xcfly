import { cloudbaseAt, heightAt, type Terrain } from "./terrain";

export const POLAR = {
  trim: { v: 10.5, sink: 1.1 }, // ~38 km/h, L/D ≈ 9.5
  accel: { v: 14.5, sink: 2.05 }, // ~52 km/h, L/D ≈ 7.1
};
export const TURN_RATE = (64 * Math.PI) / 180; // rad per simulated second
export const TURN_SINK = 0.45;
export const ACCEL_TIME_FACTOR = 20;

/** Game-time factor: base simulation speed, multiplied by 20 on speedbar. */
export function timeScale(accel: boolean, simSpeed = 1) {
  return simSpeed * (accel ? ACCEL_TIME_FACTOR : 1);
}

export const HOLD_BOOST_MS = 2000;
export const HOLD_BOOST_FACTOR = 20;

export type HoldStarts = { left: number | null; right: number | null };

// ×10 simulation rate while a turn button has been held for HOLD_BOOST_MS or longer.
export function holdBoost(input: Input, holdStart: HoldStarts, nowReal: number) {
  const longHold = (key: "left" | "right") =>
    input[key] && holdStart[key] !== null && nowReal - (holdStart[key] as number) >= HOLD_BOOST_MS;
  return longHold("left") || longHold("right") ? HOLD_BOOST_FACTOR : 1;
}

export interface Sim {
  x: number; y: number; alt: number; heading: number;
  vz: number; airLift: number; speed: number;
  distance: number; flightTime: number; clock: number; // clock in hours
  landed: boolean;
}

export interface Input { left: boolean; right: boolean; accel: boolean }

/**
 * Applies the turn rate per simulated second so the flown circle keeps the
 * same radius regardless of the simulation speed (see game.test.ts).
 */
export function steer(sim: Sim, input: Input, dtReal: number, simSpeed = 1) {
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const dtSim = dtReal * timeScale(input.accel, simSpeed);
  sim.heading = (sim.heading + dir * TURN_RATE * dtSim + Math.PI * 2) % (Math.PI * 2);
}

export function stepPhysics(sim: Sim, input: Input, dt: number, t: Terrain, lift: number) {
  const p = input.accel ? POLAR.accel : POLAR.trim;
  const turning = input.left !== input.right;
  sim.speed += (p.v - sim.speed) * Math.min(1, dt * 1.5);
  const sink = p.sink + (turning ? TURN_SINK : 0);
  sim.airLift = lift;
  sim.vz = lift - sink;
  const dx = Math.sin(sim.heading) * sim.speed * dt;
  const dy = Math.cos(sim.heading) * sim.speed * dt;
  sim.x += dx; sim.y += dy;
  sim.distance += Math.hypot(dx, dy);
  sim.alt += sim.vz * dt;
  const cb = cloudbaseAt(t, sim.x, sim.y);
  if (sim.alt > cb) { sim.alt = cb; sim.vz = Math.min(0, sim.vz); }
  sim.flightTime += dt;
  sim.clock += dt / 3600;
  if (sim.flightTime > 5 && sim.alt <= heightAt(t, sim.x, sim.y)) {
    sim.alt = heightAt(t, sim.x, sim.y);
    sim.landed = true;
  }
}

export function glideRatio(speed: number, vz: number) {
  return vz < -0.05 ? speed / -vz : Infinity;
}
