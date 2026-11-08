/** Pure helpers for the live multiplayer radar (no React, no network). */
export interface PilotPacket { id: string; name: string; lat: number; lon: number; alt: number; heading: number; vz: number }
export interface RemotePilot extends PilotPacket { seen: number }

export const PILOT_TIMEOUT_MS = 60_000;
const R = 6378137;

export function toLatLon(site: { lat: number; lon: number }, x: number, y: number) {
  const scale = Math.cos(site.lat * Math.PI / 180);
  const ox = R * site.lon * Math.PI / 180, oy = R * Math.log(Math.tan(Math.PI / 4 + site.lat * Math.PI / 360));
  const mx = ox + x / scale, my = oy + y / scale;
  return { lat: (2 * Math.atan(Math.exp(my / R)) - Math.PI / 2) * 180 / Math.PI, lon: mx / R * 180 / Math.PI };
}

export function toLocal(site: { lat: number; lon: number }, lat: number, lon: number) {
  const scale = Math.cos(site.lat * Math.PI / 180);
  const ox = R * site.lon * Math.PI / 180, oy = R * Math.log(Math.tan(Math.PI / 4 + site.lat * Math.PI / 360));
  const mx = R * lon * Math.PI / 180, my = R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
  return { x: (mx - ox) * scale, y: (my - oy) * scale };
}

export function isPacket(p: unknown): p is PilotPacket {
  const o = p as PilotPacket;
  return !!o && typeof o.id === "string" && typeof o.name === "string" && o.name.length > 0 && o.name.length <= 40
    && [o.lat, o.lon, o.alt, o.heading, o.vz].every((n) => typeof n === "number" && Number.isFinite(n));
}

/** Removes pilots without an update for PILOT_TIMEOUT_MS. */
export function prunePilots(pilots: Map<string, RemotePilot>, now: number) {
  for (const [id, p] of pilots) if (now - p.seen > PILOT_TIMEOUT_MS) pilots.delete(id);
}
