/** Match the ranked flight's second precision; historical missing durations remain unknown. */
export function finishedFlightStats(site: string, mode: string, seconds: number) {
  return { site_name: site, mode, duration_s: Math.round(seconds) };
}

export function formatFlightHours(hours: number) {
  return hours.toLocaleString("de-CH", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}