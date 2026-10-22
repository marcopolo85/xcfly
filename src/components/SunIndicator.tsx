interface Props { el: number; az: number; slopeIrr: number }

export function SunIndicator({ el, az, slopeIrr }: Props) {
  // arc from east (left, az 90°) through south to west (right, az 270°)
  const t = Math.max(0, Math.min(1, (az - Math.PI / 2) / Math.PI));
  const cx = 8 + t * 84;
  const elev = Math.max(-0.1, el);
  const cy = 50 - Math.sin(Math.min(Math.PI / 2, elev)) * 44;
  const up = el > 0;
  return (
    <div className="hud-cell flex items-center gap-2">
      <svg viewBox="0 0 100 60" className="h-12 w-20 shrink-0" aria-label="Sonnenstand">
        <path d="M8 50 Q50 -30 92 50" className="fill-none stroke-muted-foreground/40" strokeDasharray="2 3" />
        <path d="M0 52 L28 30 L44 40 L62 18 L100 52 Z" className="fill-secondary" />
        {up && <line x1={cx} y1={cy} x2={62} y2={24} className="stroke-sun" strokeWidth="1" strokeDasharray="2 2" />}
        <circle cx={cx} cy={cy} r={5} className={up ? "fill-sun" : "fill-muted-foreground/40"} />
        <line x1="0" y1="52" x2="100" y2="52" className="stroke-border" />
      </svg>
      <div className="leading-tight">
        <div className="hud-label">Sonne</div>
        <div className="hud-value text-sm">{(el * 57.3).toFixed(0)}° · {(az * 57.3).toFixed(0)}°</div>
        <div className="hud-label">Hang {Math.round(slopeIrr * 100)}%</div>
      </div>
    </div>
  );
}
