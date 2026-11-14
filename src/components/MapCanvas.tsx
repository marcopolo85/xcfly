import { forwardRef } from "react";
import type { Site } from "@/game/sites";
import { drawSwissRelief } from "./SwissRelief";
import { POLAR, type Sim } from "@/game/physicsEngine";
import { EXTENT, N, RES, heightAt, type Terrain } from "@/game/terrain";
import type { ZoomTransform } from "d3-zoom";
import type { ThermalMap } from "@/game/loadThermalRaster";
import { mapOrigin, MERCATOR_EXTENT } from "@/game/swissMap";
import { THERMAL_ZOOM } from "@/game/thermalRaster";
import { regionalTileImage, requestRegionalTile } from "@/game/loadThermalRegion";
import { CLOSING_RATIO, type XcTriangle } from "@/game/xcTriangle";
import wingUrl from "@/assets/glider-wing.png";
import { AIRSPACE_COLORS, formatLimitM, insideVertical, type Airspace } from "@/game/airspace";
import { GLIDE_BOUNDARY_RAYS, traceGlideBoundary } from "@/game/glideBoundary";

const glideBoundaryPoints = new Float64Array(GLIDE_BOUNDARY_RAYS * 2);

/** Bright, well-separated colours for other live pilots (wing and track share it). */
export const PILOT_COLORS = ["#4ade80", "#38bdf8", "#ef4444", "#f97316", "#a3e635", "#ffffff", "#cbd5e1"];
export function pilotColor(id: string) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0; return PILOT_COLORS[Math.abs(h) % PILOT_COLORS.length]; }
const tintedWings = new Map<string, HTMLCanvasElement>();
function tintedWing(wing: HTMLImageElement, color: string, metallic = false) {
  const key = metallic ? `${color}|m` : color;
  let c = tintedWings.get(key);
  if (c) return c;
  // Keep the wing's details: luminance × colour, then a dark contour behind it.
  const w = wing.naturalWidth, h = wing.naturalHeight, pad = Math.max(2, Math.round(w / 40));
  const body = document.createElement("canvas"); body.width = w; body.height = h;
  const b = body.getContext("2d")!;
  b.filter = "grayscale(1) brightness(1.35) contrast(1.15)"; b.drawImage(wing, 0, 0); b.filter = "none";
  b.globalCompositeOperation = "multiply"; b.fillStyle = color; b.fillRect(0, 0, w, h);
  b.globalCompositeOperation = "destination-in"; b.drawImage(wing, 0, 0);
  if (metallic) {
    // Brushed-metal sheen: diagonal highlight bands clipped to the wing surface.
    const grad = b.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "rgba(255,255,255,0.75)");
    grad.addColorStop(0.3, "rgba(255,255,255,0.08)");
    grad.addColorStop(0.55, "rgba(0,0,0,0.22)");
    grad.addColorStop(0.78, "rgba(255,255,255,0.45)");
    grad.addColorStop(1, "rgba(0,0,0,0.12)");
    b.globalCompositeOperation = "source-atop"; b.fillStyle = grad; b.fillRect(0, 0, w, h);
  }
  const sil = document.createElement("canvas"); sil.width = w; sil.height = h;
  const si = sil.getContext("2d")!;
  si.drawImage(wing, 0, 0); si.globalCompositeOperation = "source-in"; si.fillStyle = "#0b1220"; si.fillRect(0, 0, w, h);
  c = document.createElement("canvas"); c.width = w + 2 * pad; c.height = h + 2 * pad;
  const g = c.getContext("2d")!;
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; g.drawImage(sil, pad + Math.cos(a) * pad, pad + Math.sin(a) * pad); }
  g.drawImage(body, pad, pad);
  tintedWings.set(key, c);
  return c;
}

let wingImage: HTMLImageElement | null = null;
function getWingImage() {
  if (!wingImage) {
    wingImage = new Image();
    wingImage.src = wingUrl;
  }
  return wingImage.complete && wingImage.naturalWidth > 0 ? wingImage : null;
}

export const ZOOM = 0.085; // px per metre (CSS px)

interface ContourGeometry { minor: Path2D; major: Path2D; minHeight: number; maxHeight: number }
const contourCache = new WeakMap<Terrain, Map<string, ContourGeometry>>();

/** Subtle contour lines (100 m, major every 500 m) from the simulation terrain grid.
 * On top, one contour is traced at exactly the glider's current altitude, so the
 * pilot sees the terrain line he can currently fly through. */
