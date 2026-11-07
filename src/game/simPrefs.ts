/** User-tunable simulation tempo and default map zoom levels. */
export interface SimPrefs { normalSpeed: number; accelSpeed: number; zoomAccel: number; autoZoom: boolean }
export const DEFAULT_SIM_PREFS: SimPrefs = { normalSpeed: 1, accelSpeed: 40, zoomAccel: 1, autoZoom: false };
const clamp = (v: unknown, lo: number, hi: number, d: number) => typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
export function parseSimPrefs(raw: string | null): SimPrefs {
  let o: Partial<Record<keyof SimPrefs, unknown>> = {};
  try { o = raw ? JSON.parse(raw) : {}; } catch { /* defaults */ }
  const d = DEFAULT_SIM_PREFS;
  return {
    normalSpeed: clamp(o.normalSpeed, 1, 5, d.normalSpeed), accelSpeed: clamp(o.accelSpeed, 10, 40, d.accelSpeed),
    zoomAccel: clamp(o.zoomAccel, 0.25, 4, d.zoomAccel),
    autoZoom: typeof o.autoZoom === "boolean" ? o.autoZoom : d.autoZoom,
  };
}
export const loadSimPrefs = () => parseSimPrefs(localStorage.getItem("simPrefs"));

export interface FlightZoomState { accel: boolean | null; thermal: number }
/** Remember the live map scale on entry to speedbar; never overwrite it with speedbar zoom. */
export function flightZoomTarget(state: FlightZoomState, accel: boolean, currentScale: number, prefs: SimPrefs): number | null {
  const previous = state.accel;
  state.accel = accel;
  if (previous === null || (!previous && accel)) state.thermal = currentScale;
  if (!prefs.autoZoom || previous === accel) return null;
  if (previous === null && !accel) return null;
  return accel ? prefs.zoomAccel : state.thermal;
}
