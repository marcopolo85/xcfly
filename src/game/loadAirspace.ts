import { AIRFIELD_LAYER, AIRFIELD_RADIUS, AIRSPACE_LAYERS, projector, ringCentroid, type Airspace, type AirspaceKind } from "./airspace";
import type { Site } from "./sites";

const cache = new Map<string, Promise<Airspace[]>>();
const API = "https://api3.geo.admin.ch/rest/services/api/MapServer/identify";

interface Feature { geometry: { type: string; coordinates: unknown }; properties: { name?: string; label?: string; loli_value?: number; loli_type?: string; upli_value?: number; upli_type?: string; icao?: string } }

async function fetchLayer(layer: string, bbox: string) {
  const out: Feature[] = [];
  for (let offset = 0; offset < 1000; offset += 50) {
    const url = `${API}?geometryType=esriGeometryEnvelope&geometry=${bbox}&sr=4326&layers=all:${layer}&tolerance=0&returnGeometry=true&geometryFormat=geojson&limit=50&offset=${offset}&lang=de`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`airspace ${res.status}`);
    const r = ((await res.json()) as { results: Feature[] }).results ?? [];
    out.push(...r);
    if (r.length < 50) break;
  }
  return out;
}

/** Load CTR/TMA/CTA/FIZ polygons and airfields/heliports around the launch. Cached per site. */
export function loadAirspace(site: Site): Promise<Airspace[]> {
  const key = `${site.lat.toFixed(3)},${site.lon.toFixed(3)}`;
  let p = cache.get(key);
  if (!p) {
    p = build(site).catch((e) => { cache.delete(key); throw e; });
    cache.set(key, p);
  }
  return p;
}

async function build(site: Site): Promise<Airspace[]> {
  const bbox = `${site.lon - 0.9},${site.lat - 0.6},${site.lon + 0.9},${site.lat + 0.6}`;
  const proj = projector(site);
  const result: Airspace[] = [];
  await Promise.all(Object.entries(AIRSPACE_LAYERS).map(async ([kind, layer]) => {
    for (const f of await fetchLayer(layer, bbox)) {
      const pr = f.properties;
      const polys = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
      const rings = polys.flatMap((poly) => poly.map((ring) => ring.map(([lon, lat]) => proj(lon, lat))));
      if (!rings.length) continue;
      const biggest = rings.reduce((a, b) => (b.length > a.length ? b : a));
      result.push({
        kind: kind as AirspaceKind,
        name: String(pr.name ?? pr.label ?? kind),
        lower: { value: Number(pr.loli_value ?? 0), type: String(pr.loli_type ?? "AGL") },
        upper: { value: Number(pr.upli_value ?? 0), type: String(pr.upli_type ?? "AMSL") },
        rings, label: ringCentroid(biggest),
      });
    }
  }).concat((async () => {
    for (const f of await fetchLayer(AIRFIELD_LAYER, bbox)) {
      const [lon, lat] = f.geometry.coordinates as number[];
      const c = proj(lon, lat);
      const ring = Array.from({ length: 32 }, (_, i) => ({ x: c.x + AIRFIELD_RADIUS * Math.cos((i / 32) * Math.PI * 2), y: c.y + AIRFIELD_RADIUS * Math.sin((i / 32) * Math.PI * 2) }));
      const pr = f.properties;
      result.push({
        kind: "AD", name: `${pr.icao ? `${pr.icao} ` : ""}${pr.name ?? ""}`.trim(),
        lower: { value: 0, type: "AGL" }, upper: { value: 1000, type: "AGL" }, rings: [ring], label: c,
      });
    }
  })()));
  // draw big spaces first so small ones stay on top
  const order: AirspaceKind[] = ["TMA", "CTA", "FIZ", "CTR", "AD"];
  return result.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}
