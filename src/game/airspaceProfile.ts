import { insideHorizontal, type Airspace } from "./airspace";

/** Exact horizontal intersections of the heading line with even-odd airspace rings. */
export function airspaceProfileIntervals(a: Airspace, origin: { x: number; y: number }, heading: number, min: number, max: number): [number, number][] {
  const dx = Math.sin(heading), dy = Math.cos(heading);
  const cuts = [min, max];
  for (const ring of a.rings) {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + 1) % ring.length];
      const px = p.x - origin.x, py = p.y - origin.y;
      const qx = q.x - origin.x, qy = q.y - origin.y;
      const ps = px * dy - py * dx, qs = qx * dy - qy * dx;
      if ((ps > 0) === (qs > 0)) continue;
      const t = ps / (ps - qs);
      const distance = (px + t * (qx - px)) * dx + (py + t * (qy - py)) * dy;
      if (distance > min && distance < max) cuts.push(distance);
    }
  }
  cuts.sort((a, b) => a - b);
  const result: [number, number][] = [];
  for (let i = 1; i < cuts.length; i++) {
    const start = cuts[i - 1], end = cuts[i], mid = (start + end) / 2;
    if (end - start > 0.001 && insideHorizontal(a, origin.x + dx * mid, origin.y + dy * mid)) result.push([start, end]);
  }
  return result;
}