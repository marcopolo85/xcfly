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

/** Deterministic smooth random field in -1..1 at ~500 m scale: thermal
 * strength varies randomly by position but stays stable across frames. */
function strengthNoise(x: number, y: number) {
  const s = 500;
  const i = Math.floor(x / s), j = Math.floor(y / s);
  const u = x / s - i, v = y / s - j;
  const h = (a: number, b: number) => {
    let n = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) >>> 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
    return (n >>> 0) / 2147483648 - 1;
  };
  const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  const a = h(i, j), b = h(i + 1, j), c = h(i, j + 1), d = h(i + 1, j + 1);
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
}

/** Prominent, exposed summits found once per terrain window. */
export interface Peak { x: number; y: number; h: number }
const peakCache = new WeakMap<Terrain, Map<number, Peak[]>>();
const PEAK_CELL = 2000;
export function terrainPeaks(t: Terrain) {
  let grid = peakCache.get(t);
  if (grid) return grid;
  grid = new Map();
  const step = 200, ox = t.centerX ?? 0, oy = t.centerY ?? 0;
  for (let y = oy - EXTENT + 800; y <= oy + EXTENT - 800; y += step)
    for (let x = ox - EXTENT + 800; x <= ox + EXTENT - 800; x += step) {
      const h = heightAt(t, x, y);
      let ring = 0, isMax = true;
      for (let i = 0; i < 8 && isMax; i++) {
        const a = (i / 8) * Math.PI * 2;
        const n = heightAt(t, x + Math.cos(a) * step, y + Math.sin(a) * step);
        if (n >= h) isMax = false;
        ring += heightAt(t, x + Math.cos(a) * 350, y + Math.sin(a) * 350);
      }
      // Exposed summit: at least 150 m above its 350 m surroundings.
      if (!isMax || h - ring / 8 < 150) continue;
      const k = key(Math.floor(x / PEAK_CELL), Math.floor(y / PEAK_CELL));
      let arr = grid.get(k); if (!arr) grid.set(k, (arr = []));
      arr.push({ x, y, h });
    }
  peakCache.set(t, grid);
  return grid;
}

/** Deterministic random value (0..1) per summit position, so the strength is
 * stable across frames but unrelated to the summit's height. */
function peakRandom(x: number, y: number) {
  let n = (Math.imul(Math.round(x / 200), 374761393) ^ Math.imul(Math.round(y / 200), 668265263)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
  return (n >>> 0) / 4294967296;
}

/** Summit lift (m/s): randomized per summit, independent of its height (3–6 m/s). */
export function peakLift(t: Terrain, x: number, y: number) {
  const grid = terrainPeaks(t);
  const cx = Math.floor(x / PEAK_CELL), cy = Math.floor(y / PEAK_CELL);
  let best = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const arr = grid.get(key(cx + dx, cy + dy));
    if (!arr) continue;
    for (const p of arr) {
      const d2 = (x - p.x) ** 2 + (y - p.y) ** 2;
      if (d2 > 640000) continue;
      const core = 3 + 3 * peakRandom(p.x, p.y);
      const v = core * Math.exp(-d2 / (250 * 250));
      if (v > best) best = v;
    }
  }
  return best;
}

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

/** Sparse, position-stable sources on well-lit surfaces, independent of KK7
 * and summit height. Evaluate only neighbouring cells in loaded terrain. */
export function sunlitSurfaceLift(t: Terrain, x: number, y: number, alt: number, sun: { x: number; y: number; z: number }) {
  const ox = t.centerX ?? 0, oy = t.centerY ?? 0;
  if (Math.abs(x - ox) > EXTENT - 100 || Math.abs(y - oy) > EXTENT - 100) return 0;
  if (sun.z <= 0 || alt <= heightAt(t, x, y)) return 0;
  const fade = Math.max(0, Math.min(1, (cloudbaseAt(t, x, y) - alt) / 200));
  if (fade === 0) return 0;
  const cell = 900, cx = Math.floor(x / cell), cy = Math.floor(y / cell);
  let best = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const a = cx + dx, b = cy + dy;
    if (peakRandom(a * 200, b * 200) < 0.5) continue;
    const px = (a + 0.2 + 0.6 * peakRandom(a * 200 + 1400, b * 200 - 600)) * cell;
    const py = (b + 0.2 + 0.6 * peakRandom(a * 200 - 1000, b * 200 + 2200)) * cell;
    if (Math.abs(px - ox) > EXTENT - 100 || Math.abs(py - oy) > EXTENT - 100) continue;
    const radius = 180 + 80 * peakRandom(a * 200 + 2600, b * 200 + 1800);
    const d2 = (x - px) ** 2 + (y - py) ** 2;
    if (d2 > 6.25 * radius * radius) continue;
    const exposure = slopeTrigger(normalAt(t, px, py), sun);
    if (exposure < 0.6) continue;
    // Reject slopes hidden behind nearby terrain in the direction of the sun.
    const horizontal = Math.hypot(sun.x, sun.y);
    let shaded = false;
    if (horizontal > 0.01) {
      const ground = heightAt(t, px, py);
      for (const distance of [100, 250, 500, 1000, 2000]) {
        const sx = px + sun.x / horizontal * distance, sy = py + sun.y / horizontal * distance;
        if (Math.abs(sx - ox) > EXTENT || Math.abs(sy - oy) > EXTENT) { shaded = true; break; }
        if (heightAt(t, sx, sy) > ground + 5 + distance * sun.z / horizontal) { shaded = true; break; }
      }
    }
    if (shaded) continue;
    const core = 3 + 2 * peakRandom(a * 200 - 1800, b * 200 - 3000);
    best = Math.max(best, core * exposure * Math.exp(-d2 / (radius * radius)));
  }
  return best * fade;
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
  const surface = sunlitSurfaceLift(t, x, y, alt, sun);
  if (f.raster) {
    // KK7 color scale mapped to climb rates with a deterministic random
    // offset: blue 1–3 m/s, dark red 6–9 m/s, in between the same ratio.
    const heat = rasterHeatAt(f.raster, x, y);
    const local = slopeTrigger(normalAt(t, x, y), sun);
    const shadeSink = local < 0.05 ? -0.55 : -0.15;
    if (sun.z <= 0) return shadeSink;
    const fadeP = Math.max(0, Math.min(1, (cloudbaseAt(t, x, y) - alt) / 200));
    const summit = peakLift(t, x, y) * Math.sqrt(Math.max(0, sun.z) / 0.87) * fadeP;
    if (heat <= 0) return Math.max(summit, surface) > 0.3 ? Math.max(summit, surface) : shadeSink;
    const t01 = Math.max(0, Math.min(1, (heat - 0.1) / 0.9));
    const fade = Math.max(0, Math.min(1, (cloudbaseAt(t, x, y) - alt) / 200));
    const mid = 2 + 5.5 * t01;
    const spread = 1 + 0.5 * t01;
    return Math.max(summit, surface, (mid + spread * strengthNoise(x, y)) * fade);
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
  const summit = peakLift(t, x, y) * Math.sqrt(Math.max(0, sun.z) / 0.87) * Math.max(0, Math.min(1, (cb - alt) / 200));
  return Math.max(summit, surface, Math.min(maxLift * 1.5, lift) + shadeSink);
}
