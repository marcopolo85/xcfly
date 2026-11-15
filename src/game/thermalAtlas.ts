/** Whole-Switzerland thermal atlas for the day viewer: built once per device, stored in IndexedDB. */
import { demTileUrl, decodeTerrarium } from "./realTerrain";
import { thermalTileUrl, thermalHeat } from "./thermalRaster";
import { waterTileUrl } from "./swissMap";
import { loadRasterTile } from "./rasterTileCache";

export const ATLAS_ZOOM = 9;
const BOX = { west: 5.9, east: 10.55, south: 45.78, north: 47.85 };
const DB = "xcfly-thermal-atlas", STORE = "atlas", KEY = "ch-v1";

export interface Atlas {
  /** Global pixel origin at ATLAS_ZOOM and pixels per atlas cell. */
  px0: number; py0: number; step: number; w: number; h: number;
  elev: Float32Array; kk7: Uint8Array; lake: Uint8Array;
  nx: Float32Array; ny: Float32Array; nz: Float32Array; prom: Float32Array;
}
type Stored = Pick<Atlas, "px0" | "py0" | "step" | "w" | "h" | "elev" | "kk7" | "lake">;

const tileOf = (lat: number, lon: number) => {
  const n = 2 ** ATLAS_ZOOM, r = lat * Math.PI / 180;
  return { x: Math.floor(((lon + 180) / 360) * n), y: Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n) };
};

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function readStored(): Promise<Stored | undefined> {
  try {
    const db = await idb();
    return await new Promise((res) => {
      const q = db.transaction(STORE).objectStore(STORE).get(KEY);
      q.onsuccess = () => res(q.result as Stored | undefined); q.onerror = () => res(undefined);
    });
  } catch { return undefined; }
}
async function writeStored(s: Stored) {
  try { const db = await idb(); db.transaction(STORE, "readwrite").objectStore(STORE).put(s, KEY); } catch { /* quota */ }
  try { await navigator.storage?.persist?.(); } catch { /* optional */ }
}

/** Derived per-cell fields (normals, prominence) — cheap, recomputed after loading. */
export function deriveAtlas(s: Stored, metresPerCell: number): Atlas {
  const { w, h, elev } = s, n = w * h;
  const nx = new Float32Array(n), ny = new Float32Array(n), nz = new Float32Array(n), prom = new Float32Array(n);
  const at = (c: number, r: number) => elev[Math.min(h - 1, Math.max(0, r)) * w + Math.min(w - 1, Math.max(0, c))]!;
  // Summed-area table for a ~3 km mean → prominence.
  const sat = new Float64Array((w + 1) * (h + 1));
  for (let r = 0; r < h; r++) { let row = 0; for (let c = 0; c < w; c++) { row += elev[r * w + c]!; sat[(r + 1) * (w + 1) + c + 1] = sat[r * (w + 1) + c + 1]! + row; } }
  const R = Math.max(2, Math.round(1500 / metresPerCell));
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const i = r * w + c;
    const gx = (at(c + 1, r) - at(c - 1, r)) / (2 * metresPerCell), gy = (at(c, r - 1) - at(c, r + 1)) / (2 * metresPerCell);
    const l = 1 / Math.sqrt(gx * gx + gy * gy + 1);
    nx[i] = -gx * l; ny[i] = -gy * l; nz[i] = l;
    const c0 = Math.max(0, c - R), c1 = Math.min(w, c + R + 1), r0 = Math.max(0, r - R), r1 = Math.min(h, r + R + 1);
    const sum = sat[r1 * (w + 1) + c1]! - sat[r0 * (w + 1) + c1]! - sat[r1 * (w + 1) + c0]! + sat[r0 * (w + 1) + c0]!;
    prom[i] = elev[i]! - sum / ((c1 - c0) * (r1 - r0));
  }
  return { ...s, nx, ny, nz, prom };
}

async function tilePixels(url: string): Promise<Uint8ClampedArray | null> {
  try {
    const img = await loadRasterTile(url);
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d", { willReadFrequently: true }); if (!g) return null;
    g.drawImage(img, 0, 0, 256, 256);
    return g.getImageData(0, 0, 256, 256).data;
  } catch { return null; }
}

