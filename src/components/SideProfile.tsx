import { forwardRef } from "react";
import type { ZoomTransform } from "d3-zoom";
import type { Sim } from "@/game/physicsEngine";
import { heightAt, type Terrain } from "@/game/terrain";

/** Heading-relative view of the simulation's terrain, never a physics input. */
export function drawSideProfile(canvas: HTMLCanvasElement, terrain: Terrain, sim: Sim, view: ZoomTransform) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const theme = getComputedStyle(canvas);
  const color = (token: string) => theme.getPropertyValue(`--${token}`).trim();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = color("background"); ctx.fillRect(0, 0, w, h);
  const horizontal = (w - 28) / 6500;
  const vertical = (h - 30) / (terrain.site.peak - terrain.site.valley + 800);
  const x = (distance: number) => view.applyX(26 + (distance + 700) * horizontal);
  const y = (alt: number) => view.applyY(h - 20 - (alt - terrain.site.valley + 100) * vertical);
  const distanceAt = (px: number) => (view.invertX(px) - 26) / horizontal - 700;
  const altitudeAt = (py: number) => (h - 20 - view.invertY(py)) / vertical + terrain.site.valley - 100;
  ctx.font = "9px 'JetBrains Mono', monospace";
  ctx.lineWidth = 1;
  for (let alt = Math.ceil(altitudeAt(h) / 500) * 500; alt <= altitudeAt(0); alt += 500) {
    ctx.strokeStyle = color("muted"); ctx.beginPath(); ctx.moveTo(0, y(alt)); ctx.lineTo(w, y(alt)); ctx.stroke();
    ctx.fillStyle = color("muted-foreground"); ctx.fillText(`${alt} m`, 5, y(alt) - 4);
  }
  ctx.beginPath(); ctx.moveTo(-2, h);
  for (let px = -2; px <= w + 2; px += 2) {
    const distance = distanceAt(px);
    ctx.lineTo(px, y(heightAt(terrain, sim.x + Math.sin(sim.heading) * distance, sim.y + Math.cos(sim.heading) * distance)));
  }
  ctx.lineTo(w + 2, h); ctx.closePath();
  ctx.fillStyle = color("profile-mountain"); ctx.fill();
  ctx.strokeStyle = color("profile-ridge"); ctx.stroke();
  ctx.strokeStyle = color("sun"); ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(x(0), y(sim.alt));
  ctx.lineTo(w, y(sim.alt + sim.vz / Math.max(0.1, sim.speed) * Math.max(0, distanceAt(w)))); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = color("primary"); ctx.strokeStyle = color("primary-foreground");
  ctx.beginPath(); ctx.arc(x(0), y(sim.alt), 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = color("foreground"); ctx.textAlign = "center";
  for (let km = Math.ceil(distanceAt(24) / 1000); km * 1000 < distanceAt(w - 12); km++) {
    ctx.fillText(`${km} km`, x(km * 1000), h - 5);
  }
  ctx.textAlign = "left";
}

export const SideProfile = forwardRef<HTMLCanvasElement>(function SideProfile(_, ref) {
  return <canvas ref={ref} aria-label="Bergprofil und projizierter Gleitpfad in Flugrichtung" className="h-full w-full cursor-grab touch-none active:cursor-grabbing" />;
});