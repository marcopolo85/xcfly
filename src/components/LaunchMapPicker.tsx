import { useEffect, useRef, useState } from "react";
import { X, MapPin } from "lucide-react";
import type { Site } from "@/game/sites";
import { SITES } from "@/game/sites";
import { hotspotLocal } from "@/game/thermalHotspots";
import { localToCoordinates, selectedLaunch } from "@/game/launchSelection";
import { loadLaunchAltitude } from "@/game/realTerrain";
import { useCanvasZoom } from "@/hooks/useCanvasZoom";
import { drawSwissRelief } from "./SwissRelief";
import { ZoomControls } from "./ZoomControls";
import { Button } from "./ui/button";

const SCALE = 0.025;

/** Map view shown before any launch is selected: the middle of Switzerland. */
const DEFAULT_CENTER: Site = { id: "view-ch", name: "Schweiz", region: "Schweiz", lat: 46.8, lon: 8.23, launchAlt: 0, valley: 400, peak: 3000, lake: false, seed: 0 };

export function LaunchMapPicker({ initial, onSelect, onClose }: { initial?: Site | undefined; onSelect: (site: Site) => void; onClose: () => void }) {
  const [center, setCenter] = useState<Site>(initial ?? DEFAULT_CENTER);
  const [selected, setSelected] = useState<Site | null>(initial ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const map = useCanvasZoom(0.08, 16);

  useEffect(() => {
    let raf = 0, last = 0;
    const draw = (now: number) => {
      const canvas = map.canvasRef.current;
      if (canvas && now - last > 80) {
        last = now;
        const W = canvas.clientWidth, H = canvas.clientHeight, dpr = window.devicePixelRatio || 1;
        if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
          canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        }
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const theme = getComputedStyle(canvas);
          ctx.fillStyle = theme.getPropertyValue("--background").trim();
          ctx.fillRect(0, 0, W, H);
          const view = map.transform.current, z = SCALE * view.k;
          const cx = view.applyX(W / 2), cy = view.applyY(H * 0.55);
          const status = drawSwissRelief(ctx, center, (W / 2 - cx) / z, (cy - H * 0.55) / z, W, H, z, dpr);
          if (!status.loaded) {
            ctx.fillStyle = theme.getPropertyValue("--foreground").trim();
            ctx.font = "12px monospace"; ctx.textAlign = "center";
            ctx.fillText(status.failed ? "Karte nicht erreichbar" : "Schweizer Reliefkarte lädt…", W / 2, H / 2);
          }
          if (selected) {
            const local = hotspotLocal(center, selected);
            const x = cx + local.x * z, y = cy - local.y * z;
            ctx.strokeStyle = theme.getPropertyValue("--primary-foreground").trim();
            ctx.fillStyle = theme.getPropertyValue("--primary").trim();
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x - 16, y); ctx.lineTo(x + 16, y); ctx.moveTo(x, y - 16); ctx.lineTo(x, y + 16); ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [center, selected, map.canvasRef, map.transform]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => { request.current++; window.removeEventListener("keydown", key); };
  }, [onClose]);

  const pick = async (clientX: number, clientY: number) => {
    const canvas = map.canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect(), view = map.transform.current;
    const x = (view.invertX(clientX - rect.left) - rect.width / 2) / SCALE;
    const y = (rect.height * 0.55 - view.invertY(clientY - rect.top)) / SCALE;
    const point = localToCoordinates(center, x, y);
    const id = ++request.current;
    setLoading(true); setError("");
    setSelected(selectedLaunch(center, point.lat, point.lon, 0));
    try {
      const altitude = await loadLaunchAltitude(point);
      if (request.current === id) setSelected(selectedLaunch(center, point.lat, point.lon, altitude));
    } catch {
      if (request.current === id) setError("Geländehöhe nicht erreichbar. Bitte einen Punkt erneut wählen.");
    } finally { if (request.current === id) setLoading(false); }
  };

  return <div role="dialog" aria-modal="true" aria-labelledby="launch-map-title" className="fixed inset-0 z-50 flex flex-col bg-background">
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
      <h2 id="launch-map-title" className="font-display text-lg font-bold">Startplatz wählen</h2>
      <Button variant="ghost" size="icon" aria-label="Karte schließen" title="Karte schließen" onClick={onClose}><X /></Button>
    </header>
    <div className="relative min-h-0 flex-1">
      <canvas ref={map.canvasRef} aria-label="Karte zur Startplatzwahl" className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
        onPointerDown={(e) => { if (pointer.current) moved.current = true; else { pointer.current = { x: e.clientX, y: e.clientY }; moved.current = false; } }}
        onPointerMove={(e) => { if (pointer.current && Math.hypot(e.clientX - pointer.current.x, e.clientY - pointer.current.y) > 6) moved.current = true; }}
        onPointerCancel={() => { pointer.current = null; moved.current = true; }}
        onPointerUp={(e) => { const tap = pointer.current && !moved.current; pointer.current = null; if (tap) void pick(e.clientX, e.clientY); }} />
      <div className="absolute left-2 top-2 rounded-md border border-border bg-card/95 p-1"><ZoomControls label="Startkarte" scale={map.scale} change={map.change} reset={map.reset} /></div>
      <select aria-label="Kartenausschnitt" className="absolute right-2 top-14 max-w-[180px] rounded-md border border-border bg-card px-2 py-2 text-sm text-foreground sm:top-2" value={SITES.some(s => s.id === center.id) ? center.id : ""}
        onChange={(e) => { const site = SITES.find(s => s.id === e.target.value); if (site) { request.current++; setCenter(site); setSelected(site); setLoading(false); setError(""); map.reset(); } }}>
        <option value="" disabled>Eigener Startplatz</option>
        {SITES.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
      </select>
      <a className="absolute bottom-0 right-0 bg-background/90 px-2 py-1 font-mono text-[9px] text-foreground" href="https://www.swisstopo.admin.ch/de/nutzungsbedingungen" target="_blank" rel="noopener noreferrer">© swisstopo · OpenTopoMap · OSM</a>
    </div>
    <footer className="shrink-0 space-y-2 border-t border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-1 font-mono text-xs"><span>{selected ? `${selected.lat.toFixed(5)}° N · ${selected.lon.toFixed(5)}° E` : "Kein Startplatz gewählt"}</span><span>{loading ? "Höhe lädt…" : error || !selected ? "—" : `${selected.launchAlt} m`}</span></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button className="h-11 w-full" disabled={loading || !!error || !selected} onClick={() => { if (selected) onSelect(selected); }}><MapPin />Startplatz übernehmen</Button>
    </footer>
  </div>;
}