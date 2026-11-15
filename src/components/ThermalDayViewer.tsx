import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { Pause, Play } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { SITES, SEASONS } from "@/game/sites";
import { sunPosition, sunVector, fmtClock } from "@/game/sun";
import { EXTENT, cloudbaseAt, heightAt, normalAt, type Terrain } from "@/game/terrain";
import { peakLift, slopeTrigger, sunlitSurfaceLift } from "@/game/thermals";
import { loadRealTerrain } from "@/game/realTerrain";
import { loadThermalRaster } from "@/game/loadThermalRaster";
import { rasterHeatAt, type ThermalRaster } from "@/game/thermalRaster";
import { compassLabel } from "@/game/sunDisplay";

const START = 8, END = 21;
const SITE = SITES.find((s) => s.id === "gummen") ?? SITES[0]!;
const SEASON = SEASONS.summer;
const MAX_RES = 420;

interface Win { terrain: Terrain; raster: ThermalRaster | null; cx: number; cy: number }
/** Static per-pixel fields for one rendered view; only sun-dependent terms are recomputed per frame. */
interface Field {
  w: number; h: number; x0: number; y0: number; mpp: number;
  ok: Uint8Array; elev: Float32Array; nx: Float32Array; ny: Float32Array; nz: Float32Array;
  kk7: Float32Array; peak: Float32Array; alt: Float32Array;
  min: number; max: number; win: Win;
}
interface View { cx: number; cy: number; mpp: number }

function buildField(win: Win, v: View, w: number, h: number): Field {
  const n = w * h, f: Field = {
    w, h, mpp: v.mpp, x0: v.cx - (w / 2) * v.mpp, y0: v.cy + (h / 2) * v.mpp,
    ok: new Uint8Array(n), elev: new Float32Array(n), nx: new Float32Array(n), ny: new Float32Array(n), nz: new Float32Array(n),
    kk7: new Float32Array(n), peak: new Float32Array(n), alt: new Float32Array(n), min: 1e9, max: -1e9, win,
  };
  const t = win.terrain, lim = EXTENT - 150;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const i = r * w + c, x = f.x0 + (c + 0.5) * v.mpp, y = f.y0 - (r + 0.5) * v.mpp;
    if (Math.abs(x - win.cx) > lim || Math.abs(y - win.cy) > lim) continue;
    f.ok[i] = 1;
    const g = heightAt(t, x, y), nn = normalAt(t, x, y);
    f.elev[i] = g; f.nx[i] = nn.x; f.ny[i] = nn.y; f.nz[i] = nn.z;
    const alt = Math.min(g + 150, cloudbaseAt(t, x, y) - 50);
    f.alt[i] = alt;
    const fade = Math.max(0, Math.min(1, (cloudbaseAt(t, x, y) - alt) / 200));
    f.peak[i] = peakLift(t, x, y) * fade;
    if (win.raster) {
      const heat = rasterHeatAt(win.raster, x, y);
      f.kk7[i] = heat > 0 ? (2 + 5.5 * Math.max(0, Math.min(1, (heat - 0.1) / 0.9))) * fade : 0;
    }
    if (g < f.min) f.min = g; if (g > f.max) f.max = g;
  }
  return f;
}

/** Climb-rate colours as in the flight sim: blue ~1 m/s → red ≥7 m/s. */
function ramp(v: number): [number, number, number] {
  const stops: [number, number, number][] = [[40, 90, 255], [0, 220, 230], [60, 210, 60], [255, 230, 0], [170, 0, 0]];
  const p = Math.max(0, Math.min(0.999, v)) * (stops.length - 1), k = Math.floor(p), q = p - k;
  const a = stops[k]!, b = stops[k + 1]!;
  return [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q, a[2] + (b[2] - a[2]) * q];
}

