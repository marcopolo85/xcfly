/** Cheap approximations for hot loops: speed over precision (≈1 % error). */

/** exp(x) for x ≤ 0 via (1 + x/256)^256 — 8 multiplications, no libm call. */
export function fastExpNeg(x: number) {
  if (x < -20) return 0;
  let y = 1 + x / 256;
  if (y <= 0) return 0;
  y *= y; y *= y; y *= y; y *= y; y *= y; y *= y; y *= y; y *= y;
  return y;
}

/** Euclidean length; Math.hypot is far slower due to overflow handling. */
export function len(dx: number, dy: number) {
  return Math.sqrt(dx * dx + dy * dy);
}
