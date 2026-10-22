import { forwardRef } from "react";
import type { Site } from "@/game/sites";
import { drawSwissRelief } from "./SwissRelief";
import { POLAR, type Sim } from "@/game/physicsEngine";
import { heightAt, type Terrain } from "@/game/terrain";
import { CYLINDER_RADIUS, type Task } from "@/game/task";
import type { ZoomTransform } from "d3-zoom";
import type { ThermalField } from "@/game/thermals";
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

export interface SceneData {
  site: Site;
  terrain: Terrain;
  sim: Sim;
  task: Task;
  next: number;
  trail: { x: number; y: number; vz: number }[];
  dusk: number; // 0..1 darkness
  thermals?: ThermalField | null;
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

  // thermal map
  if (s.thermals) {
    for (const arr of s.thermals.grid.values()) for (const th of arr) {
      const px = sx(th.x), py = sy(th.y), r = Math.max(3, th.r * z);
      if (px < -r || py < -r || px > W + r || py > H + r) continue;
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(255,120,30,${0.25 + th.power * 0.35})`);
      g.addColorStop(1, "rgba(255,120,30,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // task line
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = "rgba(30,30,40,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx(0), sy(0));
  for (const w of s.task.waypoints) ctx.lineTo(sx(w.x), sy(w.y));
  ctx.stroke();
  ctx.setLineDash([]);

  // cylinders
  s.task.waypoints.forEach((w, i) => {
    const done = i < s.next, active = i === s.next;
    ctx.beginPath();
    ctx.arc(sx(w.x), sy(w.y), CYLINDER_RADIUS * z, 0, Math.PI * 2);
    ctx.fillStyle = done ? "rgba(40,160,90,0.25)" : active ? "rgba(220,40,40,0.22)" : "rgba(40,40,60,0.12)";
    ctx.fill();
    ctx.lineWidth = active ? 3 : 1.5;
    ctx.strokeStyle = done ? "#1f8a4c" : active ? "#d42a2a" : "#333";
    ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.font = "600 12px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(w.name, sx(w.x), sy(w.y) - CYLINDER_RADIUS * z - 6);
  });

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
