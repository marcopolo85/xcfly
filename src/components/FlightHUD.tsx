import { SunIndicator } from "./SunIndicator";

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
    <div className="hud-cell">
      <div className="hud-label">{label}</div>
      <div className={big ? "hud-value text-2xl" : "hud-value text-lg"}>
        {value}<span className="hud-unit">{unit}</span>
      </div>
    </div>
  );
}

export function FlightHUD({ d }: { d: HudData }) {
  const vzClass = d.vz > 0.1 ? "text-climb" : d.vz < -1.5 ? "text-sink" : "text-foreground";
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 p-2 sm:inset-x-auto sm:right-0 sm:w-[22rem]">
      <div className="hud-panel grid grid-cols-3 gap-1.5">
        <div className="hud-cell col-span-1">
          <div className="hud-label">Vario</div>
          <div className={`hud-value text-3xl ${vzClass}`}>
            {d.vz > 0 ? "+" : ""}{d.vz.toFixed(1)}<span className="hud-unit">m/s</span>
          </div>
        </div>
        <div className="col-span-2"><SunIndicator el={d.sunEl} az={d.sunAz} slopeIrr={d.slopeIrr} /></div>
        <Cell label="Höhe MSL" value={d.alt.toFixed(0)} unit="m" big />
        <Cell label="Über Grund" value={d.agl.toFixed(0)} unit="m" big />
        <Cell label="Gleitzahl" value={Number.isFinite(d.ld) ? d.ld.toFixed(1) : "∞"} big />
        <div className="hud-cell col-span-1 flex items-center gap-2">
          <svg viewBox="-20 -20 40 40" className="h-10 w-10 shrink-0">
            <circle r="18" className="fill-none stroke-border" />
            <g transform={`rotate(${(d.wpRel * 180) / Math.PI})`}>
              <path d="M0 -15 L7 8 L0 3 L-7 8 Z" className="fill-primary" />
            </g>
          </svg>
          <div>
            <div className="hud-label">{d.wpName}</div>
            <div className="hud-value text-base">{(d.wpDist / 1000).toFixed(1)}<span className="hud-unit">km</span></div>
          </div>
        </div>
        <Cell label="Uhrzeit" value={d.clock} />
        <Cell label="Flugzeit" value={fmtDur(d.flightTime)} />
        <Cell label="Strecke" value={(d.distance / 1000).toFixed(1)} unit="km" />
        <Cell label="XC" value={(d.xc / 1000).toFixed(1)} unit="km" />
        <Cell label="XC-Speed" value={d.xcSpeed.toFixed(1)} unit="km/h" />
        <div className="col-span-3 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
          <span>{d.taskType} · WP {Math.min(d.next + 1, 3)}/3</span>
          <span>Basis {d.cloudbase.toFixed(0)} m</span>
          {d.accel && <span className="rounded bg-primary px-1.5 font-bold text-primary-foreground">SPEED ×5</span>}
        </div>
      </div>
    </div>
  );
}
