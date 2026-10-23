import { heightAt, type Terrain } from "./terrain";

/** Daytime valley (anabatic) wind: flows up-valley along the large-scale terrain gradient. */
export const VALLEY_WIND_MAX = 4; // m/s near the valley floor
const COARSE = 1500; // m, scale for valley axis direction
const WIND_DEPTH = 700; // m AGL where the wind fades out
const SOAR_DEPTH = 350; // m AGL where slope lift fades out
const MAX_RIDGE_LIFT = 3.5;

export function valleyWindAt(t: Terrain, x: number, y: number, alt: number) {
  const gx = (heightAt(t, x + COARSE, y) - heightAt(t, x - COARSE, y)) / (2 * COARSE);
  const gy = (heightAt(t, x, y + COARSE) - heightAt(t, x, y - COARSE)) / (2 * COARSE);
  const g = Math.hypot(gx, gy);
  const agl = alt - heightAt(t, x, y);
  if (g < 0.01 || agl > WIND_DEPTH) return { wx: 0, wy: 0, speed: 0 };
  const speed = VALLEY_WIND_MAX * Math.min(1, g / 0.08) * (1 - Math.max(0, agl) / WIND_DEPTH);
  return { wx: (gx / g) * speed, wy: (gy / g) * speed, speed };
}

/** Slope lift where the valley wind hits a slope (Prallhang): w = wind · ∇h. */
export function ridgeLift(t: Terrain, x: number, y: number, alt: number) {
  const w = valleyWindAt(t, x, y, alt);
  if (w.speed === 0) return 0;
  const e = 50;
  const gx = (heightAt(t, x + e, y) - heightAt(t, x - e, y)) / (2 * e);
  const gy = (heightAt(t, x, y + e) - heightAt(t, x, y - e)) / (2 * e);
  const agl = Math.max(0, alt - heightAt(t, x, y));
  const up = w.wx * gx + w.wy * gy;
  if (up <= 0) return 0;
  return Math.min(MAX_RIDGE_LIFT, up * 1.2) * Math.max(0, 1 - agl / SOAR_DEPTH);
}
