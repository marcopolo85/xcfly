/** Pure replay of top-3 leaderboard tracks as visual-only ghosts (no physics/scoring impact). */
export const GHOST_STYLES = [
  { medal: "🥇", color: "#f59e0b" },
  { medal: "🥈", color: "#e2e8f0" },
  { medal: "🥉", color: "#b45309" },
] as const;

export interface Ghost { name: string; rank: number; duration: number; pts: { x: number; y: number }[] }

/** Track points carry no timestamps: assume uniform spacing over the flight duration. Returns null once landed. */
export function ghostAt(g: Ghost, t: number) {
  const n = g.pts.length;
  if (n < 2 || g.duration <= 0 || t > g.duration) return null;
  const f = (Math.max(0, t) / g.duration) * (n - 1);
  const i = Math.min(n - 2, Math.floor(f)), k = f - i;
  const a = g.pts[i], b = g.pts[i + 1];
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, heading: Math.atan2(b.x - a.x, b.y - a.y), index: i };
}
