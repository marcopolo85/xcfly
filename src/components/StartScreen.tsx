import { useState } from "react";
import { SITES, SEASONS, type Season, type Site } from "@/game/sites";
import { sunTimes } from "@/game/sun";
import heroImg from "@/assets/hero-alps.jpg";
import { MapPin } from "lucide-react";
import { Button } from "./ui/button";
import { LaunchMapPicker } from "./LaunchMapPicker";

export interface FlightConfig { site: Site; season: Season; startHour: number }

const FIXED_SEASON: Season = "summer";
const FIXED_START_HOUR = 11;

export function StartScreen({ onStart }: { onStart: (c: FlightConfig) => void }) {
  const [site, setSite] = useState<Site>(SITES[0]);
  const [choosing, setChoosing] = useState(false);
  const st = sunTimes(site.lat, SEASONS[FIXED_SEASON].doy, SEASONS[FIXED_SEASON].dst);


  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <img src={heroImg} alt="Gleitschirm über Schweizer Alpen" className="absolute inset-0 h-full w-full object-cover opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/70 to-background" />
      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col justify-end px-5 pb-10 pt-24">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">XC · Schweiz</p>
        <h1 className="mt-2 font-display text-5xl font-bold leading-none text-foreground sm:text-7xl">Thermik&shy;jagd</h1>
        <p className="mt-3 max-w-md text-sm text-muted-foreground">Finde unsichtbare Thermik nur mit dem Vario-Ton und fliege eine Strecke über drei Wegpunkte.</p>

        <div className="mt-8 space-y-6 rounded-xl border border-border bg-card/85 p-5 backdrop-blur">
          <section>
            <h2 className="hud-label mb-2">Startplatz</h2>
            <div className="grid grid-cols-2 gap-2">
              {SITES.map((s) => (
                <Button variant="outline" key={s.id} onClick={() => setSite(s)} data-active={s.id === site.id} className="choice h-auto flex-col items-start gap-0 whitespace-normal">
                  <span className="block font-semibold">{s.name}</span>
                  <span className="block text-[11px] text-muted-foreground">{s.region} · {s.launchAlt} m</span>
                </Button>
              ))}
            </div>
            <Button variant="outline" className="mt-3 h-11 w-full" onClick={() => setChoosing(true)}><MapPin />Auf Karte wählen</Button>
            {site.id.startsWith("map-") && <div className="mt-2 font-mono text-xs text-foreground">{site.region} · {site.launchAlt} m</div>}
          </section>
          <button onClick={() => onStart({ site, season: FIXED_SEASON, startHour: Math.min(Math.max(FIXED_START_HOUR, st.sunrise), st.sunset - 1) })} className="w-full rounded-lg bg-primary py-4 font-display text-lg font-bold text-primary-foreground shadow-glow transition hover:brightness-110">
            Starten
          </button>
          <p className="text-center text-[11px] text-muted-foreground">← → drehen · Leertaste / ↑ Beschleuniger (Zeit ×5) · Ton an!</p>
        </div>
      </div>
      {choosing && <LaunchMapPicker initial={site} onClose={() => setChoosing(false)} onSelect={(selected) => { setSite(selected); setChoosing(false); }} />}
    </div>
  );
}
