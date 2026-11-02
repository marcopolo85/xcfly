import type { RouteType } from "@/game/xcScore";

export const ROUTE_LABEL: Record<RouteType, string> = { free: "Freie Strecke", tri: "Flaches Dreieck", fai: "FAI-Dreieck" };

/**
 * Streckensymbole im Stil der App-Icons: abgerundetes farbiges Badge mit weissem Glyph.
 * Blau = FAI-Dreieck, grün = flaches Dreieck, orange = freie Strecke.
 */
function Badge({ id, color, light, label, children }: { id: string; color: string; light: string; label: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label={label}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={color} />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="22" height="22" rx="5.5" fill={`url(#${id})`} />
      {children}
    </svg>
  );
}

export function RouteIcon({ type, className = "h-4 w-4" }: { type: RouteType; className?: string }) {
  if (type === "free") {
    return (
      <Badge id="route-free-g" color="var(--color-route-free)" light="var(--color-route-free-light)" label={ROUTE_LABEL.free}>
        <path d="M5 10.5 L9.5 17 L14 7 L19 14" fill="none" stroke="var(--route-glyph)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="5" cy="10.5" r="3" fill="var(--route-glyph)" /><circle cx="5" cy="10.5" r="1.3" fill="var(--route-node-dot)" />
        <circle cx="9.5" cy="17" r="2.5" fill="var(--route-glyph)" />
        <circle cx="14" cy="7" r="2.5" fill="var(--route-glyph)" />
        <circle cx="19" cy="14" r="3" fill="var(--route-glyph)" /><circle cx="19" cy="14" r="1.3" fill="var(--route-node-dot)" />
      </Badge>
    );
  }
  if (type === "tri") {
    return (
      <Badge id="route-tri-g" color="var(--color-route-tri)" light="var(--color-route-tri-light)" label={ROUTE_LABEL.tri}>
        <path d="M5.5 14.5 L16 6 L17.5 18 Z" fill="none" stroke="var(--route-glyph)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="5.5" cy="14.5" r="3" fill="var(--route-glyph)" />
        <circle cx="16" cy="6" r="3" fill="var(--route-glyph)" />
        <circle cx="17.5" cy="18" r="3" fill="var(--route-glyph)" /><circle cx="17.5" cy="18" r="1.3" fill="var(--route-node-dot)" />
      </Badge>
    );
  }
  return (
    <Badge id="route-fai-g" color="var(--color-route-fai)" light="var(--color-route-fai-light)" label={ROUTE_LABEL.fai}>
      <path d="M12 5.5 L18.5 17.5 L5.5 17.5 Z" fill="none" stroke="var(--route-glyph)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="5.5" r="3" fill="var(--route-glyph)" />
      <circle cx="5.5" cy="17.5" r="3" fill="var(--route-glyph)" />
      <circle cx="18.5" cy="17.5" r="3" fill="var(--route-glyph)" /><circle cx="18.5" cy="17.5" r="1.3" fill="var(--route-node-dot)" />
    </Badge>
  );
}
