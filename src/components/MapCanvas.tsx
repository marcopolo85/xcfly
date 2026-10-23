import { forwardRef } from "react";
import type { Site } from "@/game/sites";
import { drawSwissRelief } from "./SwissRelief";
import { POLAR, type Sim } from "@/game/physicsEngine";
import { EXTENT, N, RES, heightAt, type Terrain } from "@/game/terrain";
import type { ZoomTransform } from "d3-zoom";
import type { ThermalMap } from "@/game/loadThermalRaster";
import { mapOrigin, MERCATOR_EXTENT } from "@/game/swissMap";
import { THERMAL_ZOOM } from "@/game/thermalRaster";
import { CLOSING_RATIO, type XcTriangle } from "@/game/xcTriangle";
import wingUrl from "@/assets/glider-wing.png";
import { AIRSPACE_COLORS, formatLimitM, insideVertical, type Airspace } from "@/game/airspace";

let wingImage: HTMLImageElement | null = null;
function getWingImage() {
  if (!wingImage) {
    wingImage = new Image();
    wingImage.src = wingUrl;
  }
  return wingImage.complete && wingImage.naturalWidth > 0 ? wingImage : null;
}

export const ZOOM = 0.085; // px per metre (CSS px)

/** Subtle contour lines (100 m, major every 500 m) from the simulation terrain grid.
 * On top, one contour is traced at exactly the glider's current altitude, so the
 * pilot sees the terrain line he can currently fly through. */
function drawContours(ctx: CanvasRenderingContext2D, t: Terrain, sx: (x: number) => number, sy: (y: number) => number, z: number, xMin: number, xMax: number, yMin: number, yMax: number, gliderAlt: number) {
  const step = Math.max(1, Math.round(4 / (RES * z))); // keep cells a few px apart at any zoom
  const centerX = t.centerX ?? 0, centerY = t.centerY ?? 0;
  const i0 = Math.max(0, Math.floor((xMin - centerX + EXTENT) / RES));
  const i1 = Math.min(N - 1, Math.ceil((xMax - centerX + EXTENT) / RES));
  const j0 = Math.max(0, Math.floor((EXTENT - yMax + centerY) / RES));
  const j1 = Math.min(N - 1, Math.ceil((EXTENT - yMin + centerY) / RES));
  if (i1 - i0 < step || j1 - j0 < step) return;
  const minor = new Path2D(), major = new Path2D(), exact = new Path2D();
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
        const pts: [number, number][] = [];
        if ((h00 - level) * (h10 - level) < 0) pts.push([x0 + ((level - h00) / (h10 - h00)) * (x1 - x0), y0]);
        if ((h10 - level) * (h11 - level) < 0) pts.push([x1, y0 + ((level - h10) / (h11 - h10)) * (y1 - y0)]);
        if ((h01 - level) * (h11 - level) < 0) pts.push([x0 + ((level - h01) / (h11 - h01)) * (x1 - x0), y1]);
        if ((h00 - level) * (h01 - level) < 0) pts.push([x0, y0 + ((level - h00) / (h01 - h00)) * (y1 - y0)]);
        for (let p = 0; p + 1 < pts.length; p += 2) {
          path.moveTo(sx(pts[p][0]), sy(pts[p][1]));
          path.lineTo(sx(pts[p + 1][0]), sy(pts[p + 1][1]));
        }
      }
    }
  };
  let minHeight = Infinity, maxHeight = -Infinity;
  for (let j = j0; j <= j1; j += step) for (let i = i0; i <= i1; i += step) {
    const value = h[j * N + i];
    minHeight = Math.min(minHeight, value); maxHeight = Math.max(maxHeight, value);
  }
  for (let level = Math.ceil(minHeight / 100) * 100; level <= maxHeight; level += 100) {
    traceLevel(level, level % 500 === 0 ? major : minor);
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(120,80,40,0.16)";
  ctx.stroke(minor);
  ctx.strokeStyle = "rgba(120,80,40,0.3)";
  ctx.stroke(major);
  // contour at exactly the glider's altitude: dark under-stroke for contrast, then a bright orange core
  if (gliderAlt > minHeight && gliderAlt < maxHeight) {
    traceLevel(gliderAlt, exact);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(20,30,60,0.6)";
    ctx.stroke(exact);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,120,20,0.95)";
    ctx.stroke(exact);
  }
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
  airspaces?: Airspace[] | null;
  airspaceLabels?: boolean; // toggle for airspace edge labels, independent of the airspace fill
}

const airspacePaths = new WeakMap<Airspace, Path2D>();
function airspacePath(a: Airspace) {
  let p = airspacePaths.get(a);
  if (!p) {
    p = new Path2D();
    for (const r of a.rings) {
      r.forEach((pt, i) => (i ? p!.lineTo(pt.x, pt.y) : p!.moveTo(pt.x, pt.y)));
      p.closePath();
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
  const anchorF = s.showProfile ? 1 / 3 : 1 / 2; // glider in upper third when the profile is shown, centered otherwise
  const cx = view.applyX(W / 2), cy = view.applyY(H * anchorF);
  const sx = (x: number) => cx + (x - sim.x) * z;
  const sy = (y: number) => cy - (y - sim.y) * z;

  const theme = getComputedStyle(canvas);
  ctx.fillStyle = theme.getPropertyValue("--background").trim();
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  // relief tiles are laid out around screen point (W/2, 0.55·H): pass the world position under that point
  const map = drawSwissRelief(ctx, s.site, sim.x + (W / 2 - cx) / z, sim.y + (cy - H * 0.55) / z, W, H, z, dpr);
  if (!map.loaded) {
    ctx.fillStyle = theme.getPropertyValue("--foreground").trim();
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(map.failed ? "Karte nicht erreichbar · erneuter Versuch folgt" : "Schweizer Reliefkarte lädt…", W / 2, H * 0.65);
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
    ctx.drawImage(image, sx(left), sy(top), raster.width * metresPerPixel * origin.scale * z, raster.height * metresPerPixel * origin.scale * z);
    ctx.globalAlpha = 1;
  }

  if (s.airspaces?.length) drawAirspaces(ctx, s.airspaces, sim.x, sim.y, sim.alt, heightAt(s.terrain, sim.x, sim.y), sx, sy, z, W, H, s.airspaceLabels !== false);

  if (s.triangle) drawTriangle(ctx, s.triangle, sx, sy, z);

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
      const dx = Math.sin(sim.heading), dy = Math.cos(sim.heading);
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

  // glider (photo wing on transparent background)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(sim.heading);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath(); ctx.ellipse(6, 8, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
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
