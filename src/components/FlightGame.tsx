import { useEffect, useRef, useState } from "react";
import { MapCanvas, drawScene } from "./MapCanvas";
import { FlightHUD, WaypointCompass, type HudData } from "./FlightHUD";
import { StartScreen, type FlightConfig } from "./StartScreen";
import { generateTerrain, heightAt, gradientAt, cloudbaseAt, normalAt } from "@/game/terrain";
import { airLift, slopeTrigger } from "@/game/thermals";
import { generateHotspotThermals, loadThermalHotspots } from "@/game/thermalHotspots";
import { stepPhysics, steer, timeScale, glideRatio, type Sim, type Input } from "@/game/physicsEngine";
import { generateTask, inCylinder, xcDistance, mulberry32 } from "@/game/task";
import { sunPosition, sunVector, fmtClock } from "@/game/sun";
import { SEASONS } from "@/game/sites";
import { loadRealTerrain } from "@/game/realTerrain";
import { AudioVario } from "@/game/audioVario";
import { useCanvasZoom } from "@/hooks/useCanvasZoom";
import { ZoomControls } from "./ZoomControls";
import { SideProfile, drawSideProfile } from "./SideProfile";
import { Button } from "./ui/button";

type Phase = "config" | "loading" | "flying" | "done" | "error";

