import { EXTENT, N, RES, finalizeTerrain, type Terrain } from "./terrain";
import { mapOrigin, MERCATOR_EXTENT } from "./swissMap";
import type { Site } from "./sites";

/** Open Terrarium elevation tiles (AWS Open Data, CORS-enabled). */
export const DEM_ZOOM = 12;
export const demTileUrl = (z: number, x: number, y: number) =>
  `https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${z}/${x}/${y}.png`;

export function decodeTerrarium(r: number, g: number, b: number) {
  return r * 256 + g + b / 256 - 32768;
}

/** Global pixel coordinate (at DEM_ZOOM) of a launch-relative point in metres. */
export function localToPixel(site: Pick<Site, "lat" | "lon">, x: number, y: number, z = DEM_ZOOM) {
  const o = mapOrigin(site);
  const mx = o.x + x / o.scale, my = o.y + y / o.scale;
  const world = 256 * 2 ** z;
  return { px: ((mx + MERCATOR_EXTENT) / (2 * MERCATOR_EXTENT)) * world, py: ((MERCATOR_EXTENT - my) / (2 * MERCATOR_EXTENT)) * world };
}

/** Fill the simulation height grid from a pixel sampler (pure, testable). */
export function buildHeightGrid(site: Pick<Site, "lat" | "lon">, sample: (px: number, py: number) => number) {
  const h = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    const y = EXTENT - j * RES;
    for (let i = 0; i < N; i++) {
      const { px, py } = localToPixel(site, i * RES - EXTENT, y);
      h[j * N + i] = Math.max(0, sample(px, py));
    }
  }
  return h;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("DEM tile failed: " + url));
    img.src = url;
  });
}

/** Loads real elevation around the launch (browser only). */
export async function loadRealTerrain(site: Site): Promise<Terrain> {
  const a = localToPixel(site, -EXTENT, EXTENT), b = localToPixel(site, EXTENT, -EXTENT);
  const tx0 = Math.floor(a.px / 256), ty0 = Math.floor(a.py / 256);
  const tx1 = Math.floor(b.px / 256), ty1 = Math.floor(b.py / 256);
  const w = (tx1 - tx0 + 1) * 256, hgt = (ty1 - ty0 + 1) * 256;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = hgt;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const jobs: Promise<void>[] = [];
  for (let ty = ty0; ty <= ty1; ty++)
    for (let tx = tx0; tx <= tx1; tx++)
      jobs.push(loadImage(demTileUrl(DEM_ZOOM, tx, ty)).then((img) => ctx.drawImage(img, (tx - tx0) * 256, (ty - ty0) * 256)));
  await Promise.all(jobs);
  const data = ctx.getImageData(0, 0, w, hgt).data;
  const at = (x: number, y: number) => {
    const xi = Math.max(0, Math.min(w - 1, x)), yi = Math.max(0, Math.min(hgt - 1, y));
    const k = (yi * w + xi) * 4;
    return decodeTerrarium(data[k], data[k + 1], data[k + 2]);
  };
  const ox = tx0 * 256, oy = ty0 * 256;
  const h = buildHeightGrid(site, (px, py) => {
    const fx = px - ox - 0.5, fy = py - oy - 0.5;
    const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    const p = at(i, j), q = at(i + 1, j), r = at(i, j + 1), s = at(i + 1, j + 1);
    return p + (q - p) * u + (r - p) * v + (p - q - r + s) * u * v;
  });
  return finalizeTerrain(site, h);
}