/** Load from device storage, or download once (DEM + KK7 + lakes) and store. */
export async function loadThermalAtlas(source: string, onProgress: (p: number) => void): Promise<{ stored: Stored; cached: boolean }> {
  const hit = await readStored();
  if (hit) return { stored: hit, cached: true };
  const a = tileOf(BOX.north, BOX.west), b = tileOf(BOX.south, BOX.east);
  const tw = b.x - a.x + 1, th = b.y - a.y + 1, step = 2;
  const w = (tw * 256) / step, h = (th * 256) / step, n = w * h;
  const elev = new Float32Array(n), kk7 = new Uint8Array(n), lake = new Uint8Array(n);
  const jobs: (() => Promise<void>)[] = [];
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    const X = a.x + tx, Y = a.y + ty;
    const put = (d: Uint8ClampedArray | null, f: (o: number, i: number) => void) => {
      if (!d) return;
      for (let r = 0; r < 256 / step; r++) for (let c = 0; c < 256 / step; c++) {
        f(((r * step) * 256 + c * step) * 4, (ty * 128 + r) * w + tx * 128 + c);
      }
    };
    jobs.push(async () => { const d = await tilePixels(demTileUrl(ATLAS_ZOOM, X, Y)); put(d, (o, i) => { elev[i] = Math.max(0, decodeTerrarium(d![o]!, d![o + 1]!, d![o + 2]!)); }); });
    jobs.push(async () => { const d = await tilePixels(thermalTileUrl(X, Y, source, ATLAS_ZOOM)); put(d, (o, i) => { kk7[i] = Math.round(255 * thermalHeat(d![o]!, d![o + 1]!, d![o + 2]!, d![o + 3]!)); }); });
    jobs.push(async () => { const d = await tilePixels(waterTileUrl(X, Y, ATLAS_ZOOM)); put(d, (o, i) => { lake[i] = d![o + 3]! > 60 ? 1 : 0; }); });
  }
  let done = 0, next = 0;
  const worker = async () => { while (next < jobs.length) { await jobs[next++]!(); onProgress(++done / jobs.length); } };
  await Promise.all(Array.from({ length: 6 }, worker));
  const stored: Stored = { px0: a.x * 256, py0: a.y * 256, step, w, h, elev, kk7, lake };
  await writeStored(stored);
  return { stored, cached: false };
}

export interface ThermalFilters { peak: boolean; sun: boolean; slope: boolean; kk7: boolean }

/** Combined lift (m/s) of the enabled sources; shared by atlas and detail rendering. */
export function combineLift(f: ThermalFilters, peak: number, sunSlope: number, slope: number, kk7: number) {
  return Math.max(f.peak ? peak : 0, f.sun ? sunSlope : 0, f.slope ? slope : 0, f.kk7 ? kk7 : 0);
}

export function ramp(v: number): [number, number, number] {
  const stops: [number, number, number][] = [[40, 90, 255], [0, 220, 230], [60, 210, 60], [255, 230, 0], [170, 0, 0]];
  const p = Math.max(0, Math.min(0.999, v)) * (stops.length - 1), k = Math.floor(p), q = p - k;
  const x = stops[k]!, y = stops[k + 1]!;
  return [x[0] + (y[0] - x[0]) * q, x[1] + (y[1] - x[1]) * q, x[2] + (y[2] - x[2]) * q];
}

/** Render the atlas for one sun position into an ImageData-sized canvas. */
export function renderAtlas(at: Atlas, sun: { x: number; y: number; z: number }, f: ThermalFilters, out: HTMLCanvasElement) {
  if (out.width !== at.w || out.height !== at.h) { out.width = at.w; out.height = at.h; }
  const ctx = out.getContext("2d"); if (!ctx) return;
  const img = ctx.createImageData(at.w, at.h), d = img.data;
  const amp = Math.sqrt(Math.max(0, sun.z) / 0.87);
  for (let i = 0, n = at.w * at.h; i < n; i++) {
    const o = i * 4, e = at.elev[i]!;
    const irr = at.nx[i]! * sun.x + at.ny[i]! * sun.y + at.nz[i]! * sun.z;
    const light = sun.z > 0 ? 0.35 + 0.65 * Math.max(0, irr) : 0.2;
    const base = (90 + 120 * Math.min(1, e / 4000)) * light;
    let lift = 0;
    if (sun.z > 0) {
      const local = Math.max(0, Math.min(1, (irr - 0.45) / 0.5));
      const pr = at.prom[i]!;
      const peak = pr > 80 ? Math.min(8, (pr / 120) * (0.6 + e / 3000)) * amp : 0;
      const sunSlope = local > 0 ? (1 + 3 * local) * amp : 0;
      const slope = local > 0.2 ? Math.min(6, (local - 0.2) * (1.5 + e / 900)) * amp : 0;
      const kk7 = at.kk7[i]! > 0 ? (2 + 5.5 * Math.max(0, (at.kk7[i]! / 255 - 0.1) / 0.9)) * amp * (0.35 + 0.65 * local) : 0;
      lift = combineLift(f, peak, sunSlope, slope, kk7);
    }
    const a = Math.max(0, Math.min(0.85, (lift - 0.8) / 2.5));
    const [cr, cg, cb] = ramp((lift - 1) / 6.5);
    let r = base * (1 - a) + cr * a, g = base * (1 - a) + cg * a, b = base * (1 - a) + cb * a;
    if (at.lake[i]) { r = r * 0.6 + 90 * 0.4; g = g * 0.6 + 160 * 0.4; b = b * 0.6 + 235 * 0.4; }
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
