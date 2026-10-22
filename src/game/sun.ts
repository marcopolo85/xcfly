const DEG = Math.PI / 180;

export interface SunPos {
  el: number; // radians above horizon
  az: number; // radians from north, clockwise
}

function decl(doy: number) {
  return 23.44 * DEG * Math.sin((2 * Math.PI * (284 + doy)) / 365);
}

/** Local clock hours -> apparent solar hour (CH ≈ 8°E, CET = 15°E). */
function solarHour(clock: number, dst: boolean) {
  return clock - (dst ? 1.47 : 0.47);
}

export function sunPosition(lat: number, doy: number, clockHour: number, dst: boolean): SunPos {
  const phi = lat * DEG;
  const d = decl(doy);
  const H = 15 * DEG * (solarHour(clockHour, dst) - 12);
  const sinEl = Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H);
  const el = Math.asin(sinEl);
  let az = Math.atan2(-Math.sin(H), Math.tan(d) * Math.cos(phi) - Math.sin(phi) * Math.cos(H));
  if (az < 0) az += 2 * Math.PI;
  return { el, az };
}

export function sunTimes(lat: number, doy: number, dst: boolean) {
  const phi = lat * DEG;
  const d = decl(doy);
  const c = -Math.tan(phi) * Math.tan(d);
  const H0 = Math.acos(Math.max(-1, Math.min(1, c))) / (15 * DEG);
  const noon = 12 + (dst ? 1.47 : 0.47);
  return { sunrise: noon - H0, sunset: noon + H0, noon };
}

/** Unit vector toward the sun in (east, north, up). */
export function sunVector(s: SunPos) {
  const c = Math.cos(s.el);
  return { x: Math.sin(s.az) * c, y: Math.cos(s.az) * c, z: Math.sin(s.el) };
}

export function fmtClock(h: number) {
  const t = ((h % 24) + 24) % 24;
  const hh = Math.floor(t);
  const mm = Math.floor((t - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
