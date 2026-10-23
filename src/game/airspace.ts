// Swiss airspaces (BAZL via geo.admin.ch): pure helpers for limits, projection and vertical checks.
import { mapOrigin, MERCATOR_EXTENT } from "./swissMap";
import type { Site } from "./sites";

export type AirspaceKind = "CTR" | "TMA" | "CTA" | "FIZ" | "AD";
export interface Limit { value: number; type: string } // type: FL | AMSL (ft) | AGL (ft)
export interface Airspace {
  kind: AirspaceKind;
  name: string;
  lower: Limit;
  upper: Limit;
  rings: { x: number; y: number }[][]; // local flight metres
  label: { x: number; y: number };
}

export const AIRSPACE_LAYERS: Record<Exclude<AirspaceKind, "AD">, string> = {
  CTR: "ch.bazl.luftraeume-kontrollzonen",
  TMA: "ch.bazl.luftraeume-nahkontrollbezirke",
  CTA: "ch.bazl.luftraeume-kontrollbezirke",
  FIZ: "ch.bazl.luftraeume-fluginformationszonen",
};
export const AIRFIELD_LAYER = "ch.bazl.flugplaetze-heliports";
/** Radius (m) drawn around airfields/heliports without own airspace polygon. */
export const AIRFIELD_RADIUS = 1000;

export const AIRSPACE_COLORS: Record<AirspaceKind, [number, number, number]> = {
  CTR: [220, 40, 40],
  TMA: [40, 90, 220],
  CTA: [140, 60, 200],
  FIZ: [20, 150, 80],
  AD: [240, 130, 20],
};

const FT = 0.3048;

/** Limit in metres AMSL; AGL limits use the supplied ground height. */
export function limitMetres(l: Limit, ground: number) {
  if (l.type === "FL") return l.value * 100 * FT;
  if (l.type === "AGL") return ground + l.value * FT;
  return l.value * FT;
}

export function formatLimit(l: Limit) {
  if (l.type === "FL") return `FL${l.value}`;
  if (l.type === "AGL" && l.value === 0) return "GND";
  return `${Math.round(l.value)} ft${l.type === "AGL" ? " AGL" : ""}`;
}

/** Limit in metres: FL and ft are converted, AGL keeps its suffix. */
export function formatLimitM(l: Limit) {
  if (l.type === "AGL" && l.value === 0) return "GND";
  const m = Math.round(l.value * (l.type === "FL" ? 100 : 1) * FT);
  return `${m} m${l.type === "AGL" ? " AGL" : ""}`;
}

export function insideVertical(a: Airspace, alt: number, ground: number) {
  return alt >= limitMetres(a.lower, ground) && alt <= limitMetres(a.upper, ground);
}

export function insideHorizontal(a: Airspace, x: number, y: number) {
  let inside = false;
  for (const r of a.rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      if ((r[i].y > y) !== (r[j].y > y) && x < ((r[j].x - r[i].x) * (y - r[i].y)) / (r[j].y - r[i].y) + r[i].x) inside = !inside;
    }
  }
  return inside;
}

/** Project WGS84 lon/lat into launch-relative flight metres (same Mercator as the map). */
export function projector(site: Pick<Site, "lat" | "lon">) {
  const o = mapOrigin(site);
  const R = MERCATOR_EXTENT / Math.PI;
  return (lon: number, lat: number) => {
    const phi = (lat * Math.PI) / 180;
    return {
      x: (R * (lon * Math.PI) / 180 - o.x) * o.scale,
      y: (R * Math.log(Math.tan(Math.PI / 4 + phi / 2)) - o.y) * o.scale,
    };
  };
}

export function ringCentroid(r: { x: number; y: number }[]) {
  let x = 0, y = 0;
  for (const p of r) { x += p.x; y += p.y; }
  return { x: x / Math.max(1, r.length), y: y / Math.max(1, r.length) };
}
