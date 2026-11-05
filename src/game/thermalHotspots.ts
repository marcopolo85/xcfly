import type { Site } from "./sites";
import { kk7Slot } from "@/lib/kk7Limiter";
import { mapOrigin } from "./swissMap";
import { EXTENT, normalAt, type Terrain } from "./terrain";
import type { Thermal, ThermalField } from "./thermals";

export interface Hotspot { lon: number; lat: number; probability: number }
const R = 6378137;

/** Same ground-metre projection as the national map and DEM. */
export function hotspotLocal(site: Pick<Site, "lat" | "lon">, point: Pick<Hotspot, "lat" | "lon">) {
  const o = mapOrigin(site);
  return {
    x: (R * point.lon * Math.PI / 180 - o.x) * o.scale,
    y: (R * Math.log(Math.tan(Math.PI / 4 + point.lat * Math.PI / 360)) - o.y) * o.scale,
  };
}

export function hotspotUrl(site: Pick<Site, "lat" | "lon">) {
  const o = mapOrigin(site), d = EXTENT / o.scale / R;
  const lat = (y: number) => (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180 / Math.PI;
  const bounds = [lat(o.y - EXTENT / o.scale), site.lon - d * 180 / Math.PI,
    lat(o.y + EXTENT / o.scale), site.lon + d * 180 / Math.PI];
  // The hotspot endpoint accepts only limit; unlike raster tiles it rejects src.
  return `https://thermal.kk7.ch/api/hotspots/geojson/all_all/${bounds.map((v) => v.toFixed(6)).join(",")}?limit=10000`;
}

export function parseHotspots(data: unknown): Hotspot[] {
  if (!data || typeof data !== "object" || !("features" in data) || !Array.isArray(data.features)) {
    throw new Error("Ungültige KK7-Thermikdaten");
  }
  const points: Hotspot[] = [];
  for (const feature of data.features) {
    const c = feature?.geometry?.coordinates;
    const probability = feature?.properties?.probability;
    if (feature?.geometry?.type !== "Point" || !Array.isArray(c) ||
      typeof c[0] !== "number" || typeof c[1] !== "number" ||
      !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || Math.abs(c[0]) > 180 || Math.abs(c[1]) >= 85.051129 ||
      typeof probability !== "number" || !Number.isFinite(probability) || probability < 0 || probability > 1) continue;
    points.push({ lon: c[0], lat: c[1], probability });
  }
  if (!points.length) throw new Error("Keine KK7-Thermikpunkte verfügbar");
  return points;
}

const cache = new Map<string, Hotspot[]>();
/** Browser-only public read; retain points in memory for repeat flights. */
export async function loadThermalHotspots(site: Site): Promise<Hotspot[]> {
  const cached = cache.get(site.id);
  if (cached) return cached;
  await kk7Slot();
  const response = await fetch(hotspotUrl(site), { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error("KK7-Thermikdaten nicht erreichbar");
  const points = parseHotspots(await response.json());
  cache.set(site.id, points);
  return points;
}

/** Source locations never jitter and no synthetic launch thermal is added. */
export function generateHotspotThermals(t: Terrain, points: Hotspot[], rnd: () => number): ThermalField {
  const grid = new Map<number, Thermal[]>();
  const seen = new Set<string>();
  let count = 0;
  for (const point of points) {
    const { x, y } = hotspotLocal(t.site, point);
    if (Math.abs(x) > EXTENT || Math.abs(y) > EXTENT) continue;
    const id = `${point.lon},${point.lat}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const n = normalAt(t, x, y);
    const th: Thermal = { x, y, nx: n.x, ny: n.y, nz: n.z,
      r: 150 + point.probability * 110, power: 0.45 + point.probability,
      period: 250 + rnd() * 500, phase: rnd() * Math.PI * 2 };
    const key = (Math.floor(x / 1000) + 100) * 1000 + Math.floor(y / 1000) + 100;
    const sources = grid.get(key) ?? [];
    sources.push(th); grid.set(key, sources); count++;
  }
  return { grid, count };
}