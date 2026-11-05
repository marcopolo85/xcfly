/**
 * XContest-Wertung (Schweiz/World): freie Strecke über bis zu 3 Wendepunkte (×1.0),
 * flaches Dreieck (×1.2) und FAI-Dreieck (×1.4). Ein Dreieck gilt als geschlossen,
 * wenn Anfangs- und Endpunkt höchstens 20 % des Umfangs auseinanderliegen;
 * gewertete Strecke = Umfang − Schliessdistanz.
 */
import { CLOSING_RATIO, FAI_MIN_LEG } from "./xcTriangle";

export type RouteType = "free" | "tri" | "fai";
export const XC_FACTORS: Record<RouteType, number> = { free: 1.0, tri: 1.2, fai: 1.4 };
export interface XcScore { type: RouteType; distance: number; points: number }

const MAX_PTS = 120;

export function xcScore(xs: number[], ys: number[]): XcScore {
  const px: number[] = [0], py: number[] = [0];
  const stride = Math.max(1, Math.ceil(xs.length / MAX_PTS));
  for (let i = 0; i < xs.length; i += stride) { px.push(xs[i]); py.push(ys[i]); }
  if (xs.length) { px.push(xs[xs.length - 1]); py.push(ys[ys.length - 1]); }
  const m = px.length;
  const D = new Float64Array(m * m);
  for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) D[i * m + j] = D[j * m + i] = Math.sqrt((px[i] - px[j]) ** 2 + (py[i] - py[j]) ** 2);

  // Free distance: 5 points (start, 3 TPs, end) in track order, maximised by DP.
  let prev = new Float64Array(m);
  for (let leg = 0; leg < 4; leg++) {
    const cur = new Float64Array(m);
    for (let j = 0; j < m; j++) { let b = 0; for (let i = 0; i <= j; i++) { const v = prev[i] + D[i * m + j]; if (v > b) b = v; } cur[j] = b; }
    prev = cur;
  }
  let free = 0; for (let j = 0; j < m; j++) if (prev[j] > free) free = prev[j];
  let best: XcScore = { type: "free", distance: free, points: free / 1000 };

  // C[i][k] = min distance between a point at/before i and a point at/after k.
  const C = new Float64Array(m * m);
  for (let i = 0; i < m; i++) for (let k = m - 1; k >= i; k--) {
    let v = D[i * m + k];
    if (i > 0 && C[(i - 1) * m + k] < v) v = C[(i - 1) * m + k];
    if (k < m - 1 && C[i * m + k + 1] < v) v = C[i * m + k + 1];
    C[i * m + k] = v;
  }
  for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) for (let k = j + 1; k < m; k++) {
    const a = D[i * m + j], b = D[j * m + k], c = D[k * m + i], p = a + b + c;
    const gap = C[i * m + k];
    if (gap > CLOSING_RATIO * p) continue;
    const type: RouteType = Math.min(a, b, c) >= FAI_MIN_LEG * p ? "fai" : "tri";
    const dist = p - gap, pts = (dist / 1000) * XC_FACTORS[type];
    if (pts > best.points) best = { type, distance: dist, points: pts };
  }
  return best;
}
