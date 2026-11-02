import { glideRatio, type Sim } from "./physicsEngine";
import { EXTENT, RES, heightAt, type Terrain } from "./terrain";

export const GLIDE_BOUNDARY_RAYS = 180;

/** First terrain contact along each straight glide; NaN means no contact within loaded terrain.
 * Never use the clamped terrain sampler outside its actual coverage. */
export function traceGlideBoundary(t: Terrain, sim: Pick<Sim, "x" | "y" | "alt" | "speed" | "vz">, points: Float64Array) {
  points.fill(NaN);
  const ratio = glideRatio(sim.speed, sim.vz);
  if (!Number.isFinite(ratio) || ratio <= 0 || sim.alt <= heightAt(t, sim.x, sim.y)) return;
  const west = (t.centerX ?? 0) - EXTENT, east = west + 2 * EXTENT;
  const south = (t.centerY ?? 0) - EXTENT, north = south + 2 * EXTENT;
  if (sim.x < west || sim.x > east || sim.y < south || sim.y > north) return;
  for (let ray = 0; ray < GLIDE_BOUNDARY_RAYS; ray++) {
    const angle = ray * Math.PI * 2 / GLIDE_BOUNDARY_RAYS;
    const dx = Math.sin(angle), dy = Math.cos(angle);
    const maxX = dx > 0 ? (east - sim.x) / dx : dx < 0 ? (west - sim.x) / dx : Infinity;
    const maxY = dy > 0 ? (north - sim.y) / dy : dy < 0 ? (south - sim.y) / dy : Infinity;
    const maxDistance = Math.min(maxX, maxY);
    const clearance = (d: number) => sim.alt - d / ratio - heightAt(t, sim.x + dx * d, sim.y + dy * d);
    let previous = 0;
    for (let distance = Math.min(RES, maxDistance); distance > previous; distance = Math.min(distance + RES, maxDistance)) {
      if (clearance(distance) <= 0) {
        let lo = previous, hi = distance;
        for (let k = 0; k < 10; k++) {
          const mid = (lo + hi) / 2;
          if (clearance(mid) > 0) lo = mid; else hi = mid;
        }
        points[ray * 2] = sim.x + dx * lo;
        points[ray * 2 + 1] = sim.y + dy * lo;
        break;
      }
      previous = distance;
    }
  }
}