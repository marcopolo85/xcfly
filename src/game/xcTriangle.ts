/** Unfinished XC triangle (XCTrack-style): best triangle over track vertices. */
export interface Pt { x: number; y: number }
export interface XcTriangle {
  a: Pt; b: Pt; c: Pt;
  perimeter: number;
  fai: boolean;
  /** Distance still missing to close the triangle (current position → a). */
  closing: number;
}

/** FAI triangle: every leg is at least 28 % of the perimeter. */
export const FAI_MIN_LEG = 0.28;
/** Closing cylinder radius as share of the perimeter (XContest). */
export const CLOSING_RATIO = 0.2;
const MAX_PTS = 70;

const d = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y);

export function isFai(a: Pt, b: Pt, c: Pt) {
  const l1 = d(a, b), l2 = d(b, c), l3 = d(c, a), p = l1 + l2 + l3;
  return p > 0 && Math.min(l1, l2, l3) >= FAI_MIN_LEG * p;
}

/** Best triangle (largest perimeter, FAI preferred via XContest-like 1.4 vs 1.2 weight). */
export function bestTriangle(xs: number[], ys: number[], cur: Pt): XcTriangle | null {
  const pts: Pt[] = [{ x: 0, y: 0 }];
  const n = xs.length;
  const stride = Math.max(1, Math.ceil(n / MAX_PTS));
  for (let i = 0; i < n; i += stride) pts.push({ x: xs[i], y: ys[i] });
  pts.push(cur);
  const m = pts.length;
  let best: XcTriangle | null = null, bestScore = 0;
  for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) {
    const lij = d(pts[i], pts[j]);
    for (let k = j + 1; k < m; k++) {
      const l2 = d(pts[j], pts[k]), l3 = d(pts[k], pts[i]);
      const p = lij + l2 + l3;
      const fai = Math.min(lij, l2, l3) >= FAI_MIN_LEG * p;
      const score = p * (fai ? 1.4 : 1.2);
      if (score > bestScore) {
        bestScore = score;
        best = { a: pts[i], b: pts[j], c: pts[k], perimeter: p, fai, closing: d(cur, pts[i]) };
      }
    }
  }
  return best && best.perimeter > 300 ? best : null;
}

/**
 * Min/max perimeter of the FAI sector on the fixed leg A–B (where the third
 * vertex can still be placed) — identical to the "min/max km" label the map
 * draws for that sector: min = L/0.44, max = L/0.28.
 */
export function faiRange(t: XcTriangle): { min: number; max: number } {
  const L = d(t.a, t.b);
  return {
    min: L / (1 - 2 * FAI_MIN_LEG),
    max: L / FAI_MIN_LEG,
  };
}

/** Distance still to fly until the current position enters the closing cylinder. */
export function closingGap(t: XcTriangle): number {
  return Math.max(0, t.closing - CLOSING_RATIO * t.perimeter);
}
