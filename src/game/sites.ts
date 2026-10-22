export interface Site {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  launchAlt: number;
  valley: number;
  peak: number;
  lake: boolean;
  seed: number;
}

export const SITES: Site[] = [
  { id: "niederhorn", name: "Niederhorn", region: "Interlaken · Berner Oberland", lat: 46.71, lon: 7.77, launchAlt: 1950, valley: 560, peak: 3000, lake: true, seed: 11 },
  { id: "fiesch", name: "Kühboden", region: "Fiesch · Goms", lat: 46.41, lon: 8.12, launchAlt: 2200, valley: 1050, peak: 3400, lake: false, seed: 23 },
  { id: "pizol", name: "Pizol", region: "Bad Ragaz · St. Galler Oberland", lat: 46.98, lon: 9.48, launchAlt: 2220, valley: 500, peak: 2900, lake: false, seed: 37 },
  { id: "jakobshorn", name: "Jakobshorn", region: "Davos · Graubünden", lat: 46.78, lon: 9.85, launchAlt: 2590, valley: 1560, peak: 3150, lake: true, seed: 51 },
];

export type Season = "spring" | "summer" | "autumn" | "winter";

export const SEASONS: Record<Season, { label: string; doy: number; dst: boolean; maxLift: number }> = {
  spring: { label: "Frühling", doy: 110, dst: true, maxLift: 3.8 },
  summer: { label: "Sommer", doy: 172, dst: true, maxLift: 4.5 },
  autumn: { label: "Herbst", doy: 265, dst: true, maxLift: 2.6 },
  winter: { label: "Winter", doy: 355, dst: false, maxLift: 1.6 },
};
