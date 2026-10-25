import { useEffect, useState } from "react";
import { SITES, SEASONS, type Season, type Site } from "@/game/sites";
import { sunTimes } from "@/game/sun";
import { MODES, type FlightMode } from "@/game/modes";
import heroImg from "@/assets/hero-alps.jpg";
import logoImg from "@/assets/xcfly-logo.png";
import { MapPin, Trophy } from "lucide-react";
import { Button } from "./ui/button";
import { LaunchMapPicker } from "./LaunchMapPicker";
import { Leaderboard } from "./Leaderboard";

export interface FlightConfig { site: Site; season: Season; startHour: number; mode: FlightMode }

const FIXED_SEASON: Season = "summer";

export function StartScreen({ onStart }: { onStart: (c: FlightConfig) => void }) {
  const [site, setSite] = useState<Site>(SITES[0]);
  const [mode, setMode] = useState<FlightMode>("free");
  const [startHour, setStartHour] = useState(11);
  const [choosing, setChoosing] = useState(false);
  const [ranking, setRanking] = useState(false);
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
            <h2 className="hud-label mb-1.5">Modus</h2>
            <div className="grid grid-cols-3 gap-1.5">
              {MODES.map((m) => (
                <Button variant="outline" key={m.v} onClick={() => setMode(m.v)} data-active={m.v === mode} className="choice h-auto flex-col items-start gap-0 whitespace-normal px-2 py-1.5">
                  <span className="block text-sm font-semibold leading-tight">{m.label}</span>
                  <span className="block text-[10px] leading-tight text-muted-foreground">{m.desc}</span>
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
            <div className="mb-1.5 flex items-center justify-between">
              <h2 className="hud-label">Startplatz</h2>
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setRanking(true)}><Trophy className="h-3.5 w-3.5" />Rangliste</Button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {sortedSites.map((s) => (
                <Button variant="outline" key={s.id} onClick={() => setSite(s)} data-active={s.id === site.id} className="choice h-auto flex-col items-start gap-0 whitespace-normal px-2 py-1.5">
                  <span className="block text-sm font-semibold leading-tight">{s.name}</span>
                  <span className="block text-[10px] text-muted-foreground">{s.region} · {s.launchAlt} m</span>
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
      {ranking && <Leaderboard initialSite={site.name} onClose={() => setRanking(false)} />}
    </div>
  );
}