function renderField(f: Field, sun: { x: number; y: number; z: number }, out: HTMLCanvasElement) {
  if (out.width !== f.w || out.height !== f.h) { out.width = f.w; out.height = f.h; }
  const ctx = out.getContext("2d"); if (!ctx) return;
  const img = ctx.createImageData(f.w, f.h), d = img.data;
  const amp = Math.sqrt(Math.max(0, sun.z) / 0.87), span = Math.max(1, f.max - f.min), t = f.win.terrain;
  for (let r = 0; r < f.h; r++) for (let c = 0; c < f.w; c++) {
    const i = r * f.w + c, o = i * 4;
    if (!f.ok[i]) { d[o] = d[o + 1] = d[o + 2] = 40; d[o + 3] = 255; continue; }
    const irr = f.nx[i] * sun.x + f.ny[i] * sun.y + f.nz[i] * sun.z;
    const light = sun.z > 0 ? 0.35 + 0.65 * Math.max(0, irr) : 0.2;
    const elev = (f.elev[i] - f.min) / span, base = (90 + 120 * elev) * light;
    let lift = 0;
    if (sun.z > 0) {
      const local = slopeTrigger({ x: f.nx[i], y: f.ny[i], z: f.nz[i] }, sun);
      const x = f.x0 + (c + 0.5) * f.mpp, y = f.y0 - (r + 0.5) * f.mpp;
      const surface = sunlitSurfaceLift(t, x, y, f.alt[i], sun);
      // KK7 is an all-day average: scale it with sun strength and local exposure for the diurnal cycle.
      const kk7 = f.kk7[i] * amp * (0.35 + 0.65 * local);
      lift = Math.max(f.peak[i] * amp, surface, kk7);
    }
    const a = Math.max(0, Math.min(0.85, (lift - 0.8) / 2.5));
    const [cr, cg, cb] = ramp((lift - 1) / 6.5);
    d[o] = base * (1 - a) + cr * a; d[o + 1] = base * (1 - a) + cg * a; d[o + 2] = base * (1 - a) + cb * a; d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export function ThermalDayViewer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [hour, setHour] = useState(10);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>({ cx: 0, cy: 0, mpp: 100 });
  const [win, setWin] = useState<Win | null>(null);
  const [field, setField] = useState<Field | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufRef = useRef<HTMLCanvasElement | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view); viewRef.current = view;
  const loadingRef = useRef(false);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const autoStarted = useRef(false);

  const boxSize = () => { const r = boxRef.current?.getBoundingClientRect(); return { w: r?.width || 400, h: r?.height || 400 }; };
  const resetView = () => { const { w } = boxSize(); setView({ cx: 0, cy: 0, mpp: (2 * EXTENT) / w }); };
  const zoomAt = (px: number, py: number, k: number) => setView((v) => {
    const { w, h } = boxSize();
    const mpp = Math.max(8, Math.min(250, v.mpp / k));
    const wx = v.cx + (px - w / 2) * v.mpp, wy = v.cy - (py - h / 2) * v.mpp;
    return { mpp, cx: wx - (px - w / 2) * mpp, cy: wy + (py - h / 2) * mpp };
  });

  useEffect(() => { if (open) { autoStarted.current = false; setReady(false); setPlaying(false); requestAnimationFrame(resetView); } }, [open]);

  // Load / move the 40 km terrain + KK7 window so it follows the visible area.
  useEffect(() => {
    if (!open || loadingRef.current) return;
    if (win && Math.abs(view.cx - win.cx) < EXTENT * 0.45 && Math.abs(view.cy - win.cy) < EXTENT * 0.45) return;
    const cx = Math.round(view.cx / 2000) * 2000, cy = Math.round(view.cy / 2000) * 2000;
    let cancelled = false; loadingRef.current = true;
    setStatus("Lade Höhendaten & Thermikraster …");
    (async () => {
      try {
        const [terrain, raster] = await Promise.all([
          loadRealTerrain(SITE, cx, cy),
          loadThermalRaster(SITE, cx, cy).then((m) => m.raster).catch(() => null),
        ]);
        if (!cancelled) { setWin({ terrain, raster, cx, cy }); setStatus(raster ? "" : "KK7-Daten nicht verfügbar – nur Gelände/Sonne"); }
      } catch { if (!cancelled) setStatus("Gelände konnte nicht geladen werden"); }
      finally { loadingRef.current = false; }
    })();
    return () => { cancelled = true; loadingRef.current = false; };
  }, [open, view.cx, view.cy, win]);

  // Rebuild static fields for the visible area (debounced while panning/zooming).
  useEffect(() => {
    if (!win) return;
    const id = setTimeout(() => {
      const { w, h } = boxSize();
      const s = Math.min(1, MAX_RES / Math.max(w, h)) * Math.min(2, window.devicePixelRatio || 1);
      const pw = Math.max(64, Math.round(w * s)), ph = Math.max(64, Math.round(h * s));
      const v = viewRef.current;
      setField(buildField(win, { ...v, mpp: v.mpp * (w / pw) }, pw, ph));
      if (!autoStarted.current) { autoStarted.current = true; setReady(true); setPlaying(true); }
    }, 120);
    return () => clearTimeout(id);
  }, [win, view]);

  // Animation clock — only after data is loaded.
  useEffect(() => {
    if (!open || !playing || !ready) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      setHour((h) => { const n = h + dt * 0.5 * speed; return n > END ? START : n; });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, playing, ready, speed]);

  const sun = sunVector(sunPosition(SITE.lat, SEASON.doy, hour, SEASON.dst));
  const sunKey = Math.round(hour * 30); // redraw every 2 simulated minutes
  useEffect(() => {
    if (!field) return;
    if (!bufRef.current) bufRef.current = document.createElement("canvas");
    renderField(field, sun, bufRef.current);
    blit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field, sunKey]);

  // Draw buffer onto visible canvas using current view (instant feedback while dragging).
  const blit = () => {
    const c = canvasRef.current, b = bufRef.current, f = field; if (!c || !b || !f) return;
    const { w, h } = boxSize(), dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const ctx = c.getContext("2d"); if (!ctx) return;
    const v = viewRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#282828"; ctx.fillRect(0, 0, w, h);
    const sx = (f.x0 - v.cx) / v.mpp + w / 2, sy = (v.cy - f.y0) / v.mpp + h / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(b, sx, sy, (f.w * f.mpp) / v.mpp, (f.h * f.mpp) / v.mpp);
  };
  useEffect(blit);

  useEffect(() => {
    const el = boxRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-dy * 0.0015));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open, win]);

  const onPointerDown = (e: RPointerEvent) => { (e.target as Element).setPointerCapture?.(e.pointerId); ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); };
  const onPointerUp = (e: RPointerEvent) => { ptrs.current.delete(e.pointerId); };
  const onPointerMove = (e: RPointerEvent) => {
    const m = ptrs.current, prev = m.get(e.pointerId); if (!prev) return;
    const rect = boxRef.current!.getBoundingClientRect();
    if (m.size === 1) {
      setView((v) => ({ ...v, cx: v.cx - (e.clientX - prev.x) * v.mpp, cy: v.cy + (e.clientY - prev.y) * v.mpp }));
    } else if (m.size === 2) {
      const other = [...m.entries()].find(([id]) => id !== e.pointerId)![1];
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y), d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (d0 > 0) zoomAt((e.clientX + other.x) / 2 - rect.left, (e.clientY + other.y) / 2 - rect.top, d1 / d0);
    }
    m.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const sunInfo = sun.z > 0 ? `☼ ${compassLabel(Math.atan2(sun.x, sun.y))} ${Math.round(Math.asin(sun.z) * 180 / Math.PI)}°` : "Sonne unter Horizont";
  const scaleKm = Math.round(view.mpp * 100) / 1000;
  const zoomBtn = (k: number) => { const { w, h } = boxSize(); zoomAt(w / 2, h / 2, k); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95dvh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Thermik im Tagesverlauf</DialogTitle></DialogHeader>
        <div ref={boxRef} className="relative aspect-square w-full touch-none select-none overflow-hidden rounded-lg border border-border bg-muted cursor-grab active:cursor-grabbing"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onDoubleClick={resetView}>
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
          <div className="absolute bottom-2 right-2 flex gap-1" onPointerDown={(e) => e.stopPropagation()}>
            <Button size="sm" variant="secondary" aria-label="Hineinzoomen" onClick={() => zoomBtn(1.4)}>+</Button>
            <Button size="sm" variant="secondary" aria-label="Herauszoomen" onClick={() => zoomBtn(1 / 1.4)}>−</Button>
            <Button size="sm" variant="secondary" onClick={resetView}>Reset</Button>
          </div>
          <div className="absolute left-2 top-2 rounded bg-background/80 px-2 py-1 font-mono text-sm">{fmtClock(hour)} · {sunInfo}</div>
          <div className="absolute right-2 top-2 rounded bg-background/80 px-1.5 font-mono text-xs">N ↑ · 100 px ≈ {scaleKm} km</div>
          {(status || !ready) && <div className="absolute inset-x-2 bottom-12 rounded bg-background/80 px-2 py-1 text-xs">{status || "Lade Höhendaten & Thermikraster …"}</div>}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Button size="icon" variant="secondary" disabled={!ready} aria-label={playing ? "Pause" : "Abspielen"} onClick={() => setPlaying((p) => !p)}>{playing ? <Pause /> : <Play />}</Button>
          <label className="w-20 shrink-0 text-muted-foreground">Tageszeit</label>
          <input aria-label="Tageszeit" type="range" min={START} max={END} step={1 / 60} value={hour} onChange={(e) => { setPlaying(false); setHour(Number(e.target.value)); }} className="flex-1 accent-primary" />
          <span className="w-12 text-right font-mono">{fmtClock(hour)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-10 shrink-0" />
          <label className="w-20 shrink-0 text-muted-foreground">Tempo</label>
          <input aria-label="Animationsgeschwindigkeit" type="range" min={-2} max={3} step={0.25} value={Math.log2(speed)} onChange={(e) => setSpeed(2 ** Number(e.target.value))} className="flex-1 accent-primary" />
          <span className="w-12 text-right font-mono">{speed < 1 ? speed.toFixed(2) : speed.toFixed(1)}×</span>
        </div>
        <p className="text-xs text-muted-foreground">Farbe = erwartetes Steigen aus Gipfelthermik, besonnten Hängen und KK7-Thermikkarte (blau ≈ 1 m/s → rot ≥ 7 m/s), abhängig vom Sonnenstand. Karte verschieben/zoomen zeigt die Entwicklung im gewählten Bereich. Thermikdaten: thermal.kk7.ch, CC BY-NC-SA.</p>
      </DialogContent>
    </Dialog>
  );
}