function drawContours(ctx: CanvasRenderingContext2D, t: Terrain, sx: (x: number) => number, sy: (y: number) => number, z: number, xMin: number, xMax: number, yMin: number, yMax: number, gliderAlt: number) {
  const step = Math.max(1, Math.round(4 / (RES * z))); // keep cells a few px apart at any zoom
  const centerX = t.centerX ?? 0, centerY = t.centerY ?? 0;
  // Aligned padded windows allow world-space paths to survive movement and panning.
  const block = Math.max(32, step * 8);
  const i0 = Math.max(0, Math.floor((xMin - centerX + EXTENT) / RES / block) * block);
  const i1 = Math.min(N - 1, Math.ceil((xMax - centerX + EXTENT) / RES / block) * block);
  const j0 = Math.max(0, Math.floor((EXTENT - yMax + centerY) / RES / block) * block);
  const j1 = Math.min(N - 1, Math.ceil((EXTENT - yMin + centerY) / RES / block) * block);
  if (i1 - i0 < step || j1 - j0 < step) return;
  const exact = new Path2D();
  const h = t.h;
  /** Marching-squares pass: collect edge-crossing segments for one contour level. */
  const traceLevel = (level: number, path: Path2D) => {
    for (let j = j0; j < j1; j += step) {
      const j2 = Math.min(j + step, N - 1);
      for (let i = i0; i < i1; i += step) {
        const i2 = Math.min(i + step, N - 1);
        const h00 = h[j * N + i], h10 = h[j * N + i2], h01 = h[j2 * N + i], h11 = h[j2 * N + i2];
        const x0 = centerX + i * RES - EXTENT, x1 = centerX + i2 * RES - EXTENT;
        const y0 = centerY + EXTENT - j * RES, y1 = centerY + EXTENT - j2 * RES;
        // Trace the same edge order without allocating crossing arrays per cell.
        let crossings = 0;
        if ((h00 - level) * (h10 - level) < 0) {
          path.moveTo(x0 + ((level - h00) / (h10 - h00)) * (x1 - x0), y0);
          crossings++;
        }
        if ((h10 - level) * (h11 - level) < 0) {
          const y = y0 + ((level - h10) / (h11 - h10)) * (y1 - y0);
          if (crossings % 2 === 0) path.moveTo(x1, y); else path.lineTo(x1, y);
          crossings++;
        }
        if ((h01 - level) * (h11 - level) < 0) {
          const x = x0 + ((level - h01) / (h11 - h01)) * (x1 - x0);
          if (crossings % 2 === 0) path.moveTo(x, y1); else path.lineTo(x, y1);
          crossings++;
        }
        if ((h00 - level) * (h01 - level) < 0) {
          const y = y0 + ((level - h00) / (h01 - h00)) * (y1 - y0);
          if (crossings % 2 === 0) path.moveTo(x0, y); else path.lineTo(x0, y);
        }
      }
    }
  };
  let cache = contourCache.get(t);
  if (!cache) { cache = new Map(); contourCache.set(t, cache); }
  const key = `${step}:${i0}:${i1}:${j0}:${j1}`;
  let geometry = cache.get(key);
  if (!geometry) {
    let minHeight = Infinity, maxHeight = -Infinity;
    for (let j = j0; j <= j1; j += step) for (let i = i0; i <= i1; i += step) {
      const value = h[j * N + i];
      minHeight = Math.min(minHeight, value); maxHeight = Math.max(maxHeight, value);
    }
    const minor = new Path2D(), major = new Path2D();
    for (let level = Math.ceil(minHeight / 100) * 100; level <= maxHeight; level += 100) {
      traceLevel(level, level % 500 === 0 ? major : minor);
    }
    geometry = { minor, major, minHeight, maxHeight };
    if (cache.size >= 6) { const oldest = cache.keys().next().value; if (oldest !== undefined) cache.delete(oldest); }
    cache.set(key, geometry);
  }
  const { minor, major, minHeight, maxHeight } = geometry;
  ctx.save();
  ctx.translate(sx(0), sy(0));
  ctx.scale(z, -z);
  ctx.lineWidth = 1 / z;
  ctx.strokeStyle = "rgba(120,80,40,0.16)";
  ctx.stroke(minor);
  ctx.strokeStyle = "rgba(120,80,40,0.3)";
  ctx.stroke(major);
  // contour at exactly the glider's altitude: dark under-stroke for contrast, then a bright orange core
  if (gliderAlt > minHeight && gliderAlt < maxHeight) {
    traceLevel(gliderAlt, exact);
    ctx.lineWidth = 4 / z;
    ctx.strokeStyle = "rgba(20,30,60,0.6)";
    ctx.stroke(exact);
    ctx.lineWidth = 2 / z;
    ctx.strokeStyle = "rgba(255,120,20,0.95)";
    ctx.stroke(exact);
  }
  ctx.restore();
}

export interface SceneData {
  site: Site;
  terrain: Terrain;
  sim: Sim;
  trail: { x: number; y: number; vz: number }[];
  dusk: number; // 0..1 darkness
  thermalMap?: ThermalMap | null;
  thermalAlpha?: number; // 0..1 opacity of the thermal overlay
  triangle?: XcTriangle | null;
  showProfile?: boolean; // when the side profile is visible, keep the glider in the upper third of the screen
  anchorFraction?: number;
  airspaces?: Airspace[] | null;
  airspaceLabels?: boolean; // toggle for airspace edge labels, independent of the airspace fill
  glideVz?: number; // same smoothed vertical speed displayed by the GPS
  others?: { x: number; y: number; alt: number; heading: number; name: string; color?: string; metallic?: boolean; trail?: { x: number; y: number }[] | undefined }[] | undefined;
  task?: { local: { x: number; y: number }[]; next: number; radius: number } | null;
  mapAlpha?: number; // relief map opacity 0..1
  sun?: { x: number; y: number; z: number };
  visYaw: number; // drawn glider rotation: one turn per second at most while thermalling
}

