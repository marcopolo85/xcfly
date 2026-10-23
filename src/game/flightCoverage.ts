import { EXTENT, type Terrain } from "./terrain";

/** Prefetch while there is still 10 km of loaded terrain ahead. */
export function needsFlightCoverage(t: Terrain, x: number, y: number) {
  return Math.max(Math.abs(x - (t.centerX ?? 0)), Math.abs(y - (t.centerY ?? 0))) >= EXTENT / 2;
}

/** Never fly on clamped terrain while waiting for the next area. */
export function flightCoverageReady(t: Terrain, x: number, y: number) {
  return Math.max(Math.abs(x - (t.centerX ?? 0)), Math.abs(y - (t.centerY ?? 0))) < EXTENT - 2000;
}

export function nextCoverageCenter(x: number, y: number) {
  const step = EXTENT / 2;
  return { x: Math.round(x / step) * step, y: Math.round(y / step) * step };
}