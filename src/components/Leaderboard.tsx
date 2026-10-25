import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MODES, modeLabel, type FlightMode } from "@/game/modes";
import { X } from "lucide-react";

interface Entry {
  id: string;
  pilot_name: string;
  site_name: string;
  mode: string;
  distance_km: number;
  duration_s: number;
  created_at: string;
}

const fmtDur = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} h`;

export async function submitFlight(pilot: string, site: string, mode: FlightMode, distanceKm: number, durationS: number): Promise<string | null> {
  const { error } = await supabase.from("leaderboard_entries").insert({
    pilot_name: pilot.trim().slice(0, 40),
    site_name: site.slice(0, 80),
    mode,
    distance_km: Math.round(distanceKm * 10) / 10,
    duration_s: Math.round(durationS),
  });
  return error ? error.message : null;
}

export function Leaderboard({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<FlightMode>("out_return");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setError(null);
    supabase.from("leaderboard_entries").select("*").eq("mode", mode).order("distance_km", { ascending: false }).limit(50)
      .then(({ data, error: e }) => {
        if (cancelled) return;
        if (e) setError("Rangliste konnte nicht geladen werden.");
        else setEntries(data as Entry[]);
      });
    return () => { cancelled = true; };
  }, [mode]);

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-label="Rangliste">
      <div className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-foreground">Rangliste</h2>
          <button aria-label="Schliessen" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {MODES.map((m) => (
            <button key={m.v} onClick={() => setMode(m.v)} data-active={m.v === mode} className="choice rounded-md border border-border px-2 py-1.5 text-xs font-semibold text-foreground">{m.label}</button>
          ))}
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {error && <p className="py-6 text-center text-sm text-sink">{error}</p>}
          {!error && entries === null && <p className="py-6 text-center font-mono text-sm text-muted-foreground">Lade…</p>}
          {!error && entries !== null && entries.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Noch keine Einträge für {modeLabel(mode)}.</p>}
          {!error && entries && entries.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="hud-label text-left">
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">Pilot</th>
                  <th className="py-1 pr-2">Startplatz</th>
                  <th className="py-1 pr-2 text-right">Km</th>
                  <th className="py-1 text-right">Zeit</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.id} className="border-t border-border/50 text-foreground">
                    <td className="py-1 pr-2 font-mono text-muted-foreground">{i + 1}</td>
                    <td className="max-w-0 truncate py-1 pr-2 font-semibold">{e.pilot_name}</td>
                    <td className="max-w-0 truncate py-1 pr-2 text-muted-foreground">{e.site_name}</td>
                    <td className="py-1 pr-2 text-right font-mono font-bold">{e.distance_km.toFixed(1)}</td>
                    <td className="py-1 text-right font-mono text-muted-foreground">{fmtDur(e.duration_s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
