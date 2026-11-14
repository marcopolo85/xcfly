import { len } from "./fastMath";
import { cloudbaseAt, heightAt, type Terrain } from "./terrain";

export const POLAR = {
  trim: { v: 10.5, sink: 1.1 }, // ~38 km/h, L/D ≈ 9.5
  accel: { v: 14.5, sink: 2.05 }, // ~52 km/h, L/D ≈ 7.1
};
export const TURN_RATE = (128 * Math.PI) / 180; // rad per simulated second
/** Slide steering on the speed button turns at a fraction of the full turn rate. */
export const STEER_ANALOG_FACTOR = 0.0625;
export const TURN_SINK = 0.45;
export const ACCEL_TIME_FACTOR = 40;

/** Game-time factor: base simulation speed, multiplied by 40 on speedbar. */
export function timeScale(accel: boolean, simSpeed = 1, accelFactor = ACCEL_TIME_FACTOR) {
  return simSpeed * (accel ? accelFactor : 1);
}

export const HOLD_BOOST_MS = 2000;
export const HOLD_BOOST_FACTOR = 20;

export type HoldStarts = { left: number | null; right: number | null };

/** Keep the original press time when the OS repeats a held arrow key. */
export function setTurnInput(input: Input, starts: HoldStarts, key: "left" | "right", pressed: boolean, nowReal: number) {
  if (pressed && !input[key]) starts[key] = nowReal;
  if (!pressed) starts[key] = null;
  input[key] = pressed;
}

// ×20 simulation rate while a turn button has been held for HOLD_BOOST_MS or longer.
// Never applies on the speed bar: accelerated flight must not stack the hold boost.
export function holdBoost(input: Input, holdStart: HoldStarts, nowReal: number) {
  if (input.accel) return 1;
  const longHold = (key: "left" | "right") =>
    input[key] && holdStart[key] !== null && nowReal - (holdStart[key] as number) >= HOLD_BOOST_MS;
  return longHold("left") || longHold("right") ? HOLD_BOOST_FACTOR : 1;
}

/**
 * Simulation rates for one real frame. The long-hold boost speeds up climb,
 * flight time only: heading and horizontal motion keep the normal-mode rate,
 * preserving the small circle while gaining height ×20 faster.
 */
export function frameSpeeds(input: Input, holdStart: HoldStarts, nowReal: number, normalSpeed: number) {
  const base = input.accel ? 1 : normalSpeed;
  return { turn: base, motion: base, sim: base * holdBoost(input, holdStart, nowReal) };
}

export interface Sim {
  x: number; y: number; alt: number; heading: number;
  vz: number; airLift: number; speed: number;
  distance: number; flightTime: number; clock: number; // clock in hours
  trackX: number[]; trackY: number[]; trackAlt: number[]; // downsampled path for XC optimization (alt stored for ghost replay)
  xcDist: number; // XContest-style optimized free distance
  landed: boolean;
  // Flight statistics for the results screen.
  maxAlt: number; climbTotal: number; thermals: number; circles: number;
  turnAcc: number; inLift: boolean;
}

/** Meters between track points used for the XC distance optimization. */
export const XC_TRACK_STEP = 100;

/**
 * XContest-style free distance with one turnpoint: the largest value of
 * d(launch, p) + d(p, current position) over all track points p.
 * The launch is always at (0, 0) in simulation coordinates.
 */
function updateXc(sim: Sim) {
  const n = sim.trackX.length;
  const lx = n ? sim.trackX[n - 1] : 0;
  const ly = n ? sim.trackY[n - 1] : 0;
  if (len(sim.x - lx, sim.y - ly) < XC_TRACK_STEP) return;
  sim.trackX.push(sim.x);
  sim.trackY.push(sim.y);
  sim.trackAlt.push(sim.alt);
  const ex = sim.x, ey = sim.y;
  for (let i = 0; i <= n; i++) {
    const px = i < n ? sim.trackX[i] : 0;
    const py = i < n ? sim.trackY[i] : 0;
    const d = len(px, py) + len(ex - px, ey - py);
    if (d > sim.xcDist) sim.xcDist = d;
  }
}

/** Arrow turn rate while on the speed bar: 2° per real second (not per simulated second). */
export const ACCEL_TURN_RATE = (5 * Math.PI) / 180;

export interface Input { left: boolean; right: boolean; accel: boolean; steer?: number }

