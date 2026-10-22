import { forwardRef } from "react";
import type { Site } from "@/game/sites";
import { drawSwissRelief } from "./SwissRelief";
import type { Sim } from "@/game/physicsEngine";
import { CYLINDER_RADIUS, type Task } from "@/game/task";

export const ZOOM = 0.085; // px per metre (CSS px)

export interface SceneData {
  site: Site;
  sim: Sim;
  task: Task;
  next: number;
  trail: { x: number; y: number; vz: number }[];
  dusk: number; // 0..1 darkness
}

export function drawScene(canvas: HTMLCanvasElement, s: SceneData) {
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const z = ZOOM;
  const { sim } = s;
  const cx = W / 2, cy = H * 0.55;
  const sx = (x: number) => cx + (x - sim.x) * z;
  const sy = (y: number) => cy - (y - sim.y) * z;

  const theme = getComputedStyle(canvas);
  ctx.fillStyle = theme.getPropertyValue("--background").trim();
  ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  const map = drawSwissRelief(ctx, s.site, sim.x, sim.y, W, H, z);
  if (!map.loaded) {
    ctx.fillStyle = theme.getPropertyValue("--foreground").trim();
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(map.failed ? "Karte nicht erreichbar · erneuter Versuch folgt" : "Schweizer Reliefkarte lädt…", W / 2, H * 0.65);
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

  // dusk
  if (s.dusk > 0) {
    ctx.fillStyle = `rgba(10,15,40,${s.dusk * 0.6})`;
    ctx.fillRect(0, 0, W, H);
  }

  // glider
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(sim.heading);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath(); ctx.ellipse(6, 8, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e3262b";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-18, 2); ctx.quadraticCurveTo(0, -10, 18, 2); ctx.lineTo(16, 6); ctx.quadraticCurveTo(0, -3, -16, 6); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.fillRect(-1.5, 2, 3, 3);
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.setLineDash([3, 4]);
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, -70); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export const MapCanvas = forwardRef<HTMLCanvasElement>(function MapCanvas(_, ref) {
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
});
