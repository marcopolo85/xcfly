import { forwardRef } from "react";
import type { ZoomTransform } from "d3-zoom";
import type { Sim } from "@/game/physicsEngine";
import { heightAt, type Terrain } from "@/game/terrain";
import { AIRSPACE_COLORS, formatLimitM, insideVertical, limitMetres, type Airspace } from "@/game/airspace";
import { airspaceProfileIntervals } from "@/game/airspaceProfile";

/** Heading-relative view of the simulation's terrain, never a physics input. */
export function drawSideProfile(canvas: HTMLCanvasElement, terrain: Terrain, sim: Sim, view: ZoomTransform, airspaces?: Airspace[] | null, showLabels = true, sun?: { x: number; y: number; z: number }) {
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
  // Cross-section of the same airspaces as the flight map; AGL limits follow the terrain.
  const dx = Math.sin(sim.heading), dy = Math.cos(sim.heading);
  const groundAt = (d: number) => heightAt(terrain, sim.x + dx * d, sim.y + dy * d);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, w, h - 16); ctx.clip();
  for (const a of airspaces ?? []) {
    const [r, g, b] = AIRSPACE_COLORS[a.kind];
    const active = insideVertical(a, sim.alt, groundAt(0));
    for (const [start, end] of airspaceProfileIntervals(a, sim, sim.heading, distanceAt(0), distanceAt(w))) {
      const steps = Math.max(1, Math.ceil((x(end) - x(start)) / 8));
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const d = start + (end - start) * i / steps;
        const py = y(limitMetres(a.upper, groundAt(d)));
        if (i === 0) ctx.moveTo(x(d), py); else ctx.lineTo(x(d), py);
      }
      for (let i = steps; i >= 0; i--) {
        const d = start + (end - start) * i / steps;
        ctx.lineTo(x(d), y(limitMetres(a.lower, groundAt(d))));
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(${r},${g},${b},0.15)`; ctx.fill();
      ctx.strokeStyle = `rgba(${r},${g},${b},${active ? 0.95 : 0.35})`;
      ctx.lineWidth = active ? 2 : 0.8; ctx.stroke();
      if (showLabels) {
        const text = `${a.kind} ${a.name.replace(/^(CTR|TMA|CTA|FIZ)\s*/, "")}  ${formatLimitM(a.lower)} – ${formatLimitM(a.upper)}`;
        const textWidth = ctx.measureText(text).width;
        const left = x(start) + 5, right = x(end) - 5;
        if (textWidth > right - left) continue;
        const labelX = Math.max(left, Math.min(x(0) - textWidth / 2, right - textWidth));
        let upper = 0, lower = h - 16;
        for (let px = labelX; px <= labelX + textWidth + 2; px += 2) {
          const ground = groundAt(distanceAt(px));
          upper = Math.max(upper, y(limitMetres(a.upper, ground)));
          lower = Math.min(lower, y(limitMetres(a.lower, ground)));
        }
        if (lower - upper < 20) continue;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillText(text, labelX, upper + 13);
      }
    }
  }
  ctx.restore();
  if (sun && sun.z > 0) {
    // sun projected onto the heading plane: forward component vs height
    const fwd = sun.x * Math.sin(sim.heading) + sun.y * Math.cos(sim.heading);
    const side = sun.x * Math.cos(sim.heading) - sun.y * Math.sin(sim.heading);
    const el = Math.atan2(sun.z, Math.abs(fwd) + 1e-6);
    const dir = fwd >= 0 ? 1 : -1;
    const sxp = dir > 0 ? w - 22 : 40, syp = 16 + (1 - Math.min(1, el / (Math.PI / 2))) * (h * 0.35);
    ctx.save();
    ctx.strokeStyle = color("sun"); ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
    for (const off of [-10, 0, 10]) {
      ctx.beginPath(); ctx.moveTo(sxp, syp + off);
      ctx.lineTo(sxp - dir * Math.cos(el) * 400, syp + off + Math.sin(el) * 400); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.fillStyle = color("sun");
    ctx.beginPath(); ctx.arc(sxp, syp, 6, 0, Math.PI * 2); ctx.fill();
    ctx.font = "9px 'JetBrains Mono', monospace"; ctx.textAlign = dir > 0 ? "right" : "left";
    ctx.fillText(`☼ ${Math.round(Math.asin(sun.z) * 180 / Math.PI)}°${Math.abs(side) > 0.5 ? (side > 0 ? " r" : " l") : ""}`, sxp - dir * 10, syp + 3);
    ctx.textAlign = "left";
    ctx.restore();
  }
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