/** Signed slider displacement: positive means down / zoom in. */
export function zoomRateFactor(displacement: number, seconds: number): number {
  return Math.exp(Math.max(-1, Math.min(1, displacement)) * 2 * Math.LN2 * Math.max(0, seconds));
}