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
import { visibleReliefTiles, waterTileUrl, MERCATOR_EXTENT, mapOrigin } from "@/game/swissMap";
import { ATLAS_ZOOM, combineLift, deriveAtlas, loadThermalAtlas, ramp, renderAtlas, type Atlas, type ThermalFilters } from "@/game/thermalAtlas";

const DETAIL_MPP = 60;
let atlasPromise: Promise<{ atlas: Atlas; cached: boolean }> | null = null;
const ORIGIN = () => mapOrigin(SITE);
/** Atlas pixel → launch-relative metres (Mercator is linear per axis). */
function atlasToLocal(px: number, py: number) {
  const o = ORIGIN(), world = 256 * 2 ** ATLAS_ZOOM;
  return { x: ((px / world) * 2 * MERCATOR_EXTENT - MERCATOR_EXTENT - o.x) * o.scale, y: (MERCATOR_EXTENT - (py / world) * 2 * MERCATOR_EXTENT - o.y) * o.scale };
}

/** Faintly blue-tinted swisstopo lake tiles, cached per URL (bounded). */
const lakeCache = new Map<string, HTMLCanvasElement | null>();
function lakeTile(url: string, onLoad: () => void) {
  if (lakeCache.has(url)) return lakeCache.get(url) ?? null;
  lakeCache.set(url, null);
  if (lakeCache.size > 200) { const k = lakeCache.keys().next().value; if (k !== undefined) lakeCache.delete(k); }
  const img = new Image(); img.crossOrigin = "anonymous";
  img.onload = () => {
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d"); if (!g) return;
    g.drawImage(img, 0, 0); g.globalCompositeOperation = "source-in";
    g.fillStyle = "rgba(90,160,235,0.4)"; g.fillRect(0, 0, c.width, c.height);
    lakeCache.set(url, c); onLoad();
  };
  img.src = url;
  return null;
}

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


