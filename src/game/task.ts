import { EXTENT } from "./terrain";

export const CYLINDER_RADIUS = 400;

export interface Waypoint { x: number; y: number; name: string }
export interface Task { type: "Dreieck" | "Out & Return"; waypoints: Waypoint[]; legs: number[] }

const clamp = (v: number) => Math.max(-EXTENT + 2000, Math.min(EXTENT - 2000, v));
const at = (b: number, d: number, o = { x: 0, y: 0 }) => ({ x: clamp(o.x + Math.sin(b) * d), y: clamp(o.y + Math.cos(b) * d) });

export function generateTask(rnd: () => number): Task {
  const b = rnd() * Math.PI * 2;
  let pts: { x: number; y: number }[];
  let type: Task["type"];
  if (rnd() < 0.6) {
    type = "Dreieck";
    const a = at(b, 6000 + rnd() * 5000);
    const c = at(b + (0.9 + rnd() * 0.6), 6000 + rnd() * 5000);
    pts = [a, c, { x: 0, y: 0 }];
  } else {
    type = "Out & Return";
    const d = 9000 + rnd() * 6000;
    pts = [at(b, d * 0.5), at(b, d), { x: 0, y: 0 }];
  }
  const waypoints = pts.map((p, i) => ({ ...p, name: i === 2 ? "ZIEL" : `TP${i + 1}` }));
  const legs: number[] = [];
  let prev = { x: 0, y: 0 };
  for (const w of waypoints) { legs.push(Math.hypot(w.x - prev.x, w.y - prev.y)); prev = w; }
  return { type, waypoints, legs };
}

export function inCylinder(px: number, py: number, w: { x: number; y: number }) {
  return Math.hypot(px - w.x, py - w.y) <= CYLINDER_RADIUS;
}

/** Optimised XC distance: completed legs + progress on the current leg. */
export function xcDistance(task: Task, next: number, px: number, py: number) {
  let d = 0;
  for (let i = 0; i < next && i < task.legs.length; i++) d += task.legs[i];
  if (next < task.waypoints.length) {
    const w = task.waypoints[next];
    const remaining = Math.max(0, Math.hypot(px - w.x, py - w.y) - CYLINDER_RADIUS);
    d += Math.max(0, task.legs[next] - CYLINDER_RADIUS - remaining);
  }
  return d;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
