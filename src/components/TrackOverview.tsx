const W = 320, H = 220, P = 20;

function trackPath(track: [number, number][]) {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const [lat, lng] of track) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  const dLat = Math.max(1e-4, maxLat - minLat);
  const dLng = Math.max(1e-4, maxLng - minLng);
  const scale = Math.min((W - 2 * P) / dLng, (H - 2 * P) / dLat);
  const pts = track.map(([lat, lng]) => `${(P + (lng - minLng) * scale).toFixed(1)},${(H - P - (lat - minLat) * scale).toFixed(1)}`);
  return { pts: pts.join(" "), first: pts[0] };
}

export function TrackOverview({ track }: { track: [number, number][] | null }) {
  const path = track && track.length >= 2 ? trackPath(track) : null;
  if (!path) {
    return <p className="py-16 text-center text-xs text-muted-foreground">Keine Trackdaten vorhanden.</p>;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
      <polyline points={path.pts} fill="none" stroke="currentColor" className="text-primary" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={Number(path.first.split(",")[0])} cy={Number(path.first.split(",")[1])} r="4" className="fill-climb" />
    </svg>
  );
}
