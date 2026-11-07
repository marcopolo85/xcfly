import { zoomIdentity } from "d3-zoom";

export function flightAnchorFraction(height: number, instrumentTop: number, mobile: boolean, profile: boolean) {
  return mobile && height > 0 ? Math.max(0, Math.min(height, instrumentTop)) / (2 * height) : profile ? 1 / 3 : 1 / 2;
}

/** Keep the zoom scale while restoring the pilot's screen anchor. */
export function recenterTransform(scale: number, width: number, height: number, anchorY = 0.5) {
  return zoomIdentity.translate((1 - scale) * width / 2, (1 - scale) * height * anchorY).scale(scale);
}