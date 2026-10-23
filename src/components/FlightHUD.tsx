export interface HudData {
  alt: number; agl: number; vz: number; speed: number;
  time: number;
  xc: number; xcSpeed: number;
  tri: number; triFai: boolean; triMin: number; triMax: number; close: number;
  clock: string; accel: boolean; cloudbase: number;
}

function Cell({ label, value, unit, cls = "" }: { label: string; value: string; unit?: string; cls?: string }) {
  return (
    <div className="min-w-0">
      <div className="hud-label truncate text-[9px] leading-none">{label}</div>
      <div className={`hud-value py-0.5 text-sm leading-tight ${cls}`}>{value}<span className="hud-unit">{unit}</span></div>
    </div>
  );
}

const vzCls = (v: number) => (v > 0.1 ? "text-climb" : v < -1.5 ? "text-sink" : "");
const fmtVz = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`;
const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export function FlightHUD({ d }: { d: HudData }) {
  return (
    <section aria-label="GPS Fluginstrument" className="pointer-events-none flex w-[150px] shrink-0 flex-col rounded-md border-2 border-border bg-card/95 px-2 py-1 backdrop-blur-md sm:w-[190px]">
      <header className="flex items-center justify-between border-b border-border font-mono text-[10px]">
        <span className="font-bold text-foreground">GPS{d.accel && <span className="ml-1 text-sun">SPEED</span>}</span>
        <span className="text-muted-foreground">{d.clock}</span>
      </header>
      <div className="grid flex-1 grid-cols-2 content-between gap-x-2 gap-y-0.5 pt-0.5">
        <Cell label="ALT" value={d.alt.toFixed(0)} unit="m" />
        <Cell label="AGL" value={d.agl.toFixed(0)} unit="m" />
        <Cell label="VARIO" value={fmtVz(d.vz)} unit="m/s" cls={vzCls(d.vz)} />
        <Cell label="GZ" value={d.vz < -0.1 ? `1:${(d.speed / -d.vz).toFixed(0)}` : "1:∞"} />
        <Cell label="GESCHW." value={(d.speed * 3.6).toFixed(0)} unit="km/h" />
        <Cell label="FLUGDAUER" value={fmtTime(d.time)} />
        <Cell label="XC KM" value={(d.xc / 1000).toFixed(1)} unit="km" />
        <Cell label="XC GESCHW." value={d.xcSpeed.toFixed(1)} unit="km/h" />
        <div className="col-span-2 grid grid-cols-3 gap-x-1.5">
          <Cell label="TRIANGLE" value={(d.tri / 1000).toFixed(1)} unit="km" cls={d.tri > 0 ? (d.triFai ? "text-fai" : "text-climb") : ""} />
          <Cell label="MIN FAI" value={d.triMin > 0 && isFinite(d.triMin) ? (d.triMin / 1000).toFixed(1) : "–"} unit={d.triMin > 0 && isFinite(d.triMin) ? "km" : ""} />
          <Cell label="MAX FAI" value={d.triMax > 0 && isFinite(d.triMax) ? (d.triMax / 1000).toFixed(1) : "–"} unit={d.triMax > 0 && isFinite(d.triMax) ? "km" : ""} />
        </div>
        <Cell label="CLOSE" value={d.close > 0 ? (d.close / 1000).toFixed(1) : "0.0"} unit="km" cls={d.close > 0 ? "text-sun" : "text-climb"} />
        <Cell label="WOLKENBASIS" value={d.cloudbase.toFixed(0)} unit="m" />
      </div>
    </section>
  );
}
