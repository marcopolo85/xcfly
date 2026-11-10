import { inThermalRegion } from "@/game/thermalRegion";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SITES, SEASONS, type Season, type Site } from "@/game/sites";
import { sunTimes } from "@/game/sun";
import { MODES, type FlightMode } from "@/game/modes";
import heroImg from "@/assets/hero-alps.jpg";
import logoImg from "@/assets/xcfly-logo.png";
import { Info, MapPin, Route, Medal, ScrollText, Trophy } from "lucide-react";
import { ChangelogDialog } from "./ChangelogDialog";
import { CHANGELOG, CHANGELOG_SEEN_KEY, hasUnseenChangelog } from "@/game/changelog";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { RouteIcon } from "./RouteIcon";
import { LaunchMapPicker } from "./LaunchMapPicker";
import { Leaderboard } from "./Leaderboard";
import { InfoDialog } from "./InfoDialog";
import { parseFlyxcLink, taskDistanceKm, type FlightTask } from "@/game/flyxcTask";
import { loadLaunchAltitude } from "@/game/realTerrain";
import { selectedLaunch } from "@/game/launchSelection";

export interface FlightConfig { site: Site; season: Season; startHour: number; mode: FlightMode; pilotName?: string | undefined; task?: FlightTask | undefined }

function FlightStats() {
  const [stats, setStats] = useState<{ total: number; unranked: number; pilots: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.rpc("flight_summary").then(({ data, error }) => {
      if (cancelled || error || !data) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (row) setStats({ total: Number(row.flights_total), unranked: Number(row.flights_unranked), pilots: Number(row.pilots) });
    });
    return () => { cancelled = true; };
  }, []);
  if (!stats) return null;
  return (
    <p className="text-center text-[10px] text-muted-foreground">
      {stats.total} {stats.total === 1 ? "Flug" : "Flüge"} · {stats.total - stats.unranked} in der Rangliste · {stats.total - stats.unranked === stats.total ? "keine" : stats.unranked} ohne Rangliste · {stats.pilots} {stats.pilots === 1 ? "Pilot" : "Piloten"}
    </p>
  );
}

const FIXED_SEASON: Season = "summer";

