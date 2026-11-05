import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SITES } from "@/game/sites";
import type { RouteType } from "@/game/xcScore";
import { RouteIcon, ROUTE_LABEL } from "./RouteIcon";
import { X } from "lucide-react";
import { TrackOverview } from "./TrackOverview";
import { Button } from "./ui/button";

interface Entry {
  id: string;
  pilot_name: string;
  site_name: string;
  mode: string;
  distance_km: number;
  duration_s: number;
  points: number;
  route_type: string;
  created_at: string;
}

const ENTRY_COLUMNS = "id,pilot_name,site_name,mode,distance_km,duration_s,points,route_type,created_at";
const asRoute = (t: string): RouteType => (t === "fai" || t === "tri" ? t : "free");
const xcSpeed = (e: Entry) => (e.duration_s > 0 ? e.distance_km / (e.duration_s / 3600) : 0);

export async function loadLeaderboardEntries(site?: string) {
  const entries: Entry[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase.from("leaderboard_entries").select(ENTRY_COLUMNS).eq("mode", "xc");
    if (site !== undefined) query = query.eq("site_name", site);
    const ordered = query.order("points", { ascending: false }).order("id", { ascending: true });
    const { data, error } = await (site === undefined ? ordered.range(offset, offset + pageSize - 1) : ordered.limit(50));
    if (error) return { data: null, error };
    const page = (data ?? []) as Entry[];
    entries.push(...page);
    if (site !== undefined || page.length < pageSize) return { data: entries, error: null };
  }
}

export async function submitFlight(pilot: string, site: string, distanceKm: number, points: number, routeType: RouteType, durationS: number, track: [number, number][]): Promise<string | null> {
  const { error } = await supabase.from("leaderboard_entries").insert({
    pilot_name: pilot.trim().slice(0, 40),
    site_name: site.slice(0, 80),
    mode: "xc",
    distance_km: Math.round(distanceKm * 10) / 10,
    points: Math.round(points * 100) / 100,
    route_type: routeType,
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

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Row skeleton: symbol, pilot, startplatz + date, km, points, speed – equal gaps, aligned columns. */
const ROW_COLS = "grid-cols-[1rem_minmax(0,1fr)_6rem_2.4rem_2.6rem_2.4rem]";
const META = "min-w-0 text-right leading-tight";
const NUM = "text-right font-mono";

/** Local date and time of a flight entry, e.g. "05.11.26" and "21:39". */
export function fmtStamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "–", time: "" };
  return {
    date: `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${pad2(d.getFullYear() % 100)}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
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


  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-label={`Track von ${entry.pilot_name}`}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-bold text-foreground">{entry.pilot_name}</h3>
            <p className="text-xs text-muted-foreground">{entry.site_name} · {ROUTE_LABEL[asRoute(entry.route_type)]} · {fmtStamp(entry.created_at).date}</p>
          </div>
          <button aria-label="Schliessen" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-2 flex gap-4 font-mono text-sm">
          <span className="font-bold text-foreground">{entry.points.toFixed(1)} Pkt</span>
          <span className="text-foreground">{entry.distance_km.toFixed(1)} km</span>
          <span className="text-muted-foreground">{fmtTime(entry.duration_s)}</span>
        </div>
        <div className="mt-2 rounded-lg border border-border bg-background p-1">
          {track === null && !missing && <p className="py-16 text-center font-mono text-xs text-muted-foreground">Lade Track…</p>}
          {missing && <TrackOverview track={null} />}
          {track !== null && <TrackOverview track={track} expandable />}
        </div>
        {track !== null && <p className="mt-1 text-[10px] text-muted-foreground">Punkt = Startplatz · Linie = Flugweg</p>}
      </div>
    </div>
  );
}

export function Leaderboard({ initialSite, overall = false, onClose }: { initialSite?: string; overall?: boolean; onClose: () => void }) {
  const site = overall ? undefined : initialSite ?? SITES[0]?.name ?? "";
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Entry | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setError(null);
    loadLeaderboardEntries(site)
      .then(({ data, error: e }) => {
        if (cancelled) return;
        if (e) setError("Rangliste konnte nicht geladen werden.");
        else setEntries(data as Entry[]);
      });
    return () => { cancelled = true; };
  }, [site]);

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-background/80 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-label="Rangliste">
      <div className={`flex max-h-[85dvh] w-full flex-col rounded-xl border border-border bg-card p-3 sm:p-4 ${overall ? "max-w-2xl" : "max-w-lg"}`}>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <h2 className="truncate font-display text-lg font-bold text-foreground sm:text-xl">{overall ? "Gesamtrangliste XC" : `Rangliste XC · ${site}`}</h2>
          <Button variant="ghost" size="icon" aria-label="Schliessen" onClick={onClose} className="shrink-0 text-muted-foreground"><X /></Button>
        </div>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {error && <p className="py-6 text-center text-sm text-sink">{error}</p>}
          {!error && entries === null && <p className="py-6 text-center font-mono text-sm text-muted-foreground">Lade…</p>}
          {!error && entries !== null && entries.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Noch keine Einträge.</p>}
          {!error && entries !== null && entries.length > 0 && (
            <div className="text-xs">
              <div className={`grid items-end gap-x-2 ${ROW_COLS} hud-label pb-1`}>
                <span className="w-4" />
                <span className="min-w-0">Pilot</span>
                <span className={`${META} text-[10px]`}>{overall ? "Startplatz · Datum" : "Datum"}</span>
                <span className="text-right">Km</span>
                <span className="text-right">Pkt</span>
                <span className="text-right">km/h</span>
              </div>
              {entries.map((e) => {
                const st = fmtStamp(e.created_at);
                return (
                  <div key={e.id} className={`grid items-center gap-x-2 border-t border-border/50 py-1.5 ${ROW_COLS}`}>
                    <RouteIcon type={asRoute(e.route_type)} className="h-4 w-4 shrink-0" />
                    <button className="min-w-0 text-left font-semibold leading-tight [overflow-wrap:anywhere] hover:underline" title="Track anzeigen" onClick={() => setSelected(e)}>{e.pilot_name}</button>
                    <div className={META}>
                      {overall && <div className="text-muted-foreground [overflow-wrap:anywhere]">{e.site_name}</div>}
                      <div className="font-mono text-[10px] text-muted-foreground">{st.date}</div>
                    </div>
                    <span className={NUM}>{e.distance_km.toFixed(1)}</span>
                    <span className={`${NUM} font-bold`}>{e.points.toFixed(1)}</span>
                    <span className={`${NUM} text-muted-foreground`}>{xcSpeed(e).toFixed(1)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {selected && <TrackPopup entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
