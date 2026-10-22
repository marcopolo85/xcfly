import { useEffect, useRef, useState } from "react";
import { MapCanvas, drawScene } from "./MapCanvas";
import { FlightHUD, type HudData } from "./FlightHUD";
import { StartScreen, type FlightConfig } from "./StartScreen";
import { generateTerrain, renderTerrain, heightAt, gradientAt, cloudbaseAt, normalAt } from "@/game/terrain";
import { generateThermals, airLift, slopeTrigger } from "@/game/thermals";
import { stepPhysics, steer, timeScale, glideRatio, type Sim, type Input } from "@/game/physicsEngine";
import { generateTask, inCylinder, xcDistance, mulberry32 } from "@/game/task";
import { sunPosition, sunVector, fmtClock } from "@/game/sun";
import { SEASONS } from "@/game/sites";
import { AudioVario } from "@/game/audioVario";

type Phase = "config" | "loading" | "flying" | "done";

export function FlightGame() {
  const [phase, setPhase] = useState<Phase>("config");
  const [config, setConfig] = useState<FlightConfig | null>(null);
  const [hud, setHud] = useState<HudData | null>(null);
  const [result, setResult] = useState<{ goal: boolean; xc: number; time: number; reason: string } | null>(null);
  const [muted, setMuted] = useState(false);
  const [runId, setRunId] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const input = useRef<Input>({ left: false, right: false, accel: false });
  const vario = useRef<AudioVario | null>(null);

  const start = (c: FlightConfig) => {
    if (!vario.current) vario.current = new AudioVario();
    vario.current.start();
    setConfig(c);
    setResult(null);
    setPhase("loading");
    setRunId((r) => r + 1);
  };

  useEffect(() => { if (vario.current) vario.current.muted = muted; }, [muted]);

  useEffect(() => {
    if (runId === 0 || !config) return;
    let raf = 0, cancelled = false;
    const timer = setTimeout(() => {
      const terrain = generateTerrain(config.site);
      const terrainImg = renderTerrain(terrain);
      const rnd = mulberry32((Math.random() * 1e9) | 0);
      const thermals = generateThermals(terrain, rnd);
      const task = generateTask(rnd);
      const season = SEASONS[config.season];
      const g = gradientAt(terrain, 0, 0);
      const sim: Sim = {
        x: 0, y: 0, alt: heightAt(terrain, 0, 0) + 25, heading: Math.atan2(-g.gx, -g.gy),
        vz: 0, airLift: 0, speed: 10, distance: 0, flightTime: 0, clock: config.startHour, landed: false,
      };
      const trail: { x: number; y: number; vz: number }[] = [];
      let next = 0, last = performance.now(), lastHud = 0, smoothVz = 0, trailT = 0;
      if (cancelled) return;
      setPhase("flying");

      const loop = (now: number) => {
        const dtReal = Math.min(0.05, (now - last) / 1000);
        last = now;
        const inp = input.current;
        steer(sim, inp, dtReal);
        const simDt = dtReal * timeScale(inp.accel);
        const sp = sunPosition(config.site.lat, season.doy, sim.clock, season.dst);
        const sv = sunVector(sp);
        const steps = Math.ceil(simDt / 0.05);
        for (let i = 0; i < steps && !sim.landed; i++) {
          const lift = airLift(thermals, terrain, sim.x, sim.y, sim.alt, sim.flightTime + config.startHour * 3600, sv, season.maxLift);
          stepPhysics(sim, inp, simDt / steps, terrain, lift);
        }
        smoothVz += (sim.vz - smoothVz) * Math.min(1, dtReal * 4);
        vario.current?.update(smoothVz);
        if (next < 3 && inCylinder(sim.x, sim.y, task.waypoints[next])) next++;
        trailT += simDt;
        if (trailT > 2) { trailT = 0; trail.push({ x: sim.x, y: sim.y, vz: smoothVz }); if (trail.length > 1500) trail.shift(); }

        const dusk = Math.max(0, Math.min(1, (0.12 - sp.el) / 0.2));
        if (canvasRef.current) drawScene(canvasRef.current, { terrainImg, sim, task, next, trail, dusk });

        const xc = xcDistance(task, next, sim.x, sim.y);
        if (now - lastHud > 100) {
          lastHud = now;
          const wp = task.waypoints[Math.min(next, 2)];
          const brg = Math.atan2(wp.x - sim.x, wp.y - sim.y);
          setHud({
            alt: sim.alt, agl: sim.alt - heightAt(terrain, sim.x, sim.y), vz: smoothVz, ld: glideRatio(sim.speed, smoothVz),
            wpName: wp.name, wpDist: Math.hypot(wp.x - sim.x, wp.y - sim.y), wpRel: brg - sim.heading,
            flightTime: sim.flightTime, distance: sim.distance, xc, xcSpeed: sim.flightTime > 0 ? (xc / 1000) / (sim.flightTime / 3600) : 0,
            clock: fmtClock(sim.clock), accel: inp.accel, cloudbase: cloudbaseAt(terrain, sim.x, sim.y),
            sunEl: sp.el, sunAz: sp.az, slopeIrr: slopeTrigger(normalAt(terrain, sim.x, sim.y), sv),
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
      {phase === "loading" && (
        <div className="absolute inset-0 grid place-items-center bg-background">
          <p className="animate-pulse font-mono text-sm text-muted-foreground">Generiere Gelände & Thermik…</p>
        </div>
      )}
      {hud && <FlightHUD d={hud} />}
      <button onClick={() => setMuted((m) => !m)} className="ctrl-btn absolute bottom-24 left-3 h-10 w-10 text-sm sm:bottom-4">
        {muted ? "🔇" : "🔊"}
      </button>
      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-3 sm:hidden">
        <button className="ctrl-btn h-16 w-20 text-2xl" {...hold("left")}>←</button>
        <button className="ctrl-btn h-16 w-24 text-sm font-bold" {...hold("accel")}>SPEED</button>
        <button className="ctrl-btn h-16 w-20 text-2xl" {...hold("right")}>→</button>
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
    </div>
  );
}
