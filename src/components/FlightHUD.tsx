export interface HudData {
  alt: number; agl: number; vz: number; ld: number;
  wpName: string; wpDist: number; wpRel: number; // rel bearing rad
  flightTime: number; distance: number; xc: number; xcSpeed: number;
  clock: string; accel: boolean; cloudbase: number;
  sunEl: number; sunAz: number; slopeIrr: number; taskType: string; next: number;
}

const fmtDur = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

function Cell({ label, value, unit, big }: { label: string; value: string; unit?: string; big?: boolean }) {
  return (
    <div className="min-w-0 border-b border-border/40 py-1">
      <div className="hud-label">{label}</div>
      <div className={big ? "hud-value text-base" : "hud-value text-xs"}>
        {value}<span className="hud-unit">{unit}</span>
      </div>
    </div>
  );
}

export function FlightHUD({ d }: { d: HudData }) {
  const vzClass = d.vz > 0.1 ? "text-climb" : d.vz < -1.5 ? "text-sink" : "text-foreground";
  return (
    <section aria-label="GPS Fluginstrument" className="pointer-events-none w-[176px] shrink-0 rounded-md border-2 border-border bg-card/95 p-2 backdrop-blur-md sm:w-[216px]">
      <header className="mb-1 flex items-center justify-between border-b border-border pb-1 font-mono text-[10px]"><span className="font-bold text-foreground">GPS · XC</span><span className="text-muted-foreground">{d.clock}</span></header>
      <div className="grid grid-cols-3 gap-x-1.5">
        <div className="col-span-1 py-1">
          <div className="hud-label">Vario</div>
          <div className={`hud-value text-lg ${vzClass}`}>
            {d.vz > 0 ? "+" : ""}{d.vz.toFixed(1)}<span className="hud-unit">m/s</span>
          </div>
        </div>
        <div className="col-span-2 flex items-center justify-end gap-1">
          <svg viewBox="-20 -20 40 40" className="h-7 w-7 shrink-0" aria-label="Richtung zum Wegpunkt">
            <circle r="18" className="fill-none stroke-border" />
            <g transform={`rotate(${(d.wpRel * 180) / Math.PI})`}><path d="M0 -15 L7 8 L0 3 L-7 8 Z" className="fill-primary" /></g>
          </svg>
          <div className="min-w-0"><div className="hud-label truncate">{d.wpName}</div><div className="hud-value text-xs">{(d.wpDist / 1000).toFixed(1)}<span className="hud-unit">km</span></div></div>
        </div>
        <Cell label="Höhe MSL" value={d.alt.toFixed(0)} unit="m" big />
        <Cell label="Über Grund" value={d.agl.toFixed(0)} unit="m" big />
        <Cell label="Gleitzahl" value={Number.isFinite(d.ld) ? d.ld.toFixed(1) : "∞"} big />
        <Cell label="Flugzeit" value={fmtDur(d.flightTime)} />
        <Cell label="Strecke" value={(d.distance / 1000).toFixed(1)} unit="km" />
        <Cell label="XC" value={(d.xc / 1000).toFixed(1)} unit="km" />
        <Cell label="XC-Speed" value={d.xcSpeed.toFixed(1)} unit="km/h" />
        <Cell label="Sonne" value={`${Math.round(d.sunEl * 180 / Math.PI)}°`} />
        <Cell label="Basis" value={d.cloudbase.toFixed(0)} unit="m" />
        <div className="col-span-3 mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
          <span>{d.taskType} · WP {Math.min(d.next + 1, 3)}/3</span>
          {d.accel && <span className="font-bold text-sun">×5</span>}
        </div>
      </div>
    </section>
  );
}
