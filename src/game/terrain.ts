import type { Site } from "./sites";

export const EXTENT = 20000; // metres from launch in each direction
export const RES = 25; // metres per grid cell
export const N = (EXTENT * 2) / RES + 1;
export const CB_CELL = 1000;
export const CLOUDBASE_OFFSET = 500;

export interface Terrain {
  h: Float32Array;
  cb: Float32Array; // cloudbase per 1km cell
  cbN: number;
  site: Site;
}

function hash2(ix: number, iy: number, seed: number) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 982451653);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function vnoise(x: number, y: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function ridged(x: number, y: number, seed: number) {
  let sum = 0, amp = 1, f = 1, norm = 0;
  for (let o = 0; o < 4; o++) {
    let n = 1 - Math.abs(vnoise(x * f, y * f, seed + o) * 2 - 1);
    n *= n;
    sum += n * amp; norm += amp; amp *= 0.5; f *= 2.1;
  }
  return sum / norm;
}

function fbm(x: number, y: number, seed: number) {
  let sum = 0, amp = 1, f = 1, norm = 0;
  for (let o = 0; o < 3; o++) {
    sum += vnoise(x * f, y * f, seed + 100 + o) * amp;
    norm += amp; amp *= 0.5; f *= 2;
  }
  return sum / norm;
}

export function generateTerrain(site: Site): Terrain {
  const h = new Float32Array(N * N);
  let mn = Infinity, mx = -Infinity;
  for (let j = 0; j < N; j++) {
    const y = EXTENT - j * RES;
    for (let i = 0; i < N; i++) {
      const x = i * RES - EXTENT;
      const s = 0.68 * ridged(x / 7000, y / 7000, site.seed) + 0.32 * fbm(x / 2200, y / 2200, site.seed);
      h[j * N + i] = s;
      if (s < mn) mn = s;
      if (s > mx) mx = s;
    }
  }
  const range = site.peak - site.valley;
  for (let k = 0; k < h.length; k++) {
    const s = (h[k] - mn) / (mx - mn);
    h[k] = site.valley + range * Math.pow(s, 1.7);
  }
  // Ensure launch sits at the real launch altitude
  const c = (N - 1) / 2;
  const h0 = h[c * N + c];
  const delta = site.launchAlt - h0;
  const sig2 = 2 * 900 * 900;
  const rad = Math.ceil(3000 / RES);
  for (let j = c - rad; j <= c + rad; j++) {
    for (let i = c - rad; i <= c + rad; i++) {
      const dx = (i - c) * RES, dy = (j - c) * RES;
      h[j * N + i] = Math.max(site.valley, h[j * N + i] + delta * Math.exp(-(dx * dx + dy * dy) / sig2));
    }
  }
  return finalizeTerrain(site, h);
}

/** Wraps a height grid (N×N, row 0 = north) and derives cloudbase. */
export function finalizeTerrain(site: Site, h: Float32Array): Terrain {
  // Cloudbase: local max peak (±2km) + 500 m
  const cbN = (EXTENT * 2) / CB_CELL;
  const cellMax = new Float32Array(cbN * cbN);
  const per = CB_CELL / RES;
  for (let j = 0; j < N - 1; j++) {
    const cj = Math.min(cbN - 1, Math.floor(j / per));
    for (let i = 0; i < N - 1; i++) {
      const ci = Math.min(cbN - 1, Math.floor(i / per));
      const v = h[j * N + i];
      if (v > cellMax[cj * cbN + ci]) cellMax[cj * cbN + ci] = v;
    }
  }
  const cb = new Float32Array(cbN * cbN);
  for (let cj = 0; cj < cbN; cj++)
    for (let ci = 0; ci < cbN; ci++) {
      let m = 0;
      for (let dj = -2; dj <= 2; dj++)
        for (let di = -2; di <= 2; di++) {
          const a = ci + di, b = cj + dj;
          if (a >= 0 && b >= 0 && a < cbN && b < cbN) m = Math.max(m, cellMax[b * cbN + a]);
        }
      cb[cj * cbN + ci] = cloudbaseFromPeak(m);
    }
  return { h, cb, cbN, site };
}

export function cloudbaseFromPeak(peak: number) {
  return peak + CLOUDBASE_OFFSET;
}

export function heightAt(t: Terrain, x: number, y: number) {
  const fi = Math.max(0, Math.min(N - 1.001, (x + EXTENT) / RES));
  const fj = Math.max(0, Math.min(N - 1.001, (EXTENT - y) / RES));
  const i = Math.floor(fi), j = Math.floor(fj);
  const u = fi - i, v = fj - j;
  const a = t.h[j * N + i], b = t.h[j * N + i + 1];
  const c = t.h[(j + 1) * N + i], d = t.h[(j + 1) * N + i + 1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** dh/dx (east), dh/dy (north) */
export function gradientAt(t: Terrain, x: number, y: number) {
  const e = RES * 2;
  return {
    gx: (heightAt(t, x + e, y) - heightAt(t, x - e, y)) / (2 * e),
    gy: (heightAt(t, x, y + e) - heightAt(t, x, y - e)) / (2 * e),
  };
}

export function normalAt(t: Terrain, x: number, y: number) {
  const { gx, gy } = gradientAt(t, x, y);
  const l = Math.hypot(gx, gy, 1);
  return { x: -gx / l, y: -gy / l, z: 1 / l };
}

export function cloudbaseAt(t: Terrain, x: number, y: number) {
  const ci = Math.max(0, Math.min(t.cbN - 1, Math.floor((x + EXTENT) / CB_CELL)));
  const cj = Math.max(0, Math.min(t.cbN - 1, Math.floor((EXTENT - y) / CB_CELL)));
  return t.cb[cj * t.cbN + ci];
}

/** Swiss-topo style shaded relief with contour lines (browser only). */
export function renderTerrain(t: Terrain): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = N - 1;
  canvas.height = N - 1;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(N - 1, N - 1);
  const d = img.data;
  const { valley } = t.site;
  const L = { x: -0.6, y: 0.6, z: 0.53 }; // NW light
  for (let j = 0; j < N - 1; j++) {
    for (let i = 0; i < N - 1; i++) {
      const k = j * N + i;
      const hv = t.h[k];
      const gx = (t.h[k + 1] - hv) / RES;
      const gy = (hv - t.h[k + N]) / RES;
      const l = Math.hypot(gx, gy, 1);
      const shade = Math.max(0, (-gx * L.x - gy * L.y + L.z) / l);
      let r: number, g: number, b: number;
      if (t.site.lake && hv < valley + 12) { r = 120; g = 170; b = 205; }
      else if (hv < 1300) { r = 176; g = 204; b = 146; }
      else if (hv < 1900) { const f = (hv - 1300) / 600; r = 176 + 50 * f; g = 204 + 8 * f; b = 146 + 26 * f; }
      else if (hv < 2600) { const f = (hv - 1900) / 700; r = 226 - 30 * f; g = 212 - 26 * f; b = 172 + 2 * f; }
      else { const f = Math.min(1, (hv - 2600) / 300); r = 196 + 52 * f; g = 186 + 64 * f; b = 174 + 78 * f; }
      const m = 0.55 + 0.62 * shade;
      r *= m; g *= m; b *= m;
      const band = Math.floor(hv / 100);
      if (band !== Math.floor(t.h[k + 1] / 100) || band !== Math.floor(t.h[k + N] / 100)) {
        const major = Math.floor(hv / 500) !== Math.floor(t.h[k + 1] / 500) || Math.floor(hv / 500) !== Math.floor(t.h[k + N] / 500);
        const f = major ? 0.62 : 0.82;
        r = r * f + 40 * (1 - f); g = g * f + 20 * (1 - f); b *= f;
      }
      const p = (j * (N - 1) + i) * 4;
      d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
