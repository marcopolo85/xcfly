export type FlightMode = "out_return" | "one_way" | "free";

export const MODE_TIME_LIMIT_S = 4 * 3600;
export const RETURN_RADIUS_M = 400;

export const MODES: { v: FlightMode; label: string; desc: string }[] = [
  { v: "out_return", label: "Out & Return", desc: "Flieg möglichst weit weg und schaffe es wieder zurück an den Startplatz in 4 h" },
  { v: "one_way", label: "One-Way", desc: "Flieg möglichst weit weg in 4 h" },
  { v: "free", label: "Freeflight", desc: "Kein Zeitlimit, Startzeit frei wählbar" },
];

export function modeLabel(mode: FlightMode): string {
  return MODES.find((m) => m.v === mode)?.label ?? mode;
}

/**
 * Ranglisten-Strecke in Metern.
 * out_return zählt die grösste Entfernung vom Start nur bei Rückkehr in den 400-m-Radius.
 * one_way zählt die Entfernung vom Start am Flugende, free die optimierte freie Strecke.
 */
export function modeScore(mode: FlightMode, maxOutDist: number, endOutDist: number, xcDist: number): { score: number; goal: boolean } {
  if (mode === "out_return") {
    const goal = endOutDist <= RETURN_RADIUS_M;
    return { score: goal ? maxOutDist : 0, goal };
  }
  if (mode === "one_way") return { score: endOutDist, goal: true };
  return { score: xcDist, goal: true };
}