/**
 * Applies the turn rate per simulated second so the flown circle keeps the
 * same radius regardless of the simulation speed (see game.test.ts).
 * `steer` is the analog slide value (-1..1) from the speed button.
 * On the speed bar the arrows turn at a fixed gentle 2°/s real time instead of
 * scaling with the accelerated simulation rate; slide steering is unchanged.
 */
export function steer(sim: Sim, input: Input, dtReal: number, simSpeed = 1, accelFactor = ACCEL_TIME_FACTOR, circleFactor = 1) {
  const dirDigital = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const dirAnalog = (input.steer ?? 0) * STEER_ANALOG_FACTOR;
  const dtSim = dtReal * timeScale(input.accel, simSpeed, accelFactor);
  const rot = input.accel
    ? dirDigital * ACCEL_TURN_RATE * dtReal + dirAnalog * TURN_RATE * dtSim
    : (dirDigital + dirAnalog) * TURN_RATE * dtSim;
  // A full 360° rotation counts as a thermalling circle, but only while climbing.
  if (dirDigital + dirAnalog !== 0) {
    sim.turnAcc += Math.abs(rot);
    if (sim.turnAcc >= Math.PI * 2) {
      sim.turnAcc -= Math.PI * 2;
      // Hold boost: each drawn circle represents circleFactor simulated circles.
      if (sim.vz > 0.3) sim.circles += Math.max(1, Math.round(circleFactor));
    }
  } else sim.turnAcc = 0;
  sim.heading = (sim.heading + rot + Math.PI * 2) % (Math.PI * 2);
  return rot;
}

/** Drawn glider rotation: at most one revolution per real second while thermalling. */
export const SYMBOL_MAX_RATE = Math.PI * 2;
const TAU = Math.PI * 2;

/** The rotation currently drawn for the glider, plus the turn it could not show yet. */
export interface VisualYaw { vis: number; lag: number }

/**
 * Slows down only the *drawn* rotation to SYMBOL_MAX_RATE while thermalling: the
 * physics keep the true heading, so climb rate and turn radius are untouched and
 * the flight merely looks calmer. Rotation the display could not show is kept as
 * `lag` and made up at the same capped rate as soon as the glider flies straight.
 * On the speed bar the symbol points exactly along the flight direction.
 */
export function stepVisualYaw(yaw: VisualYaw, heading: number, rot: number, dtReal: number, accel: boolean) {
  // Releasing the turn button stops the drawn rotation at once.
  if (accel || rot === 0) { yaw.vis = heading; yaw.lag = 0; return yaw; }
  const cap = SYMBOL_MAX_RATE * dtReal;
  const shown = rot > cap ? cap : rot < -cap ? -cap : rot;
  yaw.lag += rot - shown;
  // Drop whole turns but keep the sign, so catching up never spins backwards.
  if (yaw.lag > TAU) yaw.lag %= TAU; else if (yaw.lag < -TAU) yaw.lag = -(-yaw.lag % TAU);
  const spare = cap - Math.abs(shown);
  if (spare > 0 && yaw.lag !== 0) {
    const back = Math.min(Math.abs(yaw.lag), spare);
    yaw.lag += yaw.lag > 0 ? -back : back;
  }
  yaw.vis = heading - yaw.lag;
  return yaw;
}

export function stepPhysics(sim: Sim, input: Input, dt: number, t: Terrain, lift: number, motionDt = dt) {
  const p = input.accel ? POLAR.accel : POLAR.trim;
  const turning = input.left !== input.right;
  sim.speed += (p.v - sim.speed) * Math.min(1, dt * 1.5);
  const sink = p.sink + (turning ? TURN_SINK : 0);
  sim.airLift = lift;
  sim.vz = lift - sink;
  // A thermal is entered when the core lift rises above 0.5 m/s.
  const lifting = lift > 0.5;
  if (lifting && !sim.inLift) sim.thermals++;
  sim.inLift = lifting;
  const dx = Math.sin(sim.heading) * sim.speed * motionDt;
  const dy = Math.cos(sim.heading) * sim.speed * motionDt;
  sim.x += dx; sim.y += dy;
  sim.distance += len(dx, dy);
  updateXc(sim);
  sim.alt += sim.vz * dt;
  if (sim.alt > sim.maxAlt) sim.maxAlt = sim.alt;
  if (sim.vz > 0) sim.climbTotal += sim.vz * dt;
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
