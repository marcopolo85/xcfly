export interface HudData {
  alt: number; agl: number; vz: number; speed: number;
  xc: number; xcSpeed: number; flightTime: number;
  tri: number; triFai: boolean; triMin: number; triMax: number; triClose: number;
  clock: string; accel: boolean;
}

function Cell({ label, value, unit, cls = "" }: { label: string; value: string; unit?: string; cls?: string }) {
  return (
    <div className={`min-w-0 ${cls}`}>
      <div className="hud-label truncate text-[8px] leading-none">{label}</div>
      <div className="hud-value truncate text-sm leading-tight">{value}{unit && <span className="hud-unit">{unit}</span>}</div>
    </div>
  );
}

const vzCls = (v: number) => (v > 0.1 ? "text-climb" : v < -1.5 ? "text-sink" : "");
const fmtVz = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
const fmtDur = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const fmtClose = (m: number) => (m >= 1000 ? { v: (m / 1000).toFixed(2), u: "km" } : { v: Math.round(m).toString(), u: "m" });

export function FlightHUD({ d }: { d: HudData }) {
  const close = fmtClose(d.triClose);
  return (
    <section aria-label="GPS Fluginstrument" className="pointer-events-none flex w-[150px] shrink-0 flex-col rounded-md border-2 border-border bg-card/95 px-2 py-1 backdrop-blur-md sm:w-[190px]">
      <header className="flex items-center justify-between border-b border-border font-mono text-[10px]">
        <span className="font-bold text-foreground">GPS{d.accel && <span className="ml-1 text-sun">SPEED</span>}</span>
        <span className="text-muted-foreground">{d.clock}</span>
      </header>
      <div className="grid flex-1 grid-cols-2 content-between gap-x-2">
        <Cell label="ALT" value={d.alt.toFixed(0)} unit="m" />
        <Cell label="AGL" value={d.agl.toFixed(0)} unit="m" />
        <Cell label="VARIO" value={fmtVz(d.vz)} unit="m/s" cls={vzCls(d.vz)} />
        <Cell label="GZ" value={d.vz < -0.1 ? `1:${(d.speed / -d.vz).toFixed(0)}` : "1:∞"} />
        <Cell label="GESCHW." value={(d.speed * 3.6).toFixed(0)} unit="km/h" />
        <Cell label="FLUGDAUER" value={fmtDur(d.flightTime)} />
        <Cell label="XC KM" value={(d.xc / 1000).toFixed(1)} unit="km" />
        <Cell label="XC GESCHW." value={d.xcSpeed.toFixed(1)} unit="km/h" />
      </div>
      <div className="grid grid-cols-3 gap-x-1 border-t border-border pt-0.5">
        <Cell label="TRIANGLE" value={d.tri > 0 ? (d.tri / 1000).toFixed(1) : "—"} unit={d.tri > 0 ? "km" : undefined}
          cls={d.tri > 0 ? (d.triFai ? "text-fai" : "text-climb") : ""} />
        <Cell label="MIN" value={d.triMin > 0 ? (d.triMin / 1000).toFixed(1) : "—"} unit={d.triMin > 0 ? "km" : undefined} />
        <Cell label="MAX" value={d.triMax > 0 ? (d.triMax / 1000).toFixed(1) : "—"} unit={d.triMax > 0 ? "km" : undefined} />
      </div>
      <div className="border-t border-border pt-0.5">
        <Cell label="CLOSE" value={close.v} unit={close.u} />
      </div>
    </section>
  );
}
