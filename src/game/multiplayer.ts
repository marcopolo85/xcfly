/** Pure helpers for the live multiplayer radar (no React, no network). */
/** vx/vy in m per real second (time-lapse included), hr = heading change in rad per real second. */
export interface PilotPacket { id: string; name: string; lat: number; lon: number; alt: number; heading: number; vz: number; vx?: number; vy?: number; hr?: number; vzr?: number }
/** Display state (dx/dy/dh/da) is advanced every frame and eased towards the extrapolated packet. */
export interface RemotePilot extends PilotPacket { seen: number; px?: number; py?: number; dx?: number; dy?: number; dh?: number; da?: number }

export const SEND_INTERVAL_MS = 250;
/** Never extrapolate further than this past the last packet (lost connection, landed). */
export const MAX_EXTRAPOLATION_S = 2;
const EASE_S = 0.15;

function wrapAngle(a: number) { return a - 2 * Math.PI * Math.round(a / (2 * Math.PI)); }

/** Dead reckoning: predicted position from last packet plus velocity, then eased display state. */
export function advanceRemote(p: RemotePilot, now: number, dtS: number) {
  const t = Math.min(MAX_EXTRAPOLATION_S, Math.max(0, (now - p.seen) / 1000));
  const tx = (p.px ?? 0) + (p.vx ?? 0) * t, ty = (p.py ?? 0) + (p.vy ?? 0) * t;
  const th = p.heading + (p.hr ?? 0) * t, ta = p.alt + (p.vzr ?? 0) * t;
  if (p.dx === undefined || p.dy === undefined || p.dh === undefined || p.da === undefined) { p.dx = tx; p.dy = ty; p.dh = th; p.da = ta; return p; }
  const k = 1 - Math.exp(-Math.max(0, dtS) / EASE_S);
  p.dx += (tx - p.dx) * k; p.dy += (ty - p.dy) * k; p.da += (ta - p.da) * k;
  p.dh += wrapAngle(th - p.dh) * k;
  return p;
}

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
    && [o.lat, o.lon, o.alt, o.heading, o.vz].every((n) => typeof n === "number" && Number.isFinite(n))
    && [o.vx, o.vy, o.hr, o.vzr].every((n) => n === undefined || (typeof n === "number" && Number.isFinite(n)));
}

/** Removes pilots without an update for PILOT_TIMEOUT_MS. */
export function prunePilots(pilots: Map<string, RemotePilot>, now: number) {
  for (const [id, p] of pilots) if (now - p.seen > PILOT_TIMEOUT_MS) pilots.delete(id);
}
