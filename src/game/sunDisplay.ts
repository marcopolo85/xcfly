const DIRS = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
/** German 16-point compass label for an azimuth in radians (clockwise from north). */
export function compassLabel(az: number) {
  const deg = ((az * 180 / Math.PI) % 360 + 360) % 360;
  return DIRS[Math.round(deg / 22.5) % 16];
}
/** Ground shadow offset (east, north) in metres of an object `agl` metres above flat ground. */
export function shadowOffset(sun: { x: number; y: number; z: number }, agl: number) {
  if (sun.z <= 0.03) return null;
  const k = Math.max(0, agl) / sun.z;
  return { x: -sun.x * k, y: -sun.y * k };
}
