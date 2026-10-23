import { forwardRef } from "react";
import type { Site } from "@/game/sites";
import { drawSwissRelief } from "./SwissRelief";
import { POLAR, type Sim } from "@/game/physicsEngine";
import { EXTENT, N, RES, heightAt, type Terrain } from "@/game/terrain";
import type { ZoomTransform } from "d3-zoom";
import type { ThermalMap } from "@/game/loadThermalRaster";
import { mapOrigin, MERCATOR_EXTENT } from "@/game/swissMap";
import { THERMAL_ZOOM } from "@/game/thermalRaster";
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

/** Subtle contour lines (100 m, major every 500 m) from the simulation terrain grid. */
function drawContours(ctx: CanvasRenderingContext2D, t: Terrain, sx: (x: number) => number, sy: (y: number) => number, z: number, xMin: number, xMax: number, yMin: number, yMax: number) {
  const step = Math.max(1, Math.round(4 / (RES * z))); // keep cells a few px apart at any zoom
  const i0 = Math.max(0, Math.floor((xMin + EXTENT) / RES));
  const i1 = Math.min(N - 1, Math.ceil((xMax + EXTENT) / RES));
  const j0 = Math.max(0, Math.floor((EXTENT - yMax) / RES));
  const j1 = Math.min(N - 1, Math.ceil((EXTENT - yMin) / RES));
  if (i1 - i0 < step || j1 - j0 < step) return;
  const minor = new Path2D(), major = new Path2D();
  const h = t.h;
  for (let level = Math.ceil(t.site.valley / 100) * 100; level <= t.site.peak; level += 100) {
    const path = level % 500 === 0 ? major : minor;
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
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(120,80,40,0.16)";
  ctx.stroke(minor);
  ctx.strokeStyle = "rgba(120,80,40,0.3)";
  ctx.stroke(major);
}

export interface SceneData {
  site: Site;
  terrain: Terrain;
  sim: Sim;
  trail: { x: number; y: number; vz: number }[];
  dusk: number; // 0..1 darkness
  thermalMap?: ThermalMap | null;
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
  drawContours(ctx, s.terrain, sx, sy, z, sim.x - cx / z, sim.x + (W - cx) / z, sim.y - (H - cy) / z, sim.y + cy / z);

  // thermal map
  if (s.thermalMap) {
    const { raster, image } = s.thermalMap;
    const origin = mapOrigin(s.site);
    const metresPerPixel = 2 * MERCATOR_EXTENT / (256 * 2 ** THERMAL_ZOOM);
    const left = (raster.left * metresPerPixel - MERCATOR_EXTENT - origin.x) * origin.scale;
    const top = (MERCATOR_EXTENT - raster.top * metresPerPixel - origin.y) * origin.scale;
    ctx.drawImage(image, sx(left), sy(top), raster.width * metresPerPixel * origin.scale * z, raster.height * metresPerPixel * origin.scale * z);
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
