import { useEffect, useRef } from "react";
import { fitTrackOverview } from "@/game/trackOverview";
import { drawSwissRelief, getMapStyle, MAP_STYLES } from "./SwissRelief";

export function TrackOverview({ track }: { track: [number, number][] | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const creditRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !track || track.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    const draw = () => {
      const width = canvas.clientWidth, height = canvas.clientHeight;
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
      drawSwissRelief(ctx, fit.site, fit.x, fit.y, width, height, fit.zoom, dpr, mapStyle);
      const credit = MAP_STYLES.find((style) => style.v === mapStyle)?.credit ?? "";
      if (creditRef.current && creditRef.current.textContent !== credit) creditRef.current.textContent = credit;
      ctx.beginPath();
      fit.points.forEach((point, index) => { if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y); });
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.strokeStyle = theme.getPropertyValue("--foreground").trim(); ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = theme.getPropertyValue("--primary").trim(); ctx.lineWidth = 2.5; ctx.stroke();
      const start = fit.points[0];
      if (start) {
        ctx.beginPath(); ctx.arc(start.x, start.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = theme.getPropertyValue("--climb").trim(); ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = theme.getPropertyValue("--foreground").trim(); ctx.stroke();
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [track]);
  if (!track || track.length < 2) {
    return <p className="py-16 text-center text-xs text-muted-foreground">Keine Trackdaten vorhanden.</p>;
  }
  return (
    <div>
      <canvas ref={canvasRef} role="img" aria-label="Flugtrack auf der ausgewählten Karte" className="block aspect-[16/11] w-full" />
      <p ref={creditRef} className="mt-1 text-right text-[9px] text-muted-foreground" />
    </div>
  );
}
