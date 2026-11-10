/** FlyXC route import: `?p=` is a Google encoded polyline (1e-5 precision). */
export interface TaskPoint { lat: number; lon: number }
export interface FlightTask { points: TaskPoint[]; radius: number }
export interface TaskProgress { local: { x: number; y: number }[]; next: number; radius: number }

export const TASK_RADIUS_M = 400;

export function decodePolyline(s: string): TaskPoint[] {
  const out: TaskPoint[] = [];
  let i = 0, lat = 0, lon = 0;
  const next = () => {
    let shift = 0, result = 0, b: number;
    do {
      if (i >= s.length) throw new Error("bad polyline");
      b = s.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < s.length) {
    lat += next(); lon += next();
    out.push({ lat: lat / 1e5, lon: lon / 1e5 });
  }
  return out;
}

/** Returns null when the text is not a FlyXC link with at least 2 points. */
export function parseFlyxcLink(text: string): FlightTask | null {
  try {
    const url = new URL(text.trim());
    if (!/flyxc\.app$/i.test(url.hostname)) return null;
    const p = url.searchParams.get("p");
    if (!p) return null;
    const points = decodePolyline(p);
    if (points.length < 2 || points.some((q) => Math.abs(q.lat) > 90 || Math.abs(q.lon) > 180)) return null;
    return { points, radius: TASK_RADIUS_M };
  } catch {
    return null;
  }
}

/** Advance to the next turnpoint once the pilot is inside its cylinder. Point 0 is the launch. */
export function advanceTask(t: TaskProgress, x: number, y: number): boolean {
  const p = t.local[t.next];
  if (!p) return false;
  const dx = x - p.x, dy = y - p.y;
  if (dx * dx + dy * dy > t.radius * t.radius) return false;
  t.next++;
  return true;
}

export function taskDistanceKm(points: TaskPoint[]): number {
  let d = 0;
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1]!, b = points[k]!;
    const r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r;
    const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2;
    d += 2 * 6371 * Math.asin(Math.sqrt(h));
  }
  return d;
}