export function FlightGame() {
  const [phase, setPhase] = useState<Phase>("config");
  const [config, setConfig] = useState<FlightConfig | null>(null);
  const [hud, setHud] = useState<HudData | null>(null);
  const [result, setResult] = useState<{ goal: boolean; xc: number; time: number; reason: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);
  const mapZoom = useCanvasZoom(0.3, 8, phase !== "config");
  const profileZoom = useCanvasZoom(0.5, 6, phase !== "config" && hud !== null);
  const { canvasRef } = mapZoom;
  const input = useRef<Input>({ left: false, right: false, accel: false });
  const [simSpeed, setSimSpeed] = useState(1);
  const [showThermals, setShowThermals] = useState(false);
  const simSpeedRef = useRef(1);
  const showThermalsRef = useRef(false);
  simSpeedRef.current = simSpeed;
  showThermalsRef.current = showThermals;
  const vario = useRef<AudioVario | null>(null);

  const start = (c: FlightConfig) => {
    if (!vario.current) vario.current = new AudioVario();
    vario.current.start();
    setConfig(c);
    setHud(null);
    setLoadError(null);
    mapZoom.reset(); profileZoom.reset();
    setResult(null);
    setPhase("loading");
    setRunId((r) => r + 1);
  };

  useEffect(() => {
    if (runId === 0 || !config) return;
    let raf = 0, cancelled = false;
    const timer = setTimeout(async () => {
      let terrain, hotspots;
      try {
        [terrain, hotspots] = await Promise.all([
          loadRealTerrain(config.site).catch(() => generateTerrain(config.site)),
          loadThermalHotspots(config.site),
        ]);
      } catch {
        if (cancelled) return;
        vario.current?.update(0);
        setLoadError("Thermikpunkte von KK7 konnten nicht geladen werden.");
        setPhase("error");
        return;
      }
      if (cancelled) return;
      const rnd = mulberry32((Math.random() * 1e9) | 0);
      const thermals = generateHotspotThermals(terrain, hotspots, rnd);
      const task = generateTask(rnd);
      const season = SEASONS[config.season];
      const g = gradientAt(terrain, 0, 0);
      const sim: Sim = {
        x: 0, y: 0, alt: heightAt(terrain, 0, 0) + 40, heading: Math.atan2(-g.gx, -g.gy),
        vz: 0, airLift: 0, speed: 10, distance: 0, flightTime: 0, clock: config.startHour, landed: false,
      };
      const trail: { x: number; y: number; vz: number }[] = [];
      let next = 0, last = performance.now(), lastHud = 0, smoothVz = 0, avgVz10 = 0, trailT = 0;
      if (cancelled) return;
      setPhase("flying");

      const loop = (now: number) => {
        const dtReal = Math.min(0.05, (now - last) / 1000);
        last = now;
        const inp = input.current;
        steer(sim, inp, dtReal);
        const simDt = dtReal * timeScale(inp.accel, simSpeedRef.current);
        const sp = sunPosition(config.site.lat, season.doy, sim.clock, season.dst);
        const sv = sunVector(sp);
        const steps = Math.ceil(simDt / 0.05);
        for (let i = 0; i < steps && !sim.landed; i++) {
          const lift = airLift(thermals, terrain, sim.x, sim.y, sim.alt, sim.flightTime + config.startHour * 3600, sv, season.maxLift);
          stepPhysics(sim, inp, simDt / steps, terrain, lift);
        }
        smoothVz += (sim.vz - smoothVz) * Math.min(1, dtReal * 4);
        avgVz10 += (sim.vz - avgVz10) * Math.min(1, simDt / 10);
        vario.current?.update(smoothVz);
        if (next < 3 && inCylinder(sim.x, sim.y, task.waypoints[next])) next++;
        trailT += simDt;
        if (trailT > 2) { trailT = 0; trail.push({ x: sim.x, y: sim.y, vz: smoothVz }); if (trail.length > 1500) trail.shift(); }

        const dusk = Math.max(0, Math.min(1, (0.12 - sp.el) / 0.2));
        if (canvasRef.current) drawScene(canvasRef.current, { site: config.site, sim, task, next, trail, dusk, thermals: showThermalsRef.current ? thermals : null }, mapZoom.transform.current);
        if (profileZoom.canvasRef.current) drawSideProfile(profileZoom.canvasRef.current, terrain, sim, profileZoom.transform.current);

        const xc = xcDistance(task, next, sim.x, sim.y);
        if (now - lastHud > 100) {
          lastHud = now;
          const wp = task.waypoints[Math.min(next, 2)];
          const brg = Math.atan2(wp.x - sim.x, wp.y - sim.y);
          setHud({
            alt: sim.alt, agl: sim.alt - heightAt(terrain, sim.x, sim.y), vz: smoothVz, vz10: avgVz10, speed: sim.speed,
            wpName: wp.name, wpDist: Math.hypot(wp.x - sim.x, wp.y - sim.y), wpRel: brg - sim.heading,
            xc, xcSpeed: sim.flightTime > 0 ? (xc / 1000) / (sim.flightTime / 3600) : 0,
            clock: fmtClock(sim.clock), accel: inp.accel, cloudbase: cloudbaseAt(terrain, sim.x, sim.y),
            taskType: task.type, next,
          });
        }
        if (sim.landed || next >= 3) {
          vario.current?.update(0);
          setResult({ goal: next >= 3, xc, time: sim.flightTime, reason: next >= 3 ? "Ziel erreicht!" : "Gelandet" });
          setPhase("done");
          return;
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }, 30);
    return () => { cancelled = true; clearTimeout(timer); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  useEffect(() => {
    const set = (e: KeyboardEvent, v: boolean) => {
      if (e.code === "ArrowLeft") input.current.left = v;
      else if (e.code === "ArrowRight") input.current.right = v;
      else if (e.code === "Space" || e.code === "ArrowUp") input.current.accel = v;
      else return;
      e.preventDefault();
    };
    const down = (e: KeyboardEvent) => set(e, true), up = (e: KeyboardEvent) => set(e, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  if (phase === "config") return <StartScreen onStart={start} />;

  const hold = (k: keyof Input) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); input.current[k] = true; },
    onPointerUp: () => { input.current[k] = false; },
    onPointerLeave: () => { input.current[k] = false; },
    onPointerCancel: () => { input.current[k] = false; },
  });

  return (
    <div className="fixed inset-0 touch-none select-none overflow-hidden bg-background">
      <MapCanvas ref={canvasRef} />
      <div className="absolute bottom-0 right-0 z-10 flex flex-wrap justify-end gap-x-2 bg-background/90 px-2 py-1 font-mono text-[9px] text-foreground">
        <a href="https://www.swisstopo.admin.ch/de/nutzungsbedingungen" target="_blank" rel="noopener noreferrer">© swisstopo · Relief</a>
        <a href="https://thermal.kk7.ch/" target="_blank" rel="noopener noreferrer">Thermik: M. von Känel · KK7</a>
        <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0 · bearbeitet</a>
      </div>
      {phase === "loading" && (
        <div className="absolute inset-0 grid place-items-center bg-background">
          <p className="animate-pulse font-mono text-sm text-muted-foreground">Lade Geländehöhen & KK7-Thermikpunkte…</p>
        </div>
      )}
      <div className="absolute left-3 top-3 rounded-md border border-border bg-card/95 p-1.5 font-mono text-[10px] text-foreground backdrop-blur-md">
        <ZoomControls label="Karte" scale={mapZoom.scale} change={mapZoom.change} reset={mapZoom.reset} />
      </div>
      {hud && <WaypointCompass d={hud} />}
      {hud && <div className="absolute bottom-[94px] right-2 left-2 flex items-stretch justify-end gap-2 sm:bottom-8 sm:left-auto sm:right-3">
        <section aria-label="Seitenansicht" className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-card/95 backdrop-blur-md">
          <header className="flex flex-wrap items-center justify-between gap-x-1 border-b border-border px-1.5 py-0.5">
            <span className="font-mono text-[9px] text-muted-foreground sm:text-[10px]">BERGPROFIL</span>
            <ZoomControls label="Seitenansicht" scale={profileZoom.scale} change={profileZoom.change} reset={profileZoom.reset} />
          </header>
          <div className="relative min-h-0 flex-1"><div className="absolute inset-0"><SideProfile ref={profileZoom.canvasRef} /></div></div>
        </section>
        <FlightHUD d={hud} />
        <div className="flex flex-col items-center justify-between gap-1 rounded-md border border-border bg-card/95 px-1.5 py-1 font-mono text-foreground backdrop-blur-md">
          <label className="flex items-center gap-1 text-[9px]" title="Thermikkarte ein-/ausblenden">
            <input type="checkbox" checked={showThermals} onChange={(e) => setShowThermals(e.target.checked)} className="accent-primary" />
            Thermik
          </label>
          <input type="range" min={1} max={20} step={1} value={simSpeed} aria-label="Simulationsgeschwindigkeit"
            title={`Sim ×${simSpeed} · Speed ×${simSpeed * 5}`}
            onChange={(e) => setSimSpeed(Number(e.target.value))}
            className="min-h-0 w-5 flex-1 accent-primary [direction:rtl] [writing-mode:vertical-rl]" />
          <span className="text-[9px]">×{simSpeed}</span>
        </div>
      </div>}
      <div className="absolute inset-x-2 bottom-3 flex gap-2 sm:hidden">
        <button className="ctrl-btn h-16 flex-1 text-2xl" {...hold("left")}>←</button>
        <button className="ctrl-btn h-16 flex-1 text-sm font-bold" {...hold("accel")}>SPEED</button>
        <button className="ctrl-btn h-16 flex-1 text-2xl" {...hold("right")}>→</button>
      </div>
      {phase === "done" && result && (
        <div className="absolute inset-0 grid place-items-center bg-background/70 p-6 backdrop-blur-sm">
          <div className="hud-panel w-full max-w-sm p-6 text-center">
            <p className="hud-label">{config?.site.name}</p>
            <h2 className={`mt-1 font-display text-4xl font-bold ${result.goal ? "text-climb" : "text-foreground"}`}>{result.reason}</h2>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="hud-cell"><div className="hud-label">XC</div><div className="hud-value text-2xl">{(result.xc / 1000).toFixed(1)} km</div></div>
              <div className="hud-cell"><div className="hud-label">Flugzeit</div><div className="hud-value text-2xl">{Math.floor(result.time / 60)} min</div></div>
            </div>
            <div className="mt-5 flex gap-2">
              <button className="flex-1 rounded-lg bg-primary py-3 font-bold text-primary-foreground" onClick={() => config && start(config)}>Nochmal</button>
              <button className="flex-1 rounded-lg border border-border py-3 font-bold text-foreground" onClick={() => { setRunId(0); setPhase("config"); }}>Menü</button>
            </div>
          </div>
        </div>
      )}
      {phase === "error" && <div className="absolute inset-0 z-20 grid place-items-center bg-background/95 p-6">
        <div className="max-w-sm space-y-4 text-center">
          <p className="text-foreground">{loadError}</p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => config && start(config)}>Erneut versuchen</Button>
            <Button variant="outline" onClick={() => { setRunId(0); setPhase("config"); }}>Menü</Button>
          </div>
        </div>
      </div>}
    </div>
  );
}
