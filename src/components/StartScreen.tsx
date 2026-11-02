import { useEffect, useState } from "react";
import { SITES, SEASONS, type Season, type Site } from "@/game/sites";
import { sunTimes } from "@/game/sun";
import { MODES, type FlightMode } from "@/game/modes";
import heroImg from "@/assets/hero-alps.jpg";
import logoImg from "@/assets/xcfly-logo.png";
import { Info, MapPin, Trophy } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { RouteIcon } from "./RouteIcon";
import { LaunchMapPicker } from "./LaunchMapPicker";
import { Leaderboard } from "./Leaderboard";
import { InfoDialog } from "./InfoDialog";

export interface FlightConfig { site: Site; season: Season; startHour: number; mode: FlightMode }

const FIXED_SEASON: Season = "summer";

export function StartScreen({ onStart }: { onStart: (c: FlightConfig) => void }) {
  const [site, setSite] = useState<Site>(SITES[0]);
  const [mode, setMode] = useState<FlightMode>("free");
  const [startHour, setStartHour] = useState(11);
  const [choosing, setChoosing] = useState(false);
  const [rankingSite, setRankingSite] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [modeInfo, setModeInfo] = useState<FlightMode | null>(null);
  useEffect(() => {
    if (navigator.onLine) return;
    try {
      const saved = JSON.parse(localStorage.getItem("xcfly-offline-area") ?? "null");
      if (saved && typeof saved.id === "string" && typeof saved.lat === "number" && typeof saved.lon === "number") setSite(saved);
    } catch { /* Keep the default launch if device metadata is missing. */ }
  }, []);
  const st = sunTimes(site.lat, SEASONS[FIXED_SEASON].doy, SEASONS[FIXED_SEASON].dst);
  const earliest = Math.ceil(st.sunrise), latest = Math.floor(st.sunset - 1);
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
              <h2 className="hud-label">Modus</h2>
              <button type="button" title="Info" aria-label="Info" onClick={() => setInfoOpen(true)} className="grid h-6 w-6 place-items-center rounded-md border border-border bg-card/95 text-muted-foreground active:bg-accent">
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {MODES.map((m) => (
                <Button variant="outline" key={m.v} onClick={() => setMode(m.v)} data-active={m.v === mode} className="choice h-auto flex-col items-start gap-0 whitespace-normal px-2 py-1.5">
                  <span className="flex w-full items-center justify-between gap-1">
                    <span className="block text-sm font-semibold leading-tight">{m.label}{m.v === "xc" && <span className="ml-1.5 inline-flex gap-0.5 align-middle"><RouteIcon type="free" className="h-3.5 w-3.5" /><RouteIcon type="tri" className="h-3.5 w-3.5" /><RouteIcon type="fai" className="h-3.5 w-3.5" /></span>}</span>
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
                <Button key={s.id} variant="outline" onClick={() => setSite(s)} data-active={s.id === site.id} className="choice h-auto min-w-0 flex-1 flex-col items-start gap-0 whitespace-normal px-2 py-1.5">
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="block text-sm font-semibold leading-tight">{s.name.replace(/\s*\(.*?\)\s*/g, " ").trim()}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Rangliste ${s.name}`}
                      title={`Rangliste ${s.name}`}
                      onClick={(e) => { e.stopPropagation(); setRankingSite(s.name); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setRankingSite(s.name); } }}
                      className="grid shrink-0 place-items-center rounded-md p-1 text-muted-foreground active:bg-accent"
                    >
                      <Trophy className="h-3.5 w-3.5" />
                    </span>
                  </span>
                  <span className="block text-[10px] text-muted-foreground">{s.launchAlt} m</span>
                </Button>
              ))}
            </div>
            <Button variant="outline" className="mt-2 h-9 w-full text-sm" onClick={() => setChoosing(true)}><MapPin />Auf Karte wählen</Button>
            {site.id.startsWith("map-") && <div className="mt-1 font-mono text-xs text-foreground">{site.region} · {site.launchAlt} m</div>}
          </section>
          <button onClick={() => onStart({ site, season: FIXED_SEASON, startHour: effectiveHour, mode })} className="w-full rounded-lg bg-primary py-3 font-display text-base font-bold text-primary-foreground shadow-glow transition hover:brightness-110">
            Starten
          </button>
          <p className="text-center text-[10px] text-muted-foreground">← → drehen · Leertaste / ↑ Beschleuniger · Ton an!</p>
        </div>
      </div>
      {choosing && <LaunchMapPicker initial={site} onClose={() => setChoosing(false)} onSelect={(selected) => { setSite(selected); setChoosing(false); }} />}
      {rankingSite && <Leaderboard initialSite={rankingSite} onClose={() => setRankingSite(null)} />}
      <InfoDialog open={infoOpen} onOpenChange={setInfoOpen} />
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
