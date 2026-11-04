import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";
import { fitTrackOverview, trackOverviewCamera } from "@/game/trackOverview";
import { useCanvasZoom } from "@/hooks/useCanvasZoom";
import { ZoomControls } from "./ZoomControls";
import { Button } from "./ui/button";
import { drawSwissRelief, getMapStyle, MAP_STYLES } from "./SwissRelief";

function TrackMap({ track, className, interactive = false }: { track: [number, number][] | null; className: string; interactive?: boolean }) {
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
      ctx.beginPath();
      const view = map.transform.current;
      fit.points.forEach((point, index) => { const x = view.applyX(point.x), y = view.applyY(point.y); if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.strokeStyle = theme.getPropertyValue("--foreground").trim(); ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = theme.getPropertyValue("--primary").trim(); ctx.lineWidth = 2.5; ctx.stroke();
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
  }, [track, canvasRef, map.transform]);
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

export function TrackOverview({ track, className = "aspect-[16/11] w-full", expandable = false }: { track: [number, number][] | null; className?: string; expandable?: boolean }) {
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
