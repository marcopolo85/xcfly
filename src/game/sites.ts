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
  { id: "mornera", name: "Mornera", region: "Monte Carasso · Tessin", lat: 46.20581, lon: 8.98583, launchAlt: 1369, valley: 230, peak: 2700, lake: false, seed: 11 },
  { id: "pany", name: "Pany (Chrüz)", region: "Prättigau · Graubünden", lat: 46.928, lon: 9.783, launchAlt: 1008, valley: 900, peak: 2500, lake: false, seed: 23 },
  { id: "gummen", name: "Gummen", region: "Oberdorf · Nidwalden", lat: 46.902806, lon: 8.365261, launchAlt: 1585, valley: 434, peak: 1970, lake: true, seed: 37 },
  { id: "zugerberg", name: "Zugerberg", region: "Zug · Zentralschweiz", lat: 47.146, lon: 8.528, launchAlt: 803, valley: 420, peak: 1100, lake: true, seed: 51 },
  { id: "weissenstein", name: "Weissenstein", region: "Solothurn · Jura", lat: 47.255, lon: 7.512, launchAlt: 1262, valley: 450, peak: 1400, lake: false, seed: 67 },
  { id: "niesen", name: "Niesen", region: "Mülenen · Berner Oberland", lat: 46.643, lon: 7.652, launchAlt: 2156, valley: 560, peak: 2362, lake: true, seed: 83 },
  { id: "cari", name: "Carì", region: "Faido · Tessin", lat: 46.509117, lon: 8.817567, launchAlt: 2150, valley: 700, peak: 2600, lake: false, seed: 97 },
  { id: "rotenflue", name: "Rotenflue", region: "Schwyz · Zentralschweiz", lat: 47.017647, lon: 8.700672, launchAlt: 1502, valley: 500, peak: 1900, lake: true, seed: 113 },
  { id: "pilatus", name: "Pilatus Kulm", region: "Kriens · Luzern", lat: 46.979386, lon: 8.255175, launchAlt: 2040, valley: 450, peak: 2128, lake: true, seed: 131 },
  { id: "brunni", name: "Brunni (Tümpfeli)", region: "Engelberg · Obwalden", lat: 46.840833, lon: 8.415, launchAlt: 1977, valley: 1000, peak: 3200, lake: false, seed: 149 },
];

export type Season = "spring" | "summer" | "autumn" | "winter";

export const SEASONS: Record<Season, { label: string; doy: number; dst: boolean; maxLift: number }> = {
  spring: { label: "Frühling", doy: 110, dst: true, maxLift: 3.8 },
  summer: { label: "Sommer", doy: 172, dst: true, maxLift: 4.5 },
  autumn: { label: "Herbst", doy: 265, dst: true, maxLift: 2.6 },
  winter: { label: "Winter", doy: 355, dst: false, maxLift: 1.6 },
};