const airspacePaths = new WeakMap<Airspace, Path2D>();
function airspacePath(a: Airspace) {
  let p = airspacePaths.get(a);
  if (!p) {
    p = new Path2D();
    const path = p;
    for (const r of a.rings) {
      r.forEach((pt, i) => (i ? path.lineTo(pt.x, pt.y) : path.moveTo(pt.x, pt.y)));
      path.closePath();
    }
    airspacePaths.set(a, p);
  }
  return p;
}

/** Point on the airspace boundary closest to the glider, with the edge tangent angle and an
 * inward-pointing normal so the label sits just inside the area.
 * Recomputed every frame so the label follows without delay; a light glide only softens
 * the discontinuity when the closest edge segment changes (e.g. at corners). */
interface EdgeLabel { gx: number; gy: number; x: number; y: number; ang: number; dx: number; dy: number; dang: number; nx: number; ny: number }
const edgeLabelCache = new WeakMap<Airspace, EdgeLabel>();
const LABEL_INSET = 45; // m inside the boundary (used to detect the inward direction)
const CORNER_MARGIN = 250; // m kept along the edge away from vertices/corners
/** Even-odd point-in-polygon over all rings (matches the fill rule). */
function pointInAirspace(a: Airspace, x: number, y: number) {
  let inside = false;
  for (const r of a.rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const p = r[i], q = r[j];
      if (p.y > y !== q.y > y && x < ((q.x - p.x) * (y - p.y)) / (q.y - p.y) + p.x) inside = !inside;
    }
  }
  return inside;
}
function edgeLabelPoint(a: Airspace, gx: number, gy: number): EdgeLabel {
  let bx = a.label.x, by = a.label.y, bdx = 1, bdy = 0, bestD = Infinity;
  let bpx = bx, bpy = by, bt = 0;
  for (const r of a.rings) {
    for (let i = 0; i < r.length; i++) {
      const p = r[i], q = r[(i + 1) % r.length];
      const dx = q.x - p.x, dy = q.y - p.y;
      const len2 = dx * dx + dy * dy;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((gx - p.x) * dx + (gy - p.y) * dy) / len2)) : 0;
      const x = p.x + t * dx, y = p.y + t * dy;
      const d = (x - gx) * (x - gx) + (y - gy) * (y - gy);
      if (d < bestD) { bestD = d; bx = x; by = y; bdx = dx; bdy = dy; bpx = p.x; bpy = p.y; bt = t; }
    }
  }
  // keep the anchor away from corners: clamp it at least CORNER_MARGIN along the edge
  const segLen = Math.hypot(bdx, bdy);
  if (segLen > 2 * CORNER_MARGIN) {
    const t = Math.min(Math.max(bt, CORNER_MARGIN / segLen), 1 - CORNER_MARGIN / segLen);
    bx = bpx + t * bdx;
    by = bpy + t * bdy;
  }
  // screen-space tangent angle (world y points up, screen y down), kept readable (not upside down)
  let ang = Math.atan2(-bdy, bdx);
  if (ang > Math.PI / 2) ang -= Math.PI;
  if (ang < -Math.PI / 2) ang += Math.PI;
  // inward normal: perpendicular to the edge, flipped until it points into the area
  const bl = Math.hypot(bdx, bdy) || 1;
  let nx = -bdy / bl, ny = bdx / bl;
  if (!pointInAirspace(a, bx + nx * LABEL_INSET, by + ny * LABEL_INSET)) { nx = -nx; ny = -ny; }
  let e = edgeLabelCache.get(a);
  if (!e) {
    e = { gx, gy, x: bx, y: by, ang, dx: bx, dy: by, dang: ang, nx, ny };
    edgeLabelCache.set(a, e);
    return e;
  }
  e.gx = gx; e.gy = gy; e.x = bx; e.y = by; e.ang = ang; e.nx = nx; e.ny = ny;
  // light glide: softens segment switches without noticeable delay
  const k = 0.35;
  e.dx += (e.x - e.dx) * k;
  e.dy += (e.y - e.dy) * k;
  let da = e.ang - e.dang;
  if (da > Math.PI / 2) da -= Math.PI;
  if (da < -Math.PI / 2) da += Math.PI;
  e.dang += da * k;
  return e;
}

/** Airspaces at 15 % opacity, labelled along the edge nearest the glider with lower/upper
 * limit; spaces whose vertical band contains the glider altitude get a solid coloured border. */
