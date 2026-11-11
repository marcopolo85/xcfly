/** Weekly task: deterministic per week (cutoff = Sunday 23:00 Europe/Zurich), random launch from SITES,
 *  3 turnpoints forming a closed ~150 km route that stays inside THERMAL_REGION. */
import { SITES, type Site } from "./sites";
import { mulberry32 } from "./rng";
import { getWeeklyCutoff } from "./leaderboardTime";
import { inThermalRegion } from "./thermalRegion";
import { TASK_RADIUS_M, taskDistanceKm, type FlightTask, type TaskPoint, type TaskProgress } from "./flyxcTask";

export const WEEKLY_TASK_KM = 150;
export const WEEKLY_MODE = "weekly_task";

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

function offset(p: TaskPoint, km: number, bearingDeg: number): TaskPoint {
  const b = (bearingDeg * Math.PI) / 180;
  return { lat: p.lat + (km * Math.cos(b)) / 111.2, lon: p.lon + (km * Math.sin(b)) / (111.2 * Math.cos((p.lat * Math.PI) / 180)) };
}

export function weeklyTask(now: Date = new Date()): { site: Site; task: FlightTask; weekStart: string } {
  const weekStart = getWeeklyCutoff(now);
  const rnd = mulberry32(hash(weekStart));
  const sites = SITES.filter((s) => inThermalRegion(s.lat, s.lon));
  const site = sites[Math.floor(rnd() * sites.length)]!;
  const L = { lat: site.lat, lon: site.lon };
  let best: TaskPoint[] = [L, offset(L, 50, 60), offset(L, 50, 120), L];
  for (let k = 0; k < 200; k++) {
    // Flat triangle-ish loop: two turnpoints out, third back near launch (goal), legs ~40–60 km.
    const dir = rnd() * 360, turn = (rnd() < 0.5 ? 1 : -1) * (50 + rnd() * 40);
    const a = offset(L, 45 + rnd() * 15, dir);
    const b = offset(a, 45 + rnd() * 15, dir + turn);
    const c = offset(L, 3 + rnd() * 5, rnd() * 360);
    const pts = [L, a, b, c];
    if (!pts.every((p) => inThermalRegion(p.lat, p.lon))) continue;
    const scale = WEEKLY_TASK_KM / taskDistanceKm(pts);
    const scaled = pts.map((p) => ({ lat: L.lat + (p.lat - L.lat) * scale, lon: L.lon + (p.lon - L.lon) * scale }));
    if (scaled.every((p) => inThermalRegion(p.lat, p.lon))) { best = scaled; break; }
  }
  return { site, task: { points: best, radius: TASK_RADIUS_M }, weekStart };
}

/** Task km flown: completed legs + progress on the current leg (local metres). */
export function taskFlownKm(t: TaskProgress, x: number, y: number): number {
  let d = 0;
  for (let k = 1; k < t.next && k < t.local.length; k++) d += Math.hypot(t.local[k].x - t.local[k - 1].x, t.local[k].y - t.local[k - 1].y);
  if (t.next < t.local.length) {
    const a = t.local[t.next - 1], b = t.local[t.next];
    const leg = Math.hypot(b.x - a.x, b.y - a.y);
    d += Math.max(0, leg - Math.hypot(b.x - x, b.y - y));
  }
  return d / 1000;
}

export type WeeklyRow = { distance_km: number; duration_s: number };
export const compareWeekly = (a: WeeklyRow, b: WeeklyRow) => b.distance_km - a.distance_km || a.duration_s - b.duration_s;
