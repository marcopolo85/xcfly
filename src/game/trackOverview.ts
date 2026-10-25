import { mapOrigin } from "./swissMap";

/** Fit a geographic track using exactly the flight map's projection and 55% vertical anchor. */
export function fitTrackOverview(track: [number, number][], width: number, height: number) {
  const first = track[0];
  if (!first || track.length < 2 || width <= 48 || height <= 48) return null;
  const site = { lat: first[0], lon: first[1] };
  const origin = mapOrigin(site);
  const points = track.map(([lat, lon]) => {
    const point = mapOrigin({ lat, lon });
    return { x: (point.x - origin.x) * origin.scale, y: (point.y - origin.y) * origin.scale };
  });
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const zoom = Math.min((width - 48) / Math.max(500, maxX - minX), (height - 48) / Math.max(500, maxY - minY));
  const x = (minX + maxX) / 2;
  const y = (minY + maxY) / 2 + height * 0.05 / zoom;
  return {
    site, x, y, zoom,
    points: points.map((p) => ({ x: width / 2 + (p.x - x) * zoom, y: height * 0.55 - (p.y - y) * zoom })),
  };
}