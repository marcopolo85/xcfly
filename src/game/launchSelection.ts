import { mapOrigin } from "./swissMap";
import type { Site } from "./sites";

/** Inverse of the flight map's launch-relative ground-metre projection. */
export function localToCoordinates(originSite: Pick<Site, "lat" | "lon">, x: number, y: number) {
  const origin = mapOrigin(originSite), radius = 6378137;
  return {
    lon: (origin.x + x / origin.scale) / radius * 180 / Math.PI,
    lat: (2 * Math.atan(Math.exp((origin.y + y / origin.scale) / radius)) - Math.PI / 2) * 180 / Math.PI,
  };
}

export function selectedLaunch(base: Site, lat: number, lon: number, altitude: number): Site {
  return { ...base, id: `map-${lat.toFixed(6)}-${lon.toFixed(6)}`, name: "Eigener Startplatz", region: `${lat.toFixed(5)}° N · ${lon.toFixed(5)}° E`, lat, lon, launchAlt: altitude, valley: Math.max(0, altitude - 1000), peak: altitude + 1500 };
}