import { loadAirspace } from "@/game/loadAirspace";
import type { Airspace } from "@/game/airspace";
import { bestTriangle, closingGap, faiRange, type XcTriangle } from "@/game/xcTriangle";
import { useEffect, useRef, useState } from "react";
import { MapCanvas, drawScene } from "./MapCanvas";
import { FlightHUD, type HudData } from "./FlightHUD";
import { StartScreen, type FlightConfig } from "./StartScreen";
import { generateTerrain, heightAt, gradientAt, cloudbaseAt, type Terrain } from "@/game/terrain";
import { airLift, type ThermalField } from "@/game/thermals";
import { loadThermalRaster, type ThermalMap } from "@/game/loadThermalRaster";
import { stepPhysics, steer, timeScale, holdBoost, type Sim, type Input, type HoldStarts } from "@/game/physicsEngine";
import { sunPosition, sunVector, fmtClock } from "@/game/sun";
import { SEASONS } from "@/game/sites";
import { loadRealTerrain } from "@/game/realTerrain";
import { AudioVario } from "@/game/audioVario";
import { useCanvasZoom } from "@/hooks/useCanvasZoom";
import { ZoomControls } from "./ZoomControls";
import { FlightSettings } from "./FlightSettings";
import { SideProfile, drawSideProfile } from "./SideProfile";
import { Button } from "./ui/button";
import { needsFlightCoverage, flightCoverageReady, nextCoverageCenter } from "@/game/flightCoverage";

type Phase = "config" | "loading" | "flying" | "done" | "error";

const STEER_DEADZONE_PX = 10;
const STEER_RANGE_PX = 70;

