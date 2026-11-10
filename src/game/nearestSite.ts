import { SITES } from "./sites";

/** Well-known Swiss launches and prominent mountains, used to name free launches. */
const PLACES: [string, number, number][] = [
  ...SITES.map((s): [string, number, number] => [s.name, s.lat, s.lon]),
  ["Rigi Kulm", 47.0567, 8.4853], ["Rigi Scheidegg", 47.0283, 8.5233], ["Ebenalp", 47.2847, 9.4103],
  ["Kronberg", 47.2889, 9.3283], ["Säntis", 47.2494, 9.3433], ["Grindelwald First", 46.66, 8.0539],
  ["Männlichen", 46.6122, 7.9408], ["Schilthorn", 46.5578, 7.835], ["Niederhorn", 46.7086, 7.7714],
  ["Verbier", 46.0961, 7.2286], ["Gornergrat", 45.9833, 7.7839], ["Davos Jakobshorn", 46.7728, 9.8494],
  ["Scuol Motta Naluns", 46.8, 10.2833], ["Braunwald", 46.9408, 8.9853], ["Cimetta", 46.2, 8.79],
  ["Monte Lema", 46.0386, 8.8344], ["Monte Generoso", 45.9314, 9.0197], ["Titlis", 46.7719, 8.4375],
  ["Tödi", 46.8111, 8.9147], ["Chasseral", 47.1328, 7.0597], ["Churfirsten", 47.1556, 9.2667],
  ["Stanserhorn", 46.9294, 8.3389], ["Brienzer Rothorn", 46.7869, 8.0472], ["Fronalpstock", 46.9708, 8.6386],
  ["Klewenalp", 46.9353, 8.4747], ["Hoch-Ybrig", 47.0, 8.8], ["Wasserngrat", 46.47, 7.31],
  ["Leukerbad", 46.38, 7.63], ["Crans-Montana", 46.33, 7.48], ["Moléson", 46.5486, 7.0172],
  ["Chaumont", 47.0283, 6.9539], ["Hasliberg", 46.75, 8.2], ["Flims Cassons", 46.86, 9.25],
  ["Pizol", 47.0, 9.4], ["Engelberg Brunni", 46.84, 8.41], ["Grosser Mythen", 47.0294, 8.6872],
  ["Napf", 47.0039, 7.94], ["Gurnigel", 46.75, 7.45], ["Eggishorn", 46.4294, 8.0983],
];

/** Name of the nearest known launch or mountain (equirectangular distance; ok at Swiss scale). */
export function findNearestSiteOrPeak(lat: number, lon: number): string {
  const k = Math.cos(lat * Math.PI / 180);
  let best = PLACES[0]![0], bestD = Infinity;
  for (const [name, plat, plon] of PLACES) {
    const dx = (plon - lon) * k, dy = plat - lat, d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = name; }
  }
  return best;
}