export function StartScreen({ onStart }: { onStart: (c: FlightConfig) => void }) {
  const [site, setSite] = useState<Site | null>(null);
  const [mode, setMode] = useState<FlightMode>("xc");
  const [startHour, setStartHour] = useState(11);
  const [choosing, setChoosing] = useState(false);
  const [rankingSite, setRankingSite] = useState<string | null>(null);
  const [overallRanking, setOverallRanking] = useState(false);
  const [weeklyRanking, setWeeklyRanking] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [modeInfo, setModeInfo] = useState<FlightMode | null>(null);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [pilotName, setPilotName] = useState("");
  const [task, setTask] = useState<FlightTask | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importLink, setImportLink] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const importTask = async () => {
    const t = parseFlyxcLink(importLink);
    if (!t) { setImportError("Kein gültiger FlyXC-Link (flyxc.app/?p=…)."); return; }
    const p0 = t.points[0]!;
    if (!inThermalRegion(p0.lat, p0.lon)) { setImportError("Der Startpunkt liegt ausserhalb des Fluggebiets."); return; }
    setImporting(true); setImportError(null);
    try {
      const alt = await loadLaunchAltitude(p0);
      setSite({ ...selectedLaunch(SITES[0]!, p0.lat, p0.lon, alt), name: "FlyXC-Aufgabe" });
      setTask(t); setImportOpen(false);
    } catch { setImportError("Geländehöhe nicht erreichbar. Bitte erneut versuchen."); }
    finally { setImporting(false); }
  };
  useEffect(() => { setPilotName(localStorage.getItem("xcfly-pilot-name") ?? ""); }, []);
  const updatePilotName = (v: string) => { setPilotName(v); localStorage.setItem("xcfly-pilot-name", v); };
  const [unseenChanges, setUnseenChanges] = useState(false);
  useEffect(() => { setUnseenChanges(hasUnseenChangelog(localStorage.getItem(CHANGELOG_SEEN_KEY))); }, []);
  const openChangelog = () => {
    setChangelogOpen(true);
    setUnseenChanges(false);
    if (CHANGELOG[0]) localStorage.setItem(CHANGELOG_SEEN_KEY, CHANGELOG[0].id);
  };
  useEffect(() => {
    if (navigator.onLine) return;
    try {
      const saved = JSON.parse(localStorage.getItem("xcfly-offline-area") ?? "null");
      if (saved && typeof saved.id === "string" && typeof saved.lat === "number" && typeof saved.lon === "number") setSite(saved);
    } catch { /* Keep the default launch if device metadata is missing. */ }
  }, []);
  const st = site ? sunTimes(site.lat, SEASONS[FIXED_SEASON].doy, SEASONS[FIXED_SEASON].dst) : null;
  const earliest = st ? Math.ceil(st.sunrise) : 5, latest = st ? Math.floor(st.sunset - 1) : 21;
  const effectiveHour = mode === "free" ? Math.min(Math.max(startHour, earliest), latest) : Math.min(Math.max(11, earliest), latest);
  const sortedSites = [...SITES].sort((a, b) => a.name.localeCompare(b.name, "de"));

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-background">
      <img src={heroImg} alt="Gleitschirm über Schweizer Alpen" className="absolute inset-0 h-full w-full object-cover opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background" />
      <img src={logoImg} alt="XCFly Logo" className="absolute right-4 top-4 h-56 w-auto sm:h-80" />
      <div className="relative mx-auto flex h-[100dvh] max-w-3xl flex-col justify-end px-5 pb-6 pt-64">
        <h1 className="mt-1 font-display text-6xl font-bold leading-none text-foreground sm:text-8xl">XCFly</h1>

        <div className="mt-4 space-y-2.5 rounded-xl border border-border bg-card/85 p-4 backdrop-blur">
          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="hud-label">Modus</h2>
                <Button type="button" variant="outline" size="icon" title="Wöchentliche Gesamtrangliste" aria-label="Wöchentliche Gesamtrangliste" onClick={() => { setWeeklyRanking(true); setOverallRanking(true); }} className="h-6 w-6 text-muted-foreground [&_svg]:size-3.5">
                  <Medal />
                </Button>
                <Button type="button" variant="outline" size="icon" title="Gesamtrangliste" aria-label="Gesamtrangliste" onClick={() => { setWeeklyRanking(false); setOverallRanking(true); }} className="h-6 w-6 text-muted-foreground [&_svg]:size-3.5">
                  <Trophy />
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" title="Changelog" aria-label={unseenChanges ? "Changelog – neue Updates" : "Changelog"} onClick={openChangelog}
                  className={`grid h-6 w-6 place-items-center rounded-md border bg-card/95 active:bg-accent ${unseenChanges ? "border-climb text-climb" : "border-border text-muted-foreground"}`}>
                  <ScrollText className="h-3.5 w-3.5" />
                </button>
                <button type="button" title="Info" aria-label="Info" onClick={() => setInfoOpen(true)} className="grid h-6 w-6 place-items-center rounded-md border border-border bg-card/95 text-muted-foreground active:bg-accent">
                  <Info className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {MODES.map((m) => (
                <Button variant="outline" key={m.v} onClick={() => setMode(m.v)} data-active={m.v === mode} className="choice h-auto flex-col items-start gap-0 whitespace-normal px-2 py-1.5">
                  <span className="flex w-full items-center justify-between gap-1">
                    <span className="flex items-center gap-1 text-sm font-semibold leading-tight"><span className="whitespace-nowrap">{m.label}</span>{m.v === "xc" && <span className="inline-flex shrink-0 items-center gap-0.5"><RouteIcon type="free" className="h-3.5 w-3.5" /><RouteIcon type="tri" className="h-3.5 w-3.5" /><RouteIcon type="fai" className="h-3.5 w-3.5" /></span>}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Info ${m.label}`}
                      title={`Info ${m.label}`}
                      onClick={(e) => { e.stopPropagation(); setModeInfo(m.v); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setModeInfo(m.v); } }}
                      className="grid shrink-0 place-items-center rounded-md p-0.5 text-muted-foreground active:bg-accent"
                    >
                      <Info className="h-3 w-3" />
                    </span>
                  </span>
                </Button>
              ))}
            </div>
            {mode === "free" && (
              <label className="mt-2 flex items-center gap-2 text-xs text-foreground">
                <span className="hud-label shrink-0">Startzeit</span>
                <input type="range" min={earliest} max={latest} step={1} value={effectiveHour} onChange={(e) => setStartHour(Number(e.target.value))} className="min-w-0 flex-1" />
                <span className="w-10 text-right font-mono font-bold">{effectiveHour}:00</span>
              </label>
            )}
          </section>
          <section>
            <h2 className="hud-label mb-1.5">Startplatz</h2>
            <div className="grid grid-cols-2 gap-1.5">
              {sortedSites.map((s) => (
                <Button key={s.id} variant="outline" onClick={() => { setSite(s); setTask(null); }} data-active={site !== null && s.id === site.id} className="choice h-auto min-w-0 flex-1 flex-col items-start gap-0 whitespace-normal px-2 py-1.5">
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="block text-sm font-semibold leading-tight">{s.name.replace(/\s*\(.*?\)\s*/g, " ").trim()}</span>
                    <span className="flex shrink-0 items-center">
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Wöchentliche Rangliste ${s.name}`}
                      title={`Wöchentliche Rangliste ${s.name}`}
                      onClick={(e) => { e.stopPropagation(); setWeeklyRanking(true); setRankingSite(s.name); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setWeeklyRanking(true); setRankingSite(s.name); } }}
                      className="grid shrink-0 place-items-center rounded-md p-1 text-muted-foreground active:bg-accent"
                    >
                      <Medal className="h-3.5 w-3.5" />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Rangliste ${s.name}`}
                      title={`Rangliste ${s.name}`}
                      onClick={(e) => { e.stopPropagation(); setWeeklyRanking(false); setRankingSite(s.name); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setWeeklyRanking(false); setRankingSite(s.name); } }}
                      className="grid shrink-0 place-items-center rounded-md p-1 text-muted-foreground active:bg-accent"
                    >
                      <Trophy className="h-3.5 w-3.5" />
                    </span>
                    </span>
                  </span>
                  <span className="block text-[10px] text-muted-foreground">{s.launchAlt} m</span>
                </Button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <Button variant="outline" className="h-9 text-sm" onClick={() => setChoosing(true)}><MapPin />Auf Karte wählen</Button>
              <Button variant="outline" className="h-9 text-sm" onClick={() => { setImportError(null); setImportOpen(true); }}><Route />Aufgabe importieren</Button>
            </div>
            {task && <div className="mt-1 flex items-center justify-between font-mono text-xs text-foreground"><span>Aufgabe: {task.points.length - 1} Wegpunkte · {taskDistanceKm(task.points).toFixed(1)} km</span><button type="button" className="underline text-muted-foreground" onClick={() => setTask(null)}>entfernen</button></div>}
            {site?.id.startsWith("map-") && !task && <div className="mt-1 font-mono text-xs text-foreground">{site.region} · {site.launchAlt} m</div>}
          </section>
          <div className="flex gap-2">
          <button disabled={!site || !inThermalRegion(site.lat, site.lon)} onClick={() => { if (site && inThermalRegion(site.lat, site.lon)) onStart({ site, season: FIXED_SEASON, startHour: effectiveHour, mode, pilotName: pilotName.trim() || undefined, task: task ?? undefined }); }} className="w-2/5 shrink-0 rounded-lg bg-primary py-3 font-display text-base font-bold text-primary-foreground shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
            Starten
          </button>
          <input value={pilotName} maxLength={24} onChange={(e) => updatePilotName(e.target.value)} placeholder="Pilotname (Multiplayer)" aria-label="Pilotname für Multiplayer" title="Bleibt das Feld leer, fliegst du unsichtbar (kein Multiplayer)." className="min-w-0 flex-1 rounded-lg border border-border bg-background/80 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <p className="text-center text-[10px] text-muted-foreground">Leeres Namensfeld = unsichtbar für andere Piloten (kein Multiplayer).</p>
          {!site && <p className="text-center text-xs text-muted-foreground">Bitte einen Startplatz wählen</p>}
          <div className="grid grid-cols-3 gap-1.5">
            <div className="flex h-full flex-col justify-center rounded-md border border-border bg-card/60 p-2 text-[9px] leading-tight text-muted-foreground">
              <span className="hud-label mb-0.5">Quellen</span>
              <a href="https://www.swisstopo.admin.ch/de/nutzungsbedingungen" target="_blank" rel="noopener noreferrer" className="underline">© swisstopo</a>
              <a href="https://thermal.kk7.ch/" target="_blank" rel="noopener noreferrer" className="underline">Thermik: M. von Känel · KK7 (CC BY-NC-SA)</a>
              <a href="https://www.bazl.admin.ch/" target="_blank" rel="noopener noreferrer" className="underline">Lufträume: © BAZL</a>
              <span>Gelände: Terrarium DEM · © OSM</span>
            </div>
            <div className="flex h-full flex-col items-center justify-center gap-1 rounded-md border border-border bg-card/60 p-2 text-center">
              <p className="text-[10px] leading-tight text-muted-foreground">← → drehen · Leertaste / ↑ Beschleuniger · Ton an!</p>
              <FlightStats />
            </div>
            <div className="flex h-full flex-col items-center justify-center gap-1 rounded-md border border-border bg-card/60 p-2 text-center">
              <Button asChild variant="outline" size="sm" className="h-7 w-full text-xs"><a href="https://buymeacoffee.com/marcopolo85" target="_blank" rel="noopener noreferrer">🍺 Buy me a beer</a></Button>
              <span className="text-[9px] leading-tight text-muted-foreground">Damit werden die AI-Credits und der Alkoholpegel des Entwicklers finanziert.</span>
            </div>
          </div>
        </div>
      </div>
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aufgabe importieren</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Link aus flyxc.app einfügen (Teilen → Link). Der erste Punkt wird Startplatz, Zylinder 400 m.</p>
          <input autoFocus value={importLink} onChange={(e) => setImportLink(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void importTask(); }} placeholder="https://flyxc.app/?p=…" aria-label="FlyXC-Link" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          {importError && <p role="alert" className="text-xs text-destructive">{importError}</p>}
          <Button disabled={importing || !importLink.trim()} onClick={() => void importTask()}>{importing ? "Lade…" : "Übernehmen"}</Button>
        </DialogContent>
      </Dialog>
      {choosing && <LaunchMapPicker initial={site ?? undefined} onClose={() => setChoosing(false)} onSelect={(selected) => { setSite(selected); setTask(null); setChoosing(false); }} />}
      {rankingSite && <Leaderboard initialSite={rankingSite} weekly={weeklyRanking} onClose={() => setRankingSite(null)} />}
      {overallRanking && <Leaderboard overall weekly={weeklyRanking} onClose={() => setOverallRanking(false)} />}
      <InfoDialog open={infoOpen} onOpenChange={setInfoOpen} />
      <ChangelogDialog open={changelogOpen} onOpenChange={setChangelogOpen} />
      <Dialog open={modeInfo !== null} onOpenChange={(v) => !v && setModeInfo(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{MODES.find((m) => m.v === modeInfo)?.label}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{MODES.find((m) => m.v === modeInfo)?.desc}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