function renderField(f: Field, sun: { x: number; y: number; z: number }, flt: ThermalFilters, out: HTMLCanvasElement) {
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
      lift = combineLift(flt, f.peak[i] * amp, local > 0 ? (1 + 3 * local) * amp : 0, surface, kk7);
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
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>({ cx: 0, cy: 0, mpp: 100 });
  const [win, setWin] = useState<Win | null>(null);
  const [field, setField] = useState<Field | null>(null);
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [progress, setProgress] = useState(0);
  const [flt, setFlt] = useState<ThermalFilters>({ peak: true, sun: true, slope: true, kk7: true });
  const atlasBuf = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufRef = useRef<HTMLCanvasElement | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef(view); viewRef.current = view;
  const loadingRef = useRef(false);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const autoStarted = useRef(false);

  const boxSize = () => { const r = boxRef.current?.getBoundingClientRect(); return { w: r?.width || 400, h: r?.height || 400 }; };
  const resetView = () => {
    const { w, h } = boxSize(), a = atlas;
    if (!a) { setView({ cx: 0, cy: 0, mpp: (2 * EXTENT) / w }); return; }
    const p = atlasToLocal(a.px0, a.py0), q = atlasToLocal(a.px0 + a.w * a.step, a.py0 + a.h * a.step);
    setView({ cx: (p.x + q.x) / 2, cy: (p.y + q.y) / 2, mpp: Math.max((q.x - p.x) / w, (p.y - q.y) / h) });
  };
  const zoomAt = (px: number, py: number, k: number) => setView((v) => {
    const { w, h } = boxSize();
    const mpp = Math.max(8, Math.min(1500, v.mpp / k));
    const wx = v.cx + (px - w / 2) * v.mpp, wy = v.cy - (py - h / 2) * v.mpp;
    return { mpp, cx: wx - (px - w / 2) * mpp, cy: wy + (py - h / 2) * mpp };
  });

  useEffect(() => { if (open) { autoStarted.current = false; setPlaying(false); } }, [open]);

  // Whole-Switzerland atlas: downloaded once per device on first open, then read from device storage.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    atlasPromise ??= loadThermalAtlas(typeof location !== "undefined" ? location.hostname : "xcfly", (p) => setProgress(p))
      .then(({ stored, cached }) => {
        const o = ORIGIN(), mpc = ((2 * MERCATOR_EXTENT) / (256 * 2 ** ATLAS_ZOOM)) * o.scale * stored.step;
        return { atlas: deriveAtlas(stored, mpc), cached };
      });
    atlasPromise.then(({ atlas }) => { if (!cancelled) setAtlas(atlas); }).catch(() => { atlasPromise = null; if (!cancelled) setStatus("Karte konnte nicht geladen werden – bitte erneut öffnen"); });
    return () => { cancelled = true; };
  }, [open]);
  useEffect(() => {
    if (!open || !atlas) return;
    requestAnimationFrame(resetView);
    if (!autoStarted.current) { autoStarted.current = true; setReady(true); setPlaying(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, atlas]);

  // Load / move the 40 km terrain + KK7 window so it follows the visible area.
  useEffect(() => {
    if (!open || loadingRef.current || view.mpp > DETAIL_MPP) return;
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
  }, [open, view.cx, view.cy, view.mpp, win]);

  // Rebuild static fields for the visible area (debounced while panning/zooming).
  useEffect(() => {
    if (!win) return;
    const id = setTimeout(() => {
      const { w, h } = boxSize();
      const s = Math.min(1, MAX_RES / Math.max(w, h)) * Math.min(2, window.devicePixelRatio || 1);
      const pw = Math.max(64, Math.round(w * s)), ph = Math.max(64, Math.round(h * s));
      const v = viewRef.current;
      if (v.mpp > DETAIL_MPP) return;
      setField(buildField(win, { ...v, mpp: v.mpp * (w / pw) }, pw, ph));
    }, 120);
    return () => clearTimeout(id);
  }, [win, view]);

  // Animation clock — only after data is loaded.
  useEffect(() => {
    if (!open || !playing || !ready) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      setHour((h) => { const n = h + dt * 0.5; return n > END ? START : n; });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, playing, ready]);

  const sun = sunVector(sunPosition(SITE.lat, SEASON.doy, hour, SEASON.dst));
  const sunKey = Math.round(hour * 30); // redraw every 2 simulated minutes
  useEffect(() => {
    if (!field) return;
    if (!bufRef.current) bufRef.current = document.createElement("canvas");
    renderField(field, sun, flt, bufRef.current);
    blit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field, sunKey, flt]);
  useEffect(() => {
    if (!atlas) return;
    if (!atlasBuf.current) atlasBuf.current = document.createElement("canvas");
    renderAtlas(atlas, sun, flt, atlasBuf.current);
    blit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atlas, sunKey, flt]);

  // Draw buffer onto visible canvas using current view (instant feedback while dragging).
  const blit = () => {
    const c = canvasRef.current; if (!c) return;
    const { w, h } = boxSize(), dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const ctx = c.getContext("2d"); if (!ctx) return;
    const v = viewRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#282828"; ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    const ab = atlasBuf.current, a = atlas;
    if (ab && a) {
      const p = atlasToLocal(a.px0, a.py0), q = atlasToLocal(a.px0 + a.w * a.step, a.py0 + a.h * a.step);
      ctx.drawImage(ab, (p.x - v.cx) / v.mpp + w / 2, (v.cy - p.y) / v.mpp + h / 2, (q.x - p.x) / v.mpp, (p.y - q.y) / v.mpp);
    }
    const b = bufRef.current, f = field;
    if (!b || !f || v.mpp > DETAIL_MPP) return;
    const sx = (f.x0 - v.cx) / v.mpp + w / 2, sy = (v.cy - f.y0) / v.mpp + h / 2;
    ctx.drawImage(b, sx, sy, (f.w * f.mpp) / v.mpp, (f.h * f.mpp) / v.mpp);
    // Lakes: tiles are anchored at 55% height; shift to our centred view.
    const dy = -0.05 * h;
    for (const t of visibleReliefTiles(SITE, v.cx, v.cy, w, h, 1 / v.mpp, dpr, 15)) {
      const lake = lakeTile(waterTileUrl(t.x, t.y, t.level), () => blitRef.current());
      if (lake) ctx.drawImage(lake, t.left, t.top + dy, t.size + 0.5, t.size + 0.5);
    }
  };
  const blitRef = useRef(blit); blitRef.current = blit;
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
      <DialogContent className="left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 p-0 sm:rounded-none">
        <DialogHeader className="sr-only"><DialogTitle>Thermik im Tagesverlauf</DialogTitle></DialogHeader>
        <div ref={boxRef} className="absolute inset-0 touch-none select-none overflow-hidden bg-muted cursor-grab active:cursor-grabbing"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onDoubleClick={resetView}>
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
          <div className="absolute left-2 top-2 rounded bg-background/80 px-2 py-1 font-mono text-sm">{fmtClock(hour)} · {sunInfo}</div>
          <div className="absolute right-12 top-3 rounded bg-background/80 px-1.5 font-mono text-xs">N ↑ · 100 px ≈ {scaleKm} km</div>
          <div className="absolute inset-x-2 top-10 flex flex-wrap gap-1" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
            {([["peak", "Gipfel"], ["sun", "Sonnenhänge"], ["slope", "Hangaufwind"], ["kk7", "KK7"]] as const).map(([k, label]) => (
              <Button key={k} size="sm" variant={flt[k] ? "default" : "secondary"} aria-pressed={flt[k]} className="h-7 px-2 text-xs" onClick={() => setFlt((f) => ({ ...f, [k]: !f[k] }))}>{label}</Button>
            ))}
          </div>
          {(status || !ready) && <div className="absolute inset-x-2 top-20 rounded bg-background/80 px-2 py-1 text-xs">{status || `Karte wird einmalig auf dieses Gerät geladen … ${Math.round(progress * 100)}%`}</div>}
          <div className="absolute inset-x-2 bottom-2 space-y-1 rounded-lg bg-background/80 p-2 backdrop-blur" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-sm">
              <Button size="icon" variant="secondary" disabled={!ready} aria-label={playing ? "Pause" : "Abspielen"} onClick={() => setPlaying((p) => !p)}>{playing ? <Pause /> : <Play />}</Button>
              <input aria-label="Tageszeit" type="range" min={START} max={END} step={1 / 60} value={hour} onChange={(e) => { setPlaying(false); setHour(Number(e.target.value)); }} className="flex-1 accent-primary" />
              <span className="w-12 text-right font-mono">{fmtClock(hour)}</span>
              <Button size="sm" variant="secondary" aria-label="Hineinzoomen" onClick={() => zoomBtn(1.4)}>+</Button>
              <Button size="sm" variant="secondary" aria-label="Herauszoomen" onClick={() => zoomBtn(1 / 1.4)}>−</Button>
              <Button size="sm" variant="secondary" onClick={resetView}>Reset</Button>
            </div>
            <p className="text-[10px] leading-tight text-muted-foreground">Farbe = erwartetes Steigen (blau ≈ 1 m/s → rot ≥ 7 m/s) aus Gipfelthermik, besonnten Hängen und KK7. Thermikdaten: thermal.kk7.ch, CC BY-NC-SA · Seen: swisstopo/BAFU.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