export function FlightGame() {
  const [phase, setPhase] = useState<Phase>("config");
  const [config, setConfig] = useState<FlightConfig | null>(null);
  const [hud, setHud] = useState<HudData | null>(null);
  const [result, setResult] = useState<{ goal: boolean; xc: number; time: number; reason: string; maxAlt: number; climb: number; thermals: number; circles: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [coverageStatus, setCoverageStatus] = useState<"ready" | "loading" | "error">("ready");
  const coverageRetry = useRef(false);
  const [runId, setRunId] = useState(0);
  const mapZoom = useCanvasZoom(0.01, 8, phase !== "config");
  const profileZoom = useCanvasZoom(0.5, 6, phase !== "config" && hud !== null);
  const { canvasRef } = mapZoom;
  const input = useRef<Input>({ left: false, right: false, accel: false, steer: 0 });
  const holdStart = useRef<HoldStarts>({ left: null, right: null });
  const speedHold = useRef<{ id: number | null; startX: number }>({ id: null, startX: 0 });
  const [thermalOpacity, setThermalOpacity] = useState(0.3);
  const thermalOpacityRef = useRef(0.3);
  thermalOpacityRef.current = thermalOpacity;
  const [showProfile, setShowProfile] = useState(false);
  const showProfileRef = useRef(false);
  showProfileRef.current = showProfile;
  const [showAirspaces, setShowAirspaces] = useState(false);
  const showAirspacesRef = useRef(false);
  showAirspacesRef.current = showAirspaces;
  const [showAirspaceLabels, setShowAirspaceLabels] = useState(true);
  const showAirspaceLabelsRef = useRef(true);
  showAirspaceLabelsRef.current = showAirspaceLabels;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const vario = useRef<AudioVario | null>(null);

  const start = (c: FlightConfig) => {
    if (!vario.current) vario.current = new AudioVario();
    vario.current.start();
    setConfig(c);
    setHud(null);
    setLoadError(null);
    setCoverageStatus("ready");
    mapZoom.reset(); profileZoom.reset();
    setResult(null);
    setPhase("loading");
    setRunId((r) => r + 1);
  };

  useEffect(() => {
    if (runId === 0 || !config) return;
    let raf = 0, cancelled = false;
    const timer = setTimeout(async () => {
      let terrain: Terrain, thermalMap: ThermalMap;
      try {
        [terrain, thermalMap] = await Promise.all([
          loadRealTerrain(config.site).catch((error: unknown) => {
            if (config.site.id.startsWith("map-")) throw error;
            return generateTerrain(config.site);
          }),
          loadThermalRaster(config.site),
        ]);
      } catch {
        if (cancelled) return;
        vario.current?.update(0);
        setLoadError("Geländehöhen oder die KK7-Thermikkarte für Juli / All day konnten nicht geladen werden.");
        setPhase("error");
        return;
      }
      if (cancelled) return;
      let airspaces: Airspace[] | null = null;
      loadAirspace(config.site).then((a) => { airspaces = a; }).catch(() => {});
      const thermals: ThermalField = { grid: new Map(), count: 0, raster: thermalMap.raster };
      let coveragePending = false, retryAfter = 0;
      const updateCoverage = (x: number, y: number, now: number) => {
        if (coveragePending || !needsFlightCoverage(terrain, x, y)) return;
        if (!coverageRetry.current && now < retryAfter) return;
        coverageRetry.current = false;
        coveragePending = true;
        setCoverageStatus("loading");
        const center = nextCoverageCenter(x, y);
        Promise.all([loadRealTerrain(config.site, center.x, center.y), loadThermalRaster(config.site, center.x, center.y)])
          .then(([nextTerrain, nextThermalMap]) => {
            if (cancelled) return;
            // Keep every position relative to the original launch; swap coverage atomically.
            terrain = nextTerrain;
            thermalMap = nextThermalMap;
            thermals.raster = nextThermalMap.raster;
            retryAfter = 0;
            setCoverageStatus("ready");
          })
          .catch(() => {
            if (cancelled) return;
            retryAfter = performance.now() + 10000;
            setCoverageStatus("error");
          })
          .finally(() => { coveragePending = false; });
      };
      const season = SEASONS[config.season];
      const g = gradientAt(terrain, 0, 0);
      const sim: Sim = {
        x: 0, y: 0, alt: heightAt(terrain, 0, 0) + 40, heading: Math.atan2(-g.gx, -g.gy),
        vz: 0, airLift: 0, speed: 10, distance: 0, flightTime: 0, clock: config.startHour,
        trackX: [], trackY: [], xcDist: 0, landed: false,
        maxAlt: 0, climbTotal: 0, thermals: 0, circles: 0, turnAcc: 0, inLift: false,
      };
      const trail: { x: number; y: number; vz: number }[] = [];
      let triangle: XcTriangle | null = null, lastTri = 0;
      let last = performance.now(), lastHud = 0, smoothVz = 0, trailT = 0;
      if (cancelled) return;
      setPhase("flying");

      const loop = (now: number) => {
        const dtReal = Math.min(0.05, (now - last) / 1000);
        last = now;
        updateCoverage(sim.x, sim.y, now);
        if (!flightCoverageReady(terrain, sim.x, sim.y)) {
          vario.current?.update(0);
          raf = requestAnimationFrame(loop);
          return;
        }
        const inp = input.current;
        const boost = holdBoost(inp, holdStart.current, now);
        const effSimSpeed = boost;
        steer(sim, inp, dtReal, effSimSpeed);
        const simDt = dtReal * timeScale(inp.accel, effSimSpeed);
        const sp = sunPosition(config.site.lat, season.doy, sim.clock, season.dst);
        const sv = sunVector(sp);
        const steps = Math.ceil(simDt / 0.05);
        for (let i = 0; i < steps && !sim.landed; i++) {
          const lift = airLift(thermals, terrain, sim.x, sim.y, sim.alt, sim.flightTime + config.startHour * 3600, sv, season.maxLift);
          stepPhysics(sim, inp, simDt / steps, terrain, lift);
        }
        smoothVz += (sim.vz - smoothVz) * Math.min(1, dtReal * 4);
        vario.current?.update(smoothVz);
        trailT += simDt;
        if (trailT > 2) {
          trailT = 0;
          trail.push({ x: sim.x, y: sim.y, vz: smoothVz });
          if (trail.length > 6000) {
            let write = 0;
            for (let read = 0; read < trail.length; read += 2) trail[write++] = trail[read];
            trail.length = write;
          }
        }

        if (now - lastTri > 1000) { lastTri = now; triangle = bestTriangle(sim.trackX, sim.trackY, { x: sim.x, y: sim.y }); }
        const dusk = Math.max(0, Math.min(1, (0.12 - sp.el) / 0.2));
        if (canvasRef.current) drawScene(canvasRef.current, { site: config.site, terrain, sim, trail, dusk, thermalMap: thermalOpacityRef.current > 0 ? thermalMap : null, thermalAlpha: thermalOpacityRef.current, triangle, showProfile: showProfileRef.current, airspaces: showAirspacesRef.current ? airspaces : null, airspaceLabels: showAirspaceLabelsRef.current }, mapZoom.transform.current);
        if (profileZoom.canvasRef.current) drawSideProfile(profileZoom.canvasRef.current, terrain, sim, profileZoom.transform.current);

        const xc = sim.xcDist;
        if (now - lastHud > 100) {
          lastHud = now;
          setHud({
            alt: sim.alt, agl: sim.alt - heightAt(terrain, sim.x, sim.y), vz: smoothVz, speed: sim.speed,
            time: sim.flightTime,
            xc, xcSpeed: sim.flightTime > 0 ? (xc / 1000) / (sim.flightTime / 3600) : 0,
            tri: triangle ? triangle.perimeter : 0, triFai: triangle?.fai ?? false,
            triMin: triangle ? faiRange(triangle).min : 0, triMax: triangle ? faiRange(triangle).max : 0,
            close: triangle ? closingGap(triangle) : 0,
            clock: fmtClock(sim.clock), accel: inp.accel, cloudbase: cloudbaseAt(terrain, sim.x, sim.y),
          });
        }
        if (sim.landed) {
          vario.current?.update(0);
          setResult({ goal: false, xc, time: sim.flightTime, reason: "Gelandet", maxAlt: sim.maxAlt, climb: sim.climbTotal, thermals: sim.thermals, circles: sim.circles });
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
      if (e.code === "ArrowLeft") {
        input.current.left = v;
        holdStart.current.left = v ? performance.now() : null;
      } else if (e.code === "ArrowRight") {
        input.current.right = v;
        holdStart.current.right = v ? performance.now() : null;
      } else if (e.code === "Space" || e.code === "ArrowUp") input.current.accel = v;
      else return;
      e.preventDefault();
    };
    const down = (e: KeyboardEvent) => set(e, true), up = (e: KeyboardEvent) => set(e, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  if (phase === "config") return <StartScreen onStart={start} />;

  const stopHold = (k: "left" | "right" | "accel") => {
    if (k === "left" || k === "right") holdStart.current[k] = null;
    input.current[k] = false;
  };

  const hold = (k: "left" | "right" | "accel") => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      input.current[k] = true;
      if (k === "left" || k === "right") holdStart.current[k] = performance.now();
    },
    onPointerUp: () => stopHold(k),
    onPointerLeave: () => stopHold(k),
    onPointerCancel: () => stopHold(k),
  });

  // Holding SPEED and sliding left/right slowly steers the glider.
  const releaseSpeed = () => {
    speedHold.current.id = null;
    input.current.steer = 0;
    input.current.accel = false;
  };
  const speedHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      speedHold.current = { id: e.pointerId, startX: e.clientX };
      input.current.accel = true;
      input.current.steer = 0;
    },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (speedHold.current.id === null || speedHold.current.id !== e.pointerId) return;
      const dx = e.clientX - speedHold.current.startX;
      const dead = STEER_DEADZONE_PX;
      const v = Math.abs(dx) <= dead ? 0 : Math.max(-1, Math.min(1, (dx - Math.sign(dx) * dead) / STEER_RANGE_PX));
      input.current.steer = v;
    },
    onPointerUp: releaseSpeed,
    onPointerCancel: releaseSpeed,
  };

  return (
    <div className="fixed inset-0 touch-none select-none overflow-hidden bg-background">
      <MapCanvas ref={canvasRef} />
      <FlightSettings thermalOpacity={thermalOpacity} onThermalOpacity={setThermalOpacity} showProfile={showProfile} onShowProfile={setShowProfile} showAirspaces={showAirspaces} onShowAirspaces={setShowAirspaces} showAirspaceLabels={showAirspaceLabels} onShowAirspaceLabels={setShowAirspaceLabels} open={settingsOpen} onOpenChange={setSettingsOpen} />
      {phase === "loading" && (
        <div className="absolute inset-0 grid place-items-center bg-background">
          <p className="animate-pulse font-mono text-sm text-muted-foreground">Lade Geländehöhen & KK7-Thermikkarte…</p>
        </div>
      )}
      {phase === "flying" && coverageStatus !== "ready" && <div role="status" className="absolute left-3 top-16 max-w-[calc(100%-24px)] rounded-md border border-border bg-card/95 p-2 text-xs text-foreground">
        {coverageStatus === "loading" ? "Lade Gelände & Thermik entlang der Flugstrecke…" : <div className="flex flex-wrap items-center gap-2"><span>Gelände oder KK7-Thermik nicht erreichbar.</span><Button size="sm" variant="outline" onClick={() => { coverageRetry.current = true; }}>Erneut versuchen</Button></div>}
      </div>}
      <div className="absolute left-3 top-3 rounded-md border border-border bg-card/95 p-1.5 font-mono text-[10px] text-foreground backdrop-blur-md">
        <ZoomControls label="Karte" scale={mapZoom.scale} change={mapZoom.change} reset={mapZoom.reset} />
      </div>
      {hud && <div className="absolute bottom-[94px] right-2 left-2 flex items-stretch justify-end gap-2 sm:bottom-8 sm:left-auto sm:right-3">
        {showProfile && <section aria-label="Seitenansicht" className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-card/95 backdrop-blur-md">
          <header className="flex flex-wrap items-center justify-between gap-x-1 border-b border-border px-1.5 py-0.5">
            <span className="font-mono text-[9px] text-muted-foreground sm:text-[10px]">BERGPROFIL</span>
            <ZoomControls label="Seitenansicht" scale={profileZoom.scale} change={profileZoom.change} reset={profileZoom.reset} />
          </header>
          <div className="relative min-h-0 flex-1"><div className="absolute inset-0"><SideProfile ref={profileZoom.canvasRef} /></div></div>
        </section>}
        <FlightHUD d={hud} />
      </div>}
      <div className="absolute inset-x-2 bottom-3 flex gap-2 sm:hidden">
        <button className="ctrl-btn h-16 flex-1 text-2xl" {...hold("left")}>←</button>
        <button className="ctrl-btn h-16 flex-1 text-sm font-bold" {...speedHandlers}>SPEED</button>
        <button className="ctrl-btn h-16 flex-1 text-2xl" {...hold("right")}>→</button>
      </div>
      {phase === "done" && result && (
        <div className="absolute inset-0 grid place-items-center bg-background/70 p-6 backdrop-blur-sm">
          <div className="hud-panel w-full max-w-sm p-6 text-center">
            <p className="hud-label">{config?.site.name}</p>
            <h2 className={`mt-1 font-display text-4xl font-bold ${result.goal ? "text-climb" : "text-foreground"}`}>{result.reason}</h2>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="hud-cell"><div className="hud-label">XC Strecke</div><div className="hud-value text-2xl">{(result.xc / 1000).toFixed(1)} km</div></div>
              <div className="hud-cell"><div className="hud-label">XC Punkte</div><div className="hud-value text-2xl">{(result.xc / 1000).toFixed(1)}</div></div>
              <div className="hud-cell"><div className="hud-label">Flugdauer</div><div className="hud-value text-2xl">{Math.floor(result.time / 60)}:{String(Math.floor(result.time % 60)).padStart(2, "0")}</div></div>
              <div className="hud-cell"><div className="hud-label">XC Geschw.</div><div className="hud-value text-2xl">{result.time > 0 ? (((result.xc / 1000) / (result.time / 3600))).toFixed(1) : "0.0"} km/h</div></div>
              <div className="hud-cell"><div className="hud-label">Max Höhe</div><div className="hud-value text-2xl">{Math.round(result.maxAlt)} m</div></div>
              <div className="hud-cell"><div className="hud-label">Höhengewinn</div><div className="hud-value text-2xl">{Math.round(result.climb)} m</div></div>
              <div className="hud-cell"><div className="hud-label">Thermiken</div><div className="hud-value text-2xl">{result.thermals}</div></div>
              <div className="hud-cell"><div className="hud-label">Thermikkreise</div><div className="hud-value text-2xl">{result.circles}</div></div>
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
