import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { SITES, SEASONS, type Season } from "@/game/sites";
import { sunPosition, sunVector, fmtClock } from "@/game/sun";
import { EXTENT, heightAt, normalAt, type Terrain } from "@/game/terrain";
import { slopeTrigger } from "@/game/thermals";
import { loadRealTerrain } from "@/game/realTerrain";
import { loadThermalRaster } from "@/game/loadThermalRaster";
import { rasterHeatAt } from "@/game/thermalRaster";
import { compassLabel } from "@/game/sunDisplay";

const G = 160; // samples per side
const START = 9, END = 19;

interface Grid { h: Float32Array; nx: Float32Array; ny: Float32Array; nz: Float32Array; heat: Float32Array; min: number; max: number }

function buildGrid(t: Terrain, raster: Parameters<typeof rasterHeatAt>[0] | null): Grid {
  const n = G * G, g: Grid = { h: new Float32Array(n), nx: new Float32Array(n), ny: new Float32Array(n), nz: new Float32Array(n), heat: new Float32Array(n), min: 1e9, max: -1e9 };
  for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) {
    const x = -EXTENT + (c + 0.5) * (2 * EXTENT / G), y = EXTENT - (r + 0.5) * (2 * EXTENT / G), i = r * G + c;
    const h = heightAt(t, x, y), nn = normalAt(t, x, y);
    g.h[i] = h; g.nx[i] = nn.x; g.ny[i] = nn.y; g.nz[i] = nn.z;
    g.heat[i] = raster ? Math.max(0, Math.min(1, rasterHeatAt(raster, x, y))) : 0.5;
    if (h < g.min) g.min = h; if (h > g.max) g.max = h;
  }
  return g;
}

/** Colour ramp blue → cyan → green → yellow → red for 0..1 lift. */
function ramp(v: number): [number, number, number] {
  const stops: [number, number, number][] = [[40, 90, 255], [0, 220, 230], [60, 210, 60], [255, 230, 0], [170, 0, 0]];
  const p = Math.max(0, Math.min(0.999, v)) * (stops.length - 1), k = Math.floor(p), f = p - k;
  const a = stops[k]!, b = stops[k + 1]!;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

function draw(canvas: HTMLCanvasElement, g: Grid, hour: number, lat: number, season: Season) {
  const s = SEASONS[season], sun = sunVector(sunPosition(lat, s.doy, hour, s.dst));
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const img = ctx.createImageData(G, G), d = img.data, amp = Math.sqrt(Math.max(0, sun.z) / 0.87);
  for (let i = 0; i < G * G; i++) {
    const irr = g.nx[i]! * sun.x + g.ny[i]! * sun.y + g.nz[i]! * sun.z;
    const light = sun.z > 0 ? 0.35 + 0.65 * Math.max(0, irr) : 0.2;
    const elev = (g.h[i]! - g.min) / Math.max(1, g.max - g.min);
    const base = (90 + 120 * elev) * light;
    const lift = slopeTrigger({ x: g.nx[i]!, y: g.ny[i]!, z: g.nz[i]! }, sun) * amp * (0.35 + 0.65 * g.heat[i]!) * (0.6 + 0.4 * elev);
    const a = Math.max(0, Math.min(0.85, (lift - 0.1) * 2.5));
    const [r, gg, b] = ramp(Math.min(1, (lift - 0.1) * 1.8));
    d[i * 4] = base * (1 - a) + r * a; d[i * 4 + 1] = base * (1 - a) + gg * a; d[i * 4 + 2] = base * (1 - a) + b * a; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return sun;
}

export function ThermalDayViewer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [siteId, setSiteId] = useState(SITES[0]!.id);
  const [season, setSeason] = useState<Season>("summer");
  const [hour, setHour] = useState(10);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [grid, setGrid] = useState<Grid | null>(null);
  const [status, setStatus] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const site = SITES.find((s) => s.id === siteId)!;

  useEffect(() => {
    if (!open) return;
    let cancelled = false; setGrid(null); setStatus("Gelände wird geladen …");
    (async () => {
      try {
        const terrain = await loadRealTerrain(site);
        const raster = await loadThermalRaster(site).then((m) => m.raster).catch(() => null);
        if (!cancelled) { setGrid(buildGrid(terrain, raster)); setStatus(raster ? "" : "KK7-Daten nicht verfügbar – nur Sonneneinstrahlung"); }
      } catch { if (!cancelled) setStatus("Gelände konnte nicht geladen werden"); }
    })();
    return () => { cancelled = true; };
  }, [open, siteId]);

  useEffect(() => {
    if (!open || !playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      setHour((h) => { const n = h + dt * 0.5 * speed; return n > END ? START : n; });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, playing, speed]);

  const [sunInfo, setSunInfo] = useState("");
  useEffect(() => {
    if (!grid || !canvasRef.current) return;
    const sun = draw(canvasRef.current, grid, hour, site.lat, season);
    if (sun) setSunInfo(sun.z > 0 ? `☼ ${compassLabel(Math.atan2(sun.x, sun.y))} ${Math.round(Math.asin(sun.z) * 180 / Math.PI)}°` : "Sonne unter Horizont");
  }, [grid, hour, season, site.lat]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95dvh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Thermik im Tagesverlauf</DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-2 text-sm">
          <select aria-label="Fluggebiet" className="rounded-md border border-border bg-background px-2 py-1" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {SITES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select aria-label="Jahreszeit" className="rounded-md border border-border bg-background px-2 py-1" value={season} onChange={(e) => setSeason(e.target.value as Season)}>
            {(Object.keys(SEASONS) as Season[]).map((k) => <option key={k} value={k}>{SEASONS[k].label}</option>)}
          </select>
        </div>
        <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted">
          <canvas ref={canvasRef} width={G} height={G} className="h-full w-full" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground bg-primary" />
          <div className="absolute left-2 top-2 rounded bg-background/80 px-2 py-1 font-mono text-sm">{fmtClock(hour)} · {sunInfo}</div>
          <div className="absolute right-2 top-2 rounded bg-background/80 px-1.5 font-mono text-xs">N ↑ · 40 km</div>
          {status && <div className="absolute inset-x-2 bottom-2 rounded bg-background/80 px-2 py-1 text-xs">{status}</div>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="secondary" aria-label={playing ? "Pause" : "Abspielen"} onClick={() => setPlaying((p) => !p)}>{playing ? <Pause /> : <Play />}</Button>
          <input aria-label="Uhrzeit" type="range" min={START} max={END} step={0.05} value={hour} onChange={(e) => { setPlaying(false); setHour(Number(e.target.value)); }} className="flex-1 accent-primary" />
          <select aria-label="Geschwindigkeit" className="rounded-md border border-border bg-background px-2 py-1 text-sm" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {[0.5, 1, 2, 4].map((v) => <option key={v} value={v}>{v}×</option>)}
          </select>
        </div>
        <p className="text-xs text-muted-foreground">Farbe = erwartete Thermikstärke aus Sonneneinstrahlung, Hangausrichtung und KK7-Thermikkarte (blau schwach → rot stark). Thermikdaten: thermal.kk7.ch, CC BY-NC-SA.</p>
      </DialogContent>
    </Dialog>
  );
}