function drawAirspaces(ctx: CanvasRenderingContext2D, list: Airspace[], gx: number, gy: number, alt: number, ground: number, sx: (x: number) => number, sy: (y: number) => number, z: number, W: number, H: number, showLabels: boolean) {
  const labels: { a: Airspace; active: boolean }[] = [];
  for (const a of list) {
    const [r, g, b] = AIRSPACE_COLORS[a.kind];
    const active = insideVertical(a, alt, ground);
    const path = airspacePath(a);
    ctx.save();
    ctx.translate(sx(0), sy(0));
    ctx.scale(z, -z);
    ctx.fillStyle = `rgba(${r},${g},${b},0.15)`;
    ctx.fill(path, "evenodd");
    ctx.lineWidth = (active ? 3 : 0.8) / z;
    ctx.strokeStyle = active ? `rgba(${r},${g},${b},0.95)` : `rgba(${r},${g},${b},0.35)`;
    ctx.stroke(path);
    ctx.restore();
    labels.push({ a, active });
  }
  if (!showLabels) return;
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "center";
  for (const { a, active } of labels) {
    const edge = edgeLabelPoint(a, gx, gy);
    if (z < 0.02 && a.kind === "AD") continue;
    const [r, g, b] = AIRSPACE_COLORS[a.kind];
    const name = a.kind === "AD" ? a.name : `${a.kind} ${a.name.replace(/^(CTR|TMA|CTA|FIZ)\s*/, "")}`;
    const text = `${name}  ${formatLimitM(a.lower)} – ${formatLimitM(a.upper)}`;
    // push the label inwards until the whole text box lies inside the airspace; skip if it never fits
    const hw = (ctx.measureText(text).width / 2 + 3) / z; // half text width in m
    const hh = 9 / z; // half text height in m
    const tx = edge.ny, ty = -edge.nx; // unit tangent along the edge (world coords)
    let cx = 0, cy = 0, fits = false;
    for (let inset = 16 / z, tries = 0; tries < 12; tries++, inset += hh) {
      cx = edge.dx + edge.nx * inset;
      cy = edge.dy + edge.ny * inset;
      fits = true;
      for (const st of [-1, 1]) {
        for (const sn of [-1, 1]) {
          if (!pointInAirspace(a, cx + tx * hw * st + edge.nx * hh * sn, cy + ty * hw * st + edge.ny * hh * sn)) { fits = false; break; }
        }
        if (!fits) break;
      }
      if (fits) break;
    }
    if (!fits) continue;
    const lx = sx(cx), ly = sy(cy);
    if (lx < -120 || lx > W + 120 || ly < -30 || ly > H + 30) continue;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(edge.dang);
    // plain text inside the area — no frame, no background
    ctx.fillStyle = active ? `rgb(${r},${g},${b})` : `rgb(${r * 0.55},${g * 0.55},${b * 0.55})`;
    ctx.fillText(text, 0, 3);
    ctx.restore();
  }
}

