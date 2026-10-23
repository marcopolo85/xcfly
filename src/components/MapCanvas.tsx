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
  const i0 = Math.max(0, Math.floor((xMin + EXTENT) / RES));
  const i1 = Math.min(N - 1, Math.ceil((xMax + EXTENT) / RES));
  const j0 = Math.max(0, Math.floor((EXTENT - yMax) / RES));
  const j1 = Math.min(N - 1, Math.ceil((EXTENT - yMin) / RES));
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
        const x0 = i * RES - EXTENT, x1 = i2 * RES - EXTENT;
        const y0 = EXTENT - j * RES, y1 = EXTENT - j2 * RES;
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
  for (let level = Math.ceil(t.site.valley / 100) * 100; level <= t.site.peak; level += 100) {
    traceLevel(level, level % 500 === 0 ? major : minor);
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(120,80,40,0.16)";
  ctx.stroke(minor);
  ctx.strokeStyle = "rgba(120,80,40,0.3)";
  ctx.stroke(major);
  // contour at exactly the glider's altitude: dark under-stroke for contrast, then a bright orange core
  if (gliderAlt > t.site.valley && gliderAlt < t.site.peak) {
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
    const K = 7 / 18; // on the FAI boundary of one leg: d1 = K * (L + d2)
    const H = 1.4 * L; // sector truncation half-size in the leg frame
    // Boundary oval around leg end a: r(θ), θ measured from a towards b.
    const rAt = (th: number) => (2 * K * L * (1 - K * Math.cos(th))) / (1 - K * K);
    const xAt = (th: number) => -L / 2 + rAt(th) * Math.cos(th);
    const th1 = Math.acos(11 / 14); // notch apex where the two leg-boundary ovals cross
    let thExit = Math.PI;
    for (let i = 1; i <= 64; i++) {
      const th = th1 + ((Math.PI - th1) * i) / 64;
      if (xAt(th) <= -H) { thExit = th; break; }
    }
    if (thExit < Math.PI) { // refine so the arc ends exactly on the box edge
      const step = (Math.PI - th1) / 64;
      let lo = thExit - step, hi = thExit;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (xAt(mid) <= -H) hi = mid; else lo = mid;
      }
      thExit = hi;
    }
    const N = 128;
    const arc: { x: number; y: number }[] = [];
    for (let i = 0; i <= N; i++) {
      const th = th1 + (thExit - th1) * (i / N);
      const r = rAt(th);
      arc.push({ x: -L / 2 + r * Math.cos(th), y: r * Math.sin(th) });
    }
    const n = arc.length - 1;
    path.moveTo(px(-arc[0].x, arc[0].y), py(-arc[0].x, arc[0].y)); // notch apex
    for (let i = 1; i <= n; i++) path.lineTo(px(-arc[i].x, arc[i].y), py(-arc[i].x, arc[i].y)); // mirrored arc
    path.lineTo(px(H, H), py(H, H)); // right box edge
    path.lineTo(px(-H, H), py(-H, H)); // top box edge
    for (let i = n; i >= 1; i--) path.lineTo(px(arc[i].x, arc[i].y), py(arc[i].x, arc[i].y)); // arc back to apex
    path.closePath();
    minP = (25 / 11) * L; // smallest valid perimeter, at the notch apex
    maxP = L * (1 + Math.sqrt(1.9 * 1.9 + 1.4 * 1.4) + Math.sqrt(0.9 * 0.9 + 1.4 * 1.4));
    lx = px(0, H);
    ly = py(0, H);
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
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  for (const sec of sectors) {
    if (!isFinite(sec.minP)) continue;
    const tx = sx(sec.lx), ty = sy(sec.ly);
    const l1 = `min ${(sec.minP / 1000).toFixed(1)} km`, l2 = `max ${(sec.maxP / 1000).toFixed(1)} km`;
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.fillStyle = "rgba(20,30,60,0.95)";
    ctx.strokeText(l1, tx, ty); ctx.fillText(l1, tx, ty);
    ctx.strokeText(l2, tx, ty + 13); ctx.fillText(l2, tx, ty + 13);
  }
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
  const cx = view.applyX(W / 2), cy = view.applyY(H * 0.55);
  const sx = (x: number) => cx + (x - sim.x) * z;
  const sy = (y: number) => cy - (y - sim.y) * z;

  const theme = getComputedStyle(canvas);
  ctx.fillStyle = theme.getPropertyValue("--background").trim();
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
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
