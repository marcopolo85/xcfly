import { zoomIdentity } from "d3-zoom";

/** Keep the zoom scale while restoring the pilot's screen anchor. */
export function recenterTransform(scale: number, width: number, height: number, anchorY = 0.5) {
  return zoomIdentity.translate((1 - scale) * width / 2, (1 - scale) * height * anchorY).scale(scale);
}