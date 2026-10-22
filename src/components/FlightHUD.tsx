export interface HudData {
  alt: number; agl: number; vz: number; speed: number;
  xc: number; xcSpeed: number;
  clock: string; accel: boolean; cloudbase: number;
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
    <section aria-label="GPS Fluginstrument" className="pointer-events-none flex w-[150px] shrink-0 flex-col rounded-md border-2 border-border bg-card/95 px-2 py-1 backdrop-blur-md sm:w-[190px]">
      <header className="flex items-center justify-between border-b border-border font-mono text-[10px]">
        <span className="font-bold text-foreground">GPS{d.accel && <span className="ml-1 text-sun">SPEED</span>}</span>
        <span className="text-muted-foreground">{d.clock}</span>
      </header>
      <div className="grid flex-1 grid-cols-2 content-between gap-x-2">
        <Cell label="Höhe" value={d.alt.toFixed(0)} unit="m" />
        <Cell label="Über Grund" value={d.agl.toFixed(0)} unit="m" />
        <Cell label="Vario 1s" value={fmtVz(d.vz)} unit="m/s" cls={vzCls(d.vz)} />
        <Cell label="Gleitzahl" value={d.vz < -0.1 ? `1:${(d.speed / -d.vz).toFixed(0)}` : "1:∞"} />
        <Cell label="Speed" value={(d.speed * 3.6).toFixed(0)} unit="km/h" />
        <Cell label="XC-Speed" value={d.xcSpeed.toFixed(1)} unit="km/h" />
        <Cell label="XC" value={(d.xc / 1000).toFixed(1)} unit="km" />
        <Cell label="Basis" value={d.cloudbase.toFixed(0)} unit="m" />
      </div>
    </section>
  );
}

