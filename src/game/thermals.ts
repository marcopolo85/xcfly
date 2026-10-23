import { EXTENT, cloudbaseAt, normalAt, heightAt, gradientAt, type Terrain } from "./terrain";
import { rasterHeatAt, type ThermalRaster } from "./thermalRaster";

export interface Thermal {
  x: number; y: number;
  nx: number; ny: number; nz: number;
  r: number; power: number; period: number; phase: number;
}

const CELL = 1000;

export interface ThermalField {
  grid: Map<number, Thermal[]>;
  count: number;
  raster?: ThermalRaster;
}

const key = (cx: number, cy: number) => (cx + 100) * 1000 + (cy + 100);

export function generateThermals(t: Terrain, rnd: () => number): ThermalField {
  const grid = new Map<number, Thermal[]>();
  let count = 0;
  for (let gy = -EXTENT + 400; gy < EXTENT - 400; gy += 350) {
    for (let gx = -EXTENT + 400; gx < EXTENT - 400; gx += 350) {
      const x = gx + (rnd() - 0.5) * 300;
      const y = gy + (rnd() - 0.5) * 300;
      const n = normalAt(t, x, y);
      // Thermals detach at realistic trigger points: summits/ridges,
      // large open flats and pronounced slope breaks.
      if (Math.hypot(x, y) < 600) continue; // launch source covers this area
      const rel = releaseScore(t, x, y);
      if (rnd() > 0.08 + rel * 0.85) continue;
      const th: Thermal = {
        x, y, nx: n.x, ny: n.y, nz: n.z,
        r: 150 + rnd() * 110,
        power: 0.45 + rel * 0.6 + rnd() * 0.3,
        period: 250 + rnd() * 500,
        phase: rnd() * Math.PI * 2,
      };
      const k = key(Math.floor(x / CELL), Math.floor(y / CELL));
      let arr = grid.get(k);
      if (!arr) grid.set(k, (arr = []));
      arr.push(th);
      count++;
    }
  }
  // A local source lets pilots encounter the launch meadow's thermal before
  // their limited initial ground clearance is exhausted; sunlight still gates it.
  const launchNormal = normalAt(t, 0, 0);
  const heading = Math.atan2(launchNormal.x, launchNormal.y);
  const x = Math.sin(heading) * 120, y = Math.cos(heading) * 120;
  const launchSource: Thermal = {
    x, y, nx: launchNormal.x, ny: launchNormal.y, nz: launchNormal.z,
    r: 260, power: 1.4, period: 600, phase: rnd() * Math.PI * 2,
  };
  const k = key(Math.floor(x / CELL), Math.floor(y / CELL));
  const sources = grid.get(k) ?? [];
  sources.push(launchSource); grid.set(k, sources); count++;
  return { grid, count };
}

/**
 * Likelihood (0..1) that warm air detaches here: summits and ridges
 * (height above surroundings), large flat open areas, and marked
 * terrain transitions (strong change of slope, e.g. valley floor to flank).
 */
export function releaseScore(t: Terrain, x: number, y: number) {
  const h = heightAt(t, x, y);
  let ring = 0, slopeIn = 0, slopeOut = 0, flatSum = 0;
  const K = 8;
  for (let i = 0; i < K; i++) {
    const a = (i / K) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    ring += heightAt(t, x + c * 500, y + s * 500);
    const gi = gradientAt(t, x + c * 100, y + s * 100), go = gradientAt(t, x + c * 400, y + s * 400);
    slopeIn += Math.hypot(gi.gx, gi.gy); slopeOut += Math.hypot(go.gx, go.gy);
    flatSum += Math.hypot(go.gx, go.gy);
  }
  ring /= K; slopeIn /= K; slopeOut /= K;
  const peak = Math.max(0, Math.min(1, (h - ring) / 120));
  const flat = Math.max(0, Math.min(1, 1 - (flatSum / K) / 0.08));
  const brk = Math.max(0, Math.min(1, Math.abs(slopeOut - slopeIn) / 0.25));
  return Math.max(peak, flat * 0.8, brk);
}

/** How strongly a surface with normal n is lit by sun vector s (0..1 trigger). */
export function slopeTrigger(n: { x: number; y: number; z: number }, s: { x: number; y: number; z: number }) {
  if (s.z <= 0) return 0;
  const irr = n.x * s.x + n.y * s.y + n.z * s.z;
  return Math.max(0, Math.min(1, (irr - 0.45) / 0.5));
}

/**
 * Vertical air movement (m/s) at a point. Thermals are invisible; strength follows
 * solar irradiance on the source slope, so east faces trigger in the morning,
 * south faces at noon and west faces in the evening.
 */
export function airLift(
  f: ThermalField, t: Terrain, x: number, y: number, alt: number,
  simTime: number, sun: { x: number; y: number; z: number }, maxLift: number,
) {
  const sunAmp = maxLift * Math.sqrt(Math.max(0, sun.z) / 0.87);
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  let lift = 0;
  if (f.raster) {
    const local = slopeTrigger(normalAt(t, x, y), sun);
    const pulse = 0.9 + 0.1 * Math.sin(simTime / 300);
    const fade = Math.max(0, Math.min(1, (cloudbaseAt(t, x, y) - alt) / 200));
    return sunAmp * rasterHeatAt(f.raster, x, y) * (0.8 + 0.2 * local) * pulse * fade + (local < 0.05 ? -0.55 : -0.15);
  }
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const arr = f.grid.get(key(cx + dx, cy + dy));
      if (!arr) continue;
      for (const th of arr) {
        const ddx = x - th.x, ddy = y - th.y;
        const d2 = ddx * ddx + ddy * ddy;
        const r2 = th.r * th.r;
        if (d2 > 9 * r2) continue;
        const trig = slopeTrigger({ x: th.nx, y: th.ny, z: th.nz }, sun);
        if (trig <= 0) continue;
        const pulse = 0.8 + 0.2 * Math.sin(simTime / th.period + th.phase);
        const core = sunAmp * th.power * trig * pulse;
        lift += core * (1.3 * Math.exp(-d2 / r2) - 0.3 * Math.exp(-d2 / (4 * r2)));
      }
    }
  const cb = cloudbaseAt(t, x, y);
  lift *= Math.max(0, Math.min(1, (cb - alt) / 200));
  const local = slopeTrigger(normalAt(t, x, y), sun);
  const shadeSink = local < 0.05 ? -0.55 : -0.15;
  return Math.min(maxLift * 1.5, lift) + shadeSink;
}
