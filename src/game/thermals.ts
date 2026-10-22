import { EXTENT, cloudbaseAt, normalAt, type Terrain } from "./terrain";

export interface Thermal {
  x: number; y: number;
  nx: number; ny: number; nz: number;
  r: number; power: number; period: number; phase: number;
}

const CELL = 1000;

export interface ThermalField {
  grid: Map<number, Thermal[]>;
  count: number;
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
      if (n.z > 0.93 || rnd() > 0.4) continue; // only on real slopes
      const th: Thermal = {
        x, y, nx: n.x, ny: n.y, nz: n.z,
        r: 110 + rnd() * 120,
        power: 0.55 + rnd() * 0.65,
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
  return { grid, count };
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
        const pulse = 0.55 + 0.45 * Math.sin(simTime / th.period + th.phase);
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
