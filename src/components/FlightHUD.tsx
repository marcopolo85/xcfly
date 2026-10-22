export interface HudData {
  alt: number; agl: number; vz: number; vz10: number; speed: number;
  wpName: string; wpDist: number; wpRel: number; // rel bearing rad
  xc: number; xcSpeed: number;
  clock: string; accel: boolean; cloudbase: number;
  taskType: string; next: number;
}

function Cell({ label, value, unit, cls = "" }: { label: string; value: string; unit?: string; cls?: string }) {
  return (
    <div className="min-w-0 py-0.5">
      <div className="hud-label">{label}</div>
      <div className={`hud-value text-sm ${cls}`}>{value}<span className="hud-unit">{unit}</span></div>
    </div>
  );
}

const vzCls = (v: number) => (v > 0.1 ? "text-climb" : v < -1.5 ? "text-sink" : "");
const fmtVz = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`;

export function FlightHUD({ d }: { d: HudData }) {
  return (
    <section aria-label="GPS Fluginstrument" className="pointer-events-none w-[150px] shrink-0 self-end rounded-md border-2 border-border bg-card/95 px-2 py-1 backdrop-blur-md sm:w-[190px]">
      <header className="flex items-center justify-between border-b border-border font-mono text-[10px]">
        <span className="font-bold text-foreground">GPS{d.accel && <span className="ml-1 text-sun">SPEED</span>}</span>
        <span className="text-muted-foreground">{d.clock}</span>
      </header>
      <div className="grid grid-cols-2 gap-x-2">
        <Cell label="Höhe" value={d.alt.toFixed(0)} unit="m" />
        <Cell label="Über Grund" value={d.agl.toFixed(0)} unit="m" />
        <Cell label="Vario 1s" value={fmtVz(d.vz)} unit="m/s" cls={vzCls(d.vz)} />
        <Cell label="Vario 10s" value={fmtVz(d.vz10)} unit="m/s" cls={vzCls(d.vz10)} />
        <Cell label="Speed" value={(d.speed * 3.6).toFixed(0)} unit="km/h" />
        <Cell label="XC-Speed" value={d.xcSpeed.toFixed(1)} unit="km/h" />
        <Cell label="XC" value={(d.xc / 1000).toFixed(1)} unit="km" />
        <Cell label="Basis" value={d.cloudbase.toFixed(0)} unit="m" />
      </div>
    </section>
  );
}

export function WaypointCompass({ d }: { d: HudData }) {
  return (
    <section aria-label="Kompass zum Wegpunkt" className="pointer-events-none absolute right-2 top-2 flex items-center gap-1.5 rounded-md border border-border bg-card/95 p-1.5 font-mono backdrop-blur-md">
      <svg viewBox="-20 -20 40 40" className="h-9 w-9 shrink-0">
        <circle r="18" className="fill-none stroke-border" />
        <g transform={`rotate(${(d.wpRel * 180) / Math.PI})`}><path d="M0 -15 L7 8 L0 3 L-7 8 Z" className="fill-primary" /></g>
      </svg>
      <div>
        <div className="hud-label">{d.wpName} · {Math.min(d.next + 1, 3)}/3</div>
        <div className="hud-value text-sm">{(d.wpDist / 1000).toFixed(1)}<span className="hud-unit">km</span></div>
      </div>
    </section>
  );
}