interface Sector { path: Path2D; minP: number; maxP: number; lx: number; ly: number }
const sectorCache = new Map<string, Sector>();
/** World-space region (on the side of `ref`) where a third vertex makes a-b-C a FAI triangle. */
function faiSector(a: { x: number; y: number }, b: { x: number; y: number }, ref: { x: number; y: number }): Sector {
  const key = `${a.x | 0},${a.y | 0},${b.x | 0},${b.y | 0},${ref.x | 0},${ref.y | 0}`;
  const hit = sectorCache.get(key);
  if (hit) return hit;
  const path = new Path2D();
  const L = Math.hypot(b.x - a.x, b.y - a.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  let minP = Infinity, maxP = 0, lx = mx, ly = my;
  if (L > 1) {
    const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
    let vx = -uy, vy = ux; // unit normal, flipped so it points at `ref`
    if ((b.x - a.x) * (ref.y - a.y) - (b.y - a.y) * (ref.x - a.x) < 0) { vx = uy; vy = -ux; }
    const px = (s: number, t: number) => mx + s * ux + t * vx;
    const py = (s: number, t: number) => my + s * uy + t * vy;
    // FAI region for third vertex C (leg frame, s along leg, t towards ref):
    // d1 ≥ 0.28P, d2 ≥ 0.28P and this leg L ≥ 0.28P  ⇒ bounded by three curved edges.
    const inside = (s: number, t: number) => {
      if (t <= 0) return false;
      const d1 = Math.hypot(s + L / 2, t), d2 = Math.hypot(s - L / 2, t);
      const P = L + d1 + d2;
      return d1 >= 0.28 * P && d2 >= 0.28 * P && L >= 0.28 * P;
    };
    const cs = 0, ct = (L * Math.sqrt(3)) / 2; // equilateral apex, inside and central
    const N = 360, maxR = 2 * L, step = L / 40;
    for (let i = 0; i < N; i++) {
      const a2 = (i / N) * Math.PI * 2, ca = Math.cos(a2), sa = Math.sin(a2);
      let lo = 0, hi = step;
      while (hi < maxR && inside(cs + hi * ca, ct + hi * sa)) { lo = hi; hi += step; }
      for (let k = 0; k < 20; k++) {
        const mid = (lo + hi) / 2;
        if (inside(cs + mid * ca, ct + mid * sa)) lo = mid; else hi = mid;
      }
      const s = cs + lo * ca, t = ct + lo * sa;
      if (i === 0) path.moveTo(px(s, t), py(s, t)); else path.lineTo(px(s, t), py(s, t));
    }
    path.closePath();
    minP = (25 / 11) * L; // smallest valid perimeter, at the notch apex
    maxP = (25 / 7) * L; // this leg exactly 28 % of perimeter (outer edge)
    const tTop = Math.sqrt(Math.max(0, (9 / 7) ** 2 - 0.25)) * L;
    lx = px(0, tTop);
    ly = py(0, tTop);
  }

  const sec = { path, minP, maxP, lx, ly };
  if (sectorCache.size > 12) sectorCache.clear();
  sectorCache.set(key, sec);
  return sec;
}

const SECTOR_COLORS = ["rgba(90,200,120,0.35)", "rgba(60,120,240,0.35)", "rgba(140,110,240,0.35)"];
const SECTOR_EDGE = ["rgba(30,150,80,0.95)", "rgba(30,90,220,0.95)", "rgba(100,80,210,0.95)"];

function drawTriangle(ctx: CanvasRenderingContext2D, t: XcTriangle, sx: (x: number) => number, sy: (y: number) => number, z: number) {
  const sectors = [faiSector(t.b, t.c, t.a), faiSector(t.c, t.a, t.b), faiSector(t.a, t.b, t.c)];
  sectors.forEach((sec, i) => {
    ctx.save();
    ctx.translate(sx(0), sy(0));
    ctx.scale(z, -z);
    ctx.fillStyle = SECTOR_COLORS[i];
    ctx.fill(sec.path);
    ctx.lineWidth = 1.2 / z;
    ctx.strokeStyle = SECTOR_EDGE[i];
    ctx.stroke(sec.path);
    ctx.restore();
  });
  const col = t.fai ? "rgba(40,110,255,0.95)" : "rgba(30,170,60,0.95)";
  ctx.strokeStyle = col; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx(t.a.x), sy(t.a.y)); ctx.lineTo(sx(t.b.x), sy(t.b.y)); ctx.lineTo(sx(t.c.x), sy(t.c.y)); ctx.closePath();
  ctx.stroke();
  // closing cylinder around the triangle start
  ctx.setLineDash([8, 5]);
  ctx.strokeStyle = "rgba(230,40,40,0.9)";
  ctx.beginPath(); ctx.arc(sx(t.a.x), sy(t.a.y), CLOSING_RATIO * t.perimeter * z, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
}

/** Coarse world-space sun/shade overlay of the loaded terrain, cached per terrain and quantized sun. */
const shadeCache = new WeakMap<Terrain, { key: number; canvas: HTMLCanvasElement }>();
const SHADE_STEP = 100;
function sunShade(t: Terrain, sun: { x: number; y: number; z: number }) {
  const key = Math.round(sun.x * 20) * 1e4 + Math.round(sun.y * 20) * 100 + Math.round(sun.z * 20);
  const hit = shadeCache.get(t);
  if (hit && hit.key === key) return hit.canvas;
  const n = Math.round((2 * EXTENT) / SHADE_STEP);
  const c = hit?.canvas ?? document.createElement("canvas");
  c.width = n; c.height = n;
  const g = c.getContext("2d");
  if (!g) return c;
  const img = g.createImageData(n, n);
  const ox = (t.centerX ?? 0) - EXTENT, oy = (t.centerY ?? 0) + EXTENT;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const nm = normalAt(t, ox + (i + 0.5) * SHADE_STEP, oy - (j + 0.5) * SHADE_STEP);
    const irr = nm.x * sun.x + nm.y * sun.y + nm.z * sun.z;
    const o = (j * n + i) * 4;
    if (irr > 0.85) { img.data[o] = 255; img.data[o + 1] = 200; img.data[o + 2] = 80; img.data[o + 3] = Math.min(70, (irr - 0.85) * 600); }
    else if (irr < 0.6) { img.data[o] = 20; img.data[o + 1] = 30; img.data[o + 2] = 70; img.data[o + 3] = Math.min(90, (0.6 - irr) * 220); }
  }
  g.putImageData(img, 0, 0);
  shadeCache.set(t, { key, canvas: c });
  return c;
}

