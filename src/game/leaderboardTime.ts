/** Weekly leaderboard starts at the most recent Sunday 23:00 Zurich time (weekly reset). */
export function getWeeklyCutoff(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Zurich", year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23", weekday: "short",
  });
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday!);
  // Zurich wall clock as a pseudo-UTC date, to compute offset.
  const wall = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!);
  const offset = wall - Math.floor(now.getTime() / 1000) * 1000;
  let daysBack = wd;
  if (wd === 0 && +p.hour! < 23) daysBack = 7;
  const cutoffWall = Date.UTC(+p.year!, +p.month! - 1, +p.day! - daysBack, 23, 0, 0);
  return new Date(cutoffWall - offset).toISOString();
}
