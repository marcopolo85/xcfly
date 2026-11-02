export type FlightMode = "xc" | "free";

export const MODES: { v: FlightMode; label: string; desc: string }[] = [
  { v: "xc", label: "XC", desc: "Wertung wie beim XContest Schweiz: freie Strecke über bis zu 3 Wendepunkte ×1.0, flaches Dreieck ×1.2, FAI-Dreieck ×1.4 (jede Seite ≥ 28 % des Umfangs). Ein Dreieck ist geschlossen, wenn Start- und Endpunkt höchstens 20 % des Umfangs auseinanderliegen. Die Rangliste zählt XC-Punkte." },
  { v: "free", label: "Freeflight", desc: "Kein Zeitlimit, Startzeit frei wählbar" },
];

export function modeLabel(mode: FlightMode | string): string {
  return MODES.find((m) => m.v === mode)?.label ?? mode;
}