export function drawScene(canvas: HTMLCanvasElement, s: SceneData, view: ZoomTransform) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const z = ZOOM * view.k;
  const { sim } = s;
  const anchorF = s.anchorFraction ?? (s.showProfile ? 1 / 3 : 1 / 2);
  const cx = view.applyX(W / 2), cy = view.applyY(H * anchorF);
  const sx = (x: number) => cx + (x - sim.x) * z;
  const sy = (y: number) => cy - (y - sim.y) * z;

  const theme = getComputedStyle(canvas);
  ctx.fillStyle = theme.getPropertyValue("--background").trim();
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  // relief tiles are laid out around screen point (W/2, 0.55·H): pass the world position under that point
  ctx.globalAlpha = s.mapAlpha ?? 1;
  const map = drawSwissRelief(ctx, s.site, sim.x + (W / 2 - cx) / z, sim.y + (cy - H * 0.55) / z, W, H, z, dpr);
  ctx.globalAlpha = 1;
  if (!map.loaded) {
    ctx.fillStyle = theme.getPropertyValue("--foreground").trim();
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(map.failed ? "Karte nicht erreichbar · erneuter Versuch folgt" : "Schweizer Reliefkarte lädt…", W / 2, H * 0.65);
  }
  if (s.sun && s.sun.z > 0) {
    const shadeCanvas = sunShade(s.terrain, s.sun);
    const left = (s.terrain.centerX ?? 0) - EXTENT, top = (s.terrain.centerY ?? 0) + EXTENT;
    ctx.drawImage(shadeCanvas, sx(left), sy(top), 2 * EXTENT * z, 2 * EXTENT * z);
  }
  drawContours(ctx, s.terrain, sx, sy, z, sim.x - cx / z, sim.x + (W - cx) / z, sim.y - (H - cy) / z, sim.y + cy / z, sim.alt);

  // thermal map
  if (s.thermalMap && (s.thermalAlpha ?? 1) > 0) {
    const { raster, image } = s.thermalMap;
    const origin = mapOrigin(s.site);
    const metresPerPixel = 2 * MERCATOR_EXTENT / (256 * 2 ** THERMAL_ZOOM);
    const left = (raster.left * metresPerPixel - MERCATOR_EXTENT - origin.x) * origin.scale;
    const top = (MERCATOR_EXTENT - raster.top * metresPerPixel - origin.y) * origin.scale;
    ctx.globalAlpha = s.thermalAlpha ?? 1;
    if (image) ctx.drawImage(image, sx(left), sy(top), raster.width * metresPerPixel * origin.scale * z, raster.height * metresPerPixel * origin.scale * z);
    if (s.thermalMap.regionalTiles) {
      const size = 256 * metresPerPixel * origin.scale * z;
      const leftPx = sx(left), topPx = sy(top);
      const firstX = raster.left / 256, firstY = raster.top / 256;
      const x0 = Math.max(firstX, firstX + Math.floor(-leftPx / size));
      const x1 = Math.min(firstX + raster.width / 256 - 1, firstX + Math.floor((W - leftPx) / size));
      const y0 = Math.max(firstY, firstY + Math.floor(-topPx / size));
      const y1 = Math.min(firstY + raster.height / 256 - 1, firstY + Math.floor((H - topPx) / size));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const tile = s.thermalMap.regionalTiles.get(`${x},${y}`);
        if (!tile) { requestRegionalTile(x, y).catch(() => {}); continue; }
        const tx = sx((tile.x * 256 * metresPerPixel - MERCATOR_EXTENT - origin.x) * origin.scale);
        const ty = sy((MERCATOR_EXTENT - tile.y * 256 * metresPerPixel - origin.y) * origin.scale);
        if (tx + size < 0 || ty + size < 0 || tx > W || ty > H) continue;
        const surface = regionalTileImage(tile, size);
        if (surface) ctx.drawImage(surface, tx, ty, size + 0.5, size + 0.5);
      }
    }
    ctx.globalAlpha = 1;
  }

  if (s.airspaces?.length) drawAirspaces(ctx, s.airspaces, sim.x, sim.y, sim.alt, heightAt(s.terrain, sim.x, sim.y), sx, sy, z, W, H, s.airspaceLabels !== false);

  if (s.triangle) drawTriangle(ctx, s.triangle, sx, sy, z);

  // Terrain-following reachability outline using the same instantaneous glide ratio as the GPS.
  if (!sim.landed) {
    traceGlideBoundary(s.terrain, { ...sim, vz: s.glideVz ?? sim.vz }, glideBoundaryPoints);
    ctx.save();
    ctx.beginPath();
    let previousValid = false;
    for (let i = 0; i <= GLIDE_BOUNDARY_RAYS; i++) {
      const index = (i % GLIDE_BOUNDARY_RAYS) * 2;
      const x = glideBoundaryPoints[index], y = glideBoundaryPoints[index + 1];
      if (!Number.isFinite(x) || !Number.isFinite(y)) { previousValid = false; continue; }
      if (previousValid) ctx.lineTo(sx(x), sy(y)); else ctx.moveTo(sx(x), sy(y));
      previousValid = true;
    }
    ctx.setLineDash([]);
    ctx.lineWidth = 4;
    ctx.strokeStyle = theme.getPropertyValue("--glide-boundary-outline").trim();
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = theme.getPropertyValue("--glide-boundary").trim();
    ctx.stroke();
    ctx.restore();
  }

  // trail coloured by climb
  for (let i = 1; i < s.trail.length; i++) {
    const a = s.trail[i - 1], b = s.trail[i];
    ctx.strokeStyle = b.vz > 0.5 ? "rgba(230,60,40,0.9)" : b.vz > 0 ? "rgba(240,170,40,0.85)" : "rgba(40,80,200,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx(a.x), sy(a.y));
    ctx.lineTo(sx(b.x), sy(b.y));
    ctx.stroke();
  }

  // glide-range line: best glide from current AGL, ending at the next terrain collision
  if (!sim.landed) {
    const agl = sim.alt - heightAt(s.terrain, sim.x, sim.y);
    if (agl > 1) {
      const gr = POLAR.trim.v / POLAR.trim.sink;
      const maxRange = agl * gr;
      const dx = Math.sin(s.visYaw), dy = Math.cos(s.visYaw);
      const step = 40; // m between terrain samples along the glide path
      let range = maxRange;
      let prev = 0;
      for (let d = step; d <= maxRange; d += step) {
        if (sim.alt - d / gr <= heightAt(s.terrain, sim.x + dx * d, sim.y + dy * d)) {
          // refine the collision point between the last free and first blocked sample
          let lo = prev, hi = d;
          for (let i = 0; i < 8; i++) {
            const mid = (lo + hi) / 2;
            if (sim.alt - mid / gr <= heightAt(s.terrain, sim.x + dx * mid, sim.y + dy * mid)) hi = mid;
            else lo = mid;
          }
          range = lo;
          break;
        }
        prev = d;
      }
      const ex = sim.x + dx * range;
      const ey = sim.y + dy * range;
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(sx(sim.x), sy(sim.y));
      ctx.lineTo(sx(ex), sy(ey));
      ctx.stroke();
      ctx.strokeStyle = "rgba(20,30,60,0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx(sim.x), sy(sim.y));
      ctx.lineTo(sx(ex), sy(ey));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(sx(ex), sy(ey), 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fill();
    }
  }

  // dusk
  if (s.dusk > 0) {
    ctx.fillStyle = `rgba(10,15,40,${s.dusk * 0.6})`;
    ctx.fillRect(0, 0, W, H);
  }

  // imported FlyXC task: legs, 400 m cylinders, next turnpoint highlighted
  if (s.task && s.task.local.length > 1) {
    const t = s.task;
    ctx.save();
    ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.strokeStyle = "rgba(255,0,200,0.85)";
    ctx.beginPath();
    t.local.forEach((p, k) => (k ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y))));
    ctx.stroke(); ctx.setLineDash([]);
    ctx.font = "bold 11px system-ui, sans-serif"; ctx.textAlign = "center";
    t.local.forEach((p, k) => {
      const done = k < t.next, cur = k === t.next;
      ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), Math.max(3, t.radius * z), 0, Math.PI * 2);
      ctx.fillStyle = done ? "rgba(0,200,80,0.18)" : cur ? "rgba(255,0,200,0.22)" : "rgba(255,0,200,0.08)";
      ctx.fill();
      ctx.lineWidth = cur ? 3 : 1.5; ctx.strokeStyle = done ? "rgba(0,160,60,0.9)" : "rgba(255,0,200,0.9)"; ctx.stroke();
      const label = k === 0 ? "Start" : k === t.local.length - 1 ? "Ziel" : `WP${k}`;
      ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillText(label, sx(p.x), sy(p.y) - Math.max(6, t.radius * z) - 4);
    });
    const nx = t.local[t.next];
    if (nx) {
      ctx.strokeStyle = "rgba(255,0,200,0.9)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx(sim.x), sy(sim.y)); ctx.lineTo(sx(nx.x), sy(nx.y)); ctx.stroke();
      // off-screen turnpoint: badge with name and distance at the screen edge
      const px = sx(nx.x), py = sy(nx.y);
      if (px < 0 || py < 0 || px > W || py > H) {
        const ox = sx(sim.x), oy = sy(sim.y), dx = px - ox, dy = py - oy;
        const f = Math.min(Math.abs((dx > 0 ? W - 60 - ox : 60 - ox) / (dx || 1e-9)), Math.abs((dy > 0 ? H - 30 - oy : 70 - oy) / (dy || 1e-9)));
        const bx = ox + dx * f, by = oy + dy * f;
        const k = t.next, name = k === t.local.length - 1 ? "Ziel" : `WP${k}`;
        const label = `${name} · ${(Math.sqrt((nx.x - sim.x) ** 2 + (nx.y - sim.y) ** 2) / 1000).toFixed(1)} km`;
        const tw = ctx.measureText(label).width + 12;
        ctx.fillStyle = "rgba(200,0,160,0.92)";
        ctx.beginPath(); ctx.roundRect(bx - tw / 2, by - 10, tw, 20, 5); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.fillText(label, bx, by + 4);
      }
    }
    ctx.restore();
  }

  // other live pilots: tinted wing with name/altitude badge
  if (s.others?.length) {
    const wing = getWingImage();
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.save();
    ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.globalAlpha = 0.75;
    for (const o of s.others) {
      const t = o.trail;
      if (!t || t.length < 1) continue;
      ctx.strokeStyle = o.color ?? "#38bdf8";
      ctx.beginPath();
      ctx.moveTo(sx(t[0].x), sy(t[0].y));
      for (let i = 1; i < t.length; i++) ctx.lineTo(sx(t[i].x), sy(t[i].y));
      ctx.lineTo(sx(o.x), sy(o.y));
      ctx.stroke();
    }
    ctx.restore();
    for (const o of s.others) {
      const ox = sx(o.x), oy = sy(o.y);
      if (ox < -60 || oy < -60 || ox > W + 60 || oy > H + 60) continue;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.save();
      ctx.rotate(o.heading);
      if (wing) {
        const w = 36, h = (w * wing.naturalHeight) / wing.naturalWidth;
        if (wing.complete && wing.naturalWidth) { const t = tintedWing(wing, o.color ?? "#38bdf8", o.metallic === true), tw = (w * t.width) / wing.naturalWidth, th = (h * t.height) / wing.naturalHeight; ctx.drawImage(t, -tw / 2, -th / 2, tw, th); }
      }
      ctx.restore();
      const label = Number.isFinite(o.alt) ? `${o.name} · ${Math.round(o.alt)} m` : o.name;
      const tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = "rgba(0,40,60,0.85)";
      ctx.beginPath(); ctx.roundRect(-tw / 2, -38, tw, 17, 4); ctx.fill();
      ctx.fillStyle = o.color ?? "#7ff3ff";
      ctx.fillText(label, 0, -25.5);
      ctx.restore();
    }
  }

  // glider (photo wing on transparent background)
  const shadow = s.sun ? shadowOffset(s.sun, sim.alt - heightAt(s.terrain, sim.x, sim.y)) : null;
  if (shadow) {
    const len = Math.sqrt(shadow.x * shadow.x + shadow.y * shadow.y);
    const k = len * z > 160 ? 160 / (len * z) : 1; // keep the shadow near the glider when high
    ctx.save();
    ctx.translate(cx + shadow.x * z * k, cy - shadow.y * z * k);
    ctx.rotate(s.visYaw);
    ctx.fillStyle = `rgba(0,0,0,${k < 1 ? 0.18 : 0.32})`;
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(s.visYaw);
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, -70); ctx.stroke();
  ctx.setLineDash([]);
  const wing = getWingImage();
  if (wing) {
    const w = 44, h = (w * wing.naturalHeight) / wing.naturalWidth;
    ctx.drawImage(wing, -w / 2, -h / 2 - 1, w, h);
  }
  ctx.fillStyle = "#fff";
  ctx.fillRect(-1.5, 2, 3, 3);
  ctx.restore();
}

