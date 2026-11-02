import type { RouteType } from "@/game/xcScore";

export const ROUTE_LABEL: Record<RouteType, string> = { free: "Freie Strecke", tri: "Flaches Dreieck", fai: "FAI-Dreieck" };

/** XContest-Streckensymbole: grünes Dreieck, blaues FAI-Dreieck, oranges Freie-Strecke-Symbol. */
export function RouteIcon({ type, className = "h-4 w-4" }: { type: RouteType; className?: string }) {
  if (type === "free") {
    return (
      <svg viewBox="0 0 24 24" className={className} role="img" aria-label={ROUTE_LABEL.free}>
        <rect x="1" y="1" width="22" height="22" rx="5" className="fill-route-free" />
        <path d="M4 14 L9 8 L14 15 L20 9" fill="none" className="stroke-background" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="4" cy="14" r="1.8" className="fill-background" /><circle cx="20" cy="9" r="1.8" className="fill-background" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label={ROUTE_LABEL[type]}>
      <path d="M12 2 L22.5 21 L1.5 21 Z" className={type === "fai" ? "fill-route-fai" : "fill-route-tri"} strokeLinejoin="round" />
    </svg>
  );
}
