import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SITES } from "@/game/sites";
import { modeLabel, type FlightMode } from "@/game/modes";

interface Entry {
  id: string;
  pilot_name: string;
  site_name: string;
  mode: string;
  distance_km: number;
  duration_s: number;
  created_at: string;
}

const RANKED_MODES = ["out_return", "one_way"] as const;

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

import { modeLabel, type FlightMode } from "@/game/modes";

export function Leaderboard({ initialSite, onClose }: { initialSite?: string; onClose: () => void }) {
  const site = initialSite ?? SITES[0]?.name ?? "";
  const [entries, setEntries] = useState<Record<string, Entry[]> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setError(null);
    // One fetch per ranked mode; the per-site split happens locally so every
    // launch site (including free map picks) gets its own ranking.
    Promise.all(
      RANKED_MODES.map((mode) =>
        supabase.from("leaderboard_entries").select("*").eq("mode", mode).order("distance_km", { ascending: false }).limit(500)
          .then(({ data, error: e }) => (e ? null : (data as Entry[])))
      )
    ).then(([outReturn, oneWay]) => {
      if (cancelled) return;
      if (outReturn === null || oneWay === null) setError("Rangliste konnte nicht geladen werden.");
      else setEntries({ out_return: outReturn, one_way: oneWay });
    });
    return () => { cancelled = true; };
  }, []);

  const shown = (mode: string) => (entries?.[mode] ?? []).filter((e) => e.site_name === site).slice(0, 50);

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-label="Rangliste">
      <div className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-foreground">Rangliste · {site}</h2>
          <button aria-label="Schliessen" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-3 grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto">
          {error && <p className="col-span-2 py-6 text-center text-sm text-sink">{error}</p>}
          {!error && entries === null && <p className="col-span-2 py-6 text-center font-mono text-sm text-muted-foreground">Lade…</p>}
          {!error && entries !== null && RANKED_MODES.map((mode) => {
            const list = shown(mode);
            return (
              <div key={mode} className="flex min-h-0 flex-col">
                <h3 className="mb-1 text-xs font-semibold text-foreground">{modeLabel(mode)}</h3>
                {list.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">Noch keine Einträge.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="hud-label text-left">
                        <th className="py-1 pr-1">#</th>
                        <th className="py-1 pr-1">Pilot</th>
                        <th className="py-1 pr-1 text-right">Km</th>
                        <th className="py-1 text-right">Zeit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((e, i) => (
                        <tr key={e.id} className="border-t border-border/50 text-foreground">
                          <td className="py-1 pr-1 font-mono text-muted-foreground">{i + 1}</td>
                          <td className="max-w-0 truncate py-1 pr-1 font-semibold">{e.pilot_name}</td>
                          <td className="py-1 pr-1 text-right font-mono font-bold">{e.distance_km.toFixed(1)}</td>
                          <td className="py-1 text-right font-mono text-muted-foreground">{fmtDur(e.duration_s)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
