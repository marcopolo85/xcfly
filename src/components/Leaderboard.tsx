import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SITES } from "@/game/sites";
import { modeLabel, type FlightMode } from "@/game/modes";
import { X } from "lucide-react";
import { TrackOverview } from "./TrackOverview";

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
const ENTRY_COLUMNS = "id,pilot_name,site_name,mode,distance_km,duration_s,created_at";

export async function submitFlight(pilot: string, site: string, mode: FlightMode, distanceKm: number, durationS: number, track: [number, number][]): Promise<string | null> {
  const { error } = await supabase.from("leaderboard_entries").insert({
    pilot_name: pilot.trim().slice(0, 40),
    site_name: site.slice(0, 80),
    mode,
    distance_km: Math.round(distanceKm * 10) / 10,
    duration_s: Math.round(durationS),
    track,
  });
  return error ? error.message : null;
}

function fmtTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

function TrackPopup({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const [track, setTrack] = useState<[number, number][] | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTrack(null);
    setMissing(false);
    supabase.from("leaderboard_entries").select("track").eq("id", entry.id).single().then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setMissing(true); return; }
      const t = (data as { track: [number, number][] | null } | null)?.track ?? null;
      if (t && t.length >= 2) setTrack(t);
      else setMissing(true);
    });
    return () => { cancelled = true; };
  }, [entry.id]);

  const path = track ? trackPath(track) : null;

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-label={`Track von ${entry.pilot_name}`}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-bold text-foreground">{entry.pilot_name}</h3>
            <p className="text-xs text-muted-foreground">{entry.site_name} · {modeLabel(entry.mode as FlightMode)}</p>
          </div>
          <button aria-label="Schliessen" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-2 flex gap-4 font-mono text-sm">
          <span className="font-bold text-foreground">{entry.distance_km.toFixed(1)} km</span>
          <span className="text-muted-foreground">{fmtTime(entry.duration_s)}</span>
        </div>
        <div className="mt-2 rounded-lg border border-border bg-background p-1">
          {track === null && !missing && <p className="py-16 text-center font-mono text-xs text-muted-foreground">Lade Track…</p>}
          {missing && <p className="py-16 text-center text-xs text-muted-foreground">Keine Trackdaten vorhanden.</p>}
          {path && (
            <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
              <polyline points={path.pts} fill="none" stroke="currentColor" className="text-primary" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={Number(path.first.split(",")[0])} cy={Number(path.first.split(",")[1])} r="4" className="fill-climb" />
            </svg>
          )}
        </div>
        {path && <p className="mt-1 text-[10px] text-muted-foreground">Punkt = Startplatz · Linie = Flugweg</p>}
      </div>
    </div>
  );
}

export function Leaderboard({ initialSite, onClose }: { initialSite?: string; onClose: () => void }) {
  const site = initialSite ?? SITES[0]?.name ?? "";
  const [entries, setEntries] = useState<Record<string, Entry[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Entry | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setError(null);
    // One fetch per ranked mode; the per-site split happens locally so every
    // launch site (including free map picks) gets its own ranking.
    Promise.all(
      RANKED_MODES.map((mode) =>
        supabase.from("leaderboard_entries").select(ENTRY_COLUMNS).eq("mode", mode).order("distance_km", { ascending: false }).limit(500)
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
                        <th className="py-1 pr-1">Pilot</th>
                        <th className="py-1 text-right">Km</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((e) => (
                        <tr key={e.id} className="border-t border-border/50 text-foreground">
                          <td className="max-w-0 truncate py-1 pr-1">
                            <button className="max-w-full truncate font-semibold hover:underline" title="Track anzeigen" onClick={() => setSelected(e)}>{e.pilot_name}</button>
                          </td>
                          <td className="py-1 text-right font-mono font-bold">{e.distance_km.toFixed(1)}</td>
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
      {selected && <TrackPopup entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