export const MapCanvas = forwardRef<HTMLCanvasElement>(function MapCanvas(_, ref) {
  return <canvas ref={ref} aria-label="Zoombare Schweizer Flugkarte" className="absolute inset-0 h-full w-full cursor-grab touch-none active:cursor-grabbing" />;
});

const miniFit = new WeakMap<HTMLCanvasElement, { fit: number; mx: number; my: number; t: number }>();
/** Overview minimap: auto-fits track, triangle and FAI sectors; `view` is the user's extra zoom/pan on top. */
export function drawMiniMap(canvas: HTMLCanvasElement, site: Site, sim: Sim, triangle: XcTriangle | null, view: ZoomTransform, mapAlpha = 1) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const css = getComputedStyle(canvas);
  ctx.fillStyle = css.getPropertyValue("--card").trim() || "#111"; ctx.fillRect(0, 0, W, H);
  let x0 = Math.min(0, sim.x), x1 = Math.max(0, sim.x), y0 = Math.min(0, sim.y), y1 = Math.max(0, sim.y);
  for (let i = 0; i < sim.trackX.length; i++) { const x = sim.trackX[i], y = sim.trackY[i]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  let sectors: Sector[] = [];
  if (triangle) {
    sectors = [faiSector(triangle.b, triangle.c, triangle.a), faiSector(triangle.c, triangle.a, triangle.b), faiSector(triangle.a, triangle.b, triangle.c)];
    const r = CLOSING_RATIO * triangle.perimeter, a = triangle.a;
    x0 = Math.min(x0, a.x - r); x1 = Math.max(x1, a.x + r); y0 = Math.min(y0, a.y - r); y1 = Math.max(y1, a.y + r);
    for (const sec of sectors) { const R = sec.maxP * 0.5; const c = triangle; for (const v of [c.a, c.b, c.c]) { x0 = Math.min(x0, v.x - R * 0.3); x1 = Math.max(x1, v.x + R * 0.3); y0 = Math.min(y0, v.y - R * 0.3); y1 = Math.max(y1, v.y + R * 0.3); } x0 = Math.min(x0, sec.lx); x1 = Math.max(x1, sec.lx); y0 = Math.min(y0, sec.ly); y1 = Math.max(y1, sec.ly); }
  }
  const pad = 12;
  const fit = Math.min((W - 2 * pad) / Math.max(500, x1 - x0), (H - 2 * pad) / Math.max(500, y1 - y0));
  // ease the auto-fit towards its target so the minimap zoom glides instead of jumping
  const tgt = { fit, mx: (x0 + x1) / 2, my: (y0 + y1) / 2 };
  const prev = miniFit.get(canvas);
  const now = performance.now();
  let cur = tgt;
  if (prev) {
    const a = 1 - Math.exp(-Math.min(0.1, (now - prev.t) / 1000) * 2.5);
    cur = { fit: Math.exp(Math.log(prev.fit) + (Math.log(tgt.fit) - Math.log(prev.fit)) * a), mx: prev.mx + (tgt.mx - prev.mx) * a, my: prev.my + (tgt.my - prev.my) * a };
  }
  miniFit.set(canvas, { ...cur, t: now });
  const z = cur.fit * view.k, mx = cur.mx, my = cur.my;
  const sx = (x: number) => W / 2 + (x - mx) * z + view.x, sy = (y: number) => H / 2 - (y - my) * z + view.y;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = mapAlpha;
  drawSwissRelief(ctx, site, mx - view.x / z, my + (H / 2 + view.y - H * 0.55) / z, W, H, z, dpr);
  ctx.globalAlpha = 1;
  if (triangle) drawTriangle(ctx, triangle, sx, sy, z);
  ctx.strokeStyle = css.getPropertyValue("--primary").trim() || "#fc0"; ctx.lineWidth = 2; ctx.lineJoin = "round";
  ctx.beginPath(); ctx.moveTo(sx(0), sy(0));
  for (let i = 0; i < sim.trackX.length; i++) ctx.lineTo(sx(sim.trackX[i]), sy(sim.trackY[i]));
  ctx.lineTo(sx(sim.x), sy(sim.y)); ctx.stroke();
  ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(sx(sim.x), sy(sim.y), 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
