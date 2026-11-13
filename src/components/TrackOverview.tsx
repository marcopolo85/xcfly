import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";
import { fitTrackOverview, trackOverviewCamera } from "@/game/trackOverview";
import type { TrackPoint } from "@/game/swissMap";
import { useCanvasZoom } from "@/hooks/useCanvasZoom";
import { ZoomControls } from "./ZoomControls";
import { Button } from "./ui/button";
import { drawSwissRelief, getMapStyle, MAP_STYLES } from "./SwissRelief";

/** Distinct colour per track (golden-angle hue steps). */
export function trackColor(i: number) { return `hsl(${Math.round((i * 137.5) % 360)} 85% 55%)`; }

function TrackMap({ track, className, interactive = false, splits, selected = null }: { track: TrackPoint[] | null; className: string; interactive?: boolean; splits?: number[] | undefined; selected?: number | null }) {
  const map = useCanvasZoom(0.1, 32, interactive);
  const { canvasRef } = map;
  const creditRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !track || track.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    const draw = () => {
      const width = canvas.clientWidth, height = canvas.clientHeight;
      if (width === 0 || height === 0) { frame = requestAnimationFrame(draw); return; }
      const dpr = window.devicePixelRatio || 1;
      const fit = fitTrackOverview(track, width, height);
      if (!fit) { frame = requestAnimationFrame(draw); return; }
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const theme = getComputedStyle(canvas);
      ctx.fillStyle = theme.getPropertyValue("--background").trim();
      ctx.fillRect(0, 0, width, height);
      const mapStyle = getMapStyle();
      const camera = trackOverviewCamera(fit, width, height, map.transform.current);
      drawSwissRelief(ctx, fit.site, camera.x, camera.y, width, height, camera.zoom, dpr, mapStyle);
      const credit = MAP_STYLES.find((style) => style.v === mapStyle)?.credit ?? "";
      if (creditRef.current && creditRef.current.textContent !== credit) creditRef.current.textContent = credit;
      const view = map.transform.current;
      const segs = splits && splits.length > 1 ? splits : [0];
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      const hasSel = selected !== null && selected >= 0 && selected < segs.length;
      const order = segs.map((_, si) => si).filter((si) => !hasSel || si !== selected);
      if (hasSel) order.push(selected);
      for (const si of order) {
        const from = segs[si]!, to = segs[si + 1] ?? fit.points.length;
        const hi = hasSel && si === selected;
        ctx.globalAlpha = hasSel && !hi ? 0.25 : 1;
        ctx.beginPath();
        for (let i = from; i < to; i++) { const p = fit.points[i]; const x = view.applyX(p.x), y = view.applyY(p.y); if (i === from) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.strokeStyle = theme.getPropertyValue("--foreground").trim(); ctx.lineWidth = hi ? 7 : 5; ctx.stroke();
        ctx.strokeStyle = segs.length > 1 ? trackColor(si) : theme.getPropertyValue("--primary").trim(); ctx.lineWidth = hi ? 4 : 2.5; ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const start = fit.points[0];
      if (start) {
        ctx.beginPath(); ctx.arc(view.applyX(start.x), view.applyY(start.y), 4, 0, Math.PI * 2);
        ctx.fillStyle = theme.getPropertyValue("--climb").trim(); ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = theme.getPropertyValue("--foreground").trim(); ctx.stroke();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [track, splits, selected, canvasRef, map.transform]);
  if (!track || track.length < 2) {
    return <p className="py-10 text-center text-xs text-muted-foreground">Keine Trackdaten vorhanden.</p>;
  }
  return (
    <div className={interactive ? "relative h-full w-full" : "relative"}>
      <canvas ref={canvasRef} role="img" aria-label="Flugtrack auf der ausgewählten Karte" className={`block w-full ${interactive ? "touch-none cursor-grab active:cursor-grabbing" : ""} ${className}`} />
      {interactive && <div className="absolute left-2 top-2 rounded-md border border-border bg-card/95 p-1"><ZoomControls label="Flugtrack" scale={map.scale} change={map.change} reset={map.reset} /></div>}
      <p ref={creditRef} className={interactive ? "absolute bottom-0 right-0 bg-background/90 px-2 py-1 text-right text-[9px] text-muted-foreground" : "mt-1 text-right text-[9px] text-muted-foreground"} />
    </div>
  );
}

export function TrackOverview({ track, className = "aspect-[16/11] w-full", expandable = false }: { track: TrackPoint[] | null; className?: string; expandable?: boolean }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab") { event.preventDefault(); const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[aria-labelledby="flight-track-title"] button')); const index = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus(); }
    };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); openRef.current?.focus(); };
  }, [open]);
  return <>
    <div className="relative">
      <TrackMap track={track} className={className} />
      {expandable && track && track.length >= 2 && <Button ref={openRef} variant="outline" size="icon" className="absolute right-1 top-1 h-7 w-7 bg-card/95" aria-label="Flugtrack anschauen" title="Flugtrack anschauen" onClick={() => setOpen(true)}><Maximize2 /></Button>}
    </div>
    {open && createPortal(<div role="dialog" aria-modal="true" aria-labelledby="flight-track-title" className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 id="flight-track-title" className="font-display text-lg font-bold">Flugtrack</h2>
        <Button ref={closeRef} variant="ghost" size="icon" aria-label="Zurück zur Auswertung" title="Zurück zur Auswertung" onClick={() => setOpen(false)}><X /></Button>
      </header>
      <div className="min-h-0 flex-1"><TrackMap track={track} className="h-full" interactive /></div>
    </div>, document.body)}
  </>;
}

/** Several tracks on one interactive map (e.g. all flights of today). */
export function MultiTrackMap({ tracks, selected = null }: { tracks: TrackPoint[][]; selected?: number | null }) {
  const { flat, splits } = useMemo(() => {
    const splits: number[] = [];
    const flat: TrackPoint[] = [];
    for (const t of tracks) { if (t.length < 2) continue; splits.push(flat.length); flat.push(...t); }
    return { flat, splits };
  }, [tracks]);
  return <TrackMap track={flat.length >= 2 ? flat : null} splits={splits} selected={selected} className="h-full" interactive />;
}
