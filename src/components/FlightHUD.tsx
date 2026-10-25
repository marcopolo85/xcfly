export interface HudData {
  alt: number; agl: number; vz: number; speed: number;
  time: number;
  xc: number; xcSpeed: number;
  tri: number; triFai: boolean; triMin: number; triMax: number; close: number;
  clock: string; accel: boolean; cloudbase: number;
  remain?: number; outDist?: number; returnRadius?: number;
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
      <div className="flex flex-1 gap-1.5 pt-0.5">
      <div className="relative w-3 shrink-0 border-r border-border" role="meter" aria-label="Höhe über Grund" aria-valuemin={0} aria-valuemax={Math.max(1500, Math.ceil(d.agl / 500) * 500)} aria-valuenow={Math.max(0, d.agl)} aria-valuetext={`${Math.round(d.agl)} Meter über Grund`}>
        <span className="absolute inset-x-0 top-0 text-[7px] font-mono text-muted-foreground">AGL</span>
        <div className="absolute bottom-2 left-0 top-4 w-1.5 overflow-hidden rounded-sm bg-muted">
          <div className="absolute inset-x-0 bottom-0 bg-climb transition-[height] duration-100 ease-linear motion-reduce:transition-none" style={{ height: `${Math.max(0, Math.min(100, d.agl / Math.max(1500, Math.ceil(d.agl / 500) * 500) * 100))}%` }} />
          <span className="absolute inset-x-0 top-1/3 border-t border-card/70" />
          <span className="absolute inset-x-0 top-2/3 border-t border-card/70" />
        </div>
        <span className="absolute bottom-0 left-0 text-[7px] font-mono text-muted-foreground">0</span>
      </div>
      <div className="grid min-w-0 flex-1 grid-cols-2 content-between gap-x-2 gap-y-0.5">
        <Cell label="ALT" value={d.alt.toFixed(0)} unit="m" />
        <Cell label="AGL" value={d.agl.toFixed(0)} unit="m" />
        <Cell label="VARIO" value={fmtVz(d.vz)} unit="m/s" cls={vzCls(d.vz)} />
        <Cell label="GZ" value={d.vz < -0.1 ? `1:${(d.speed / -d.vz).toFixed(0)}` : "1:∞"} />
        <Cell label="GESCHW." value={(d.speed * 3.6).toFixed(0)} unit="km/h" />
        <Cell label="FLUGDAUER" value={fmtTime(d.time)} />
        <Cell label="XC KM" value={(d.xc / 1000).toFixed(1)} unit="km" />
        <Cell label="XC GESCHW." value={d.xcSpeed.toFixed(1)} unit="km/h" />
        <div className="col-span-2 grid grid-cols-3 gap-x-1.5 [&_.hud-label]:text-[8px] [&_.hud-label]:tracking-tight">
          <Cell label="TRIANGLE" value={(d.tri / 1000).toFixed(1)} unit="km" cls={d.tri > 0 ? (d.triFai ? "text-fai" : "text-climb") : ""} />
          <Cell label="MIN FAI" value={d.triMin > 0 && isFinite(d.triMin) ? (d.triMin / 1000).toFixed(1) : "–"} unit={d.triMin > 0 && isFinite(d.triMin) ? "km" : ""} />
          <Cell label="MAX FAI" value={d.triMax > 0 && isFinite(d.triMax) ? (d.triMax / 1000).toFixed(1) : "–"} unit={d.triMax > 0 && isFinite(d.triMax) ? "km" : ""} />
        </div>
        <Cell label="CLOSE" value={d.close > 0 ? (d.close / 1000).toFixed(1) : "0.0"} unit="km" cls={d.close > 0 ? "text-sun" : "text-climb"} />
        <Cell label="WOLKENBASIS" value={d.cloudbase.toFixed(0)} unit="m" />
        {d.remain !== undefined && <Cell label="RESTZEIT" value={fmtTime(d.remain)} cls={d.remain < 600 ? "text-sink" : ""} />}
        {d.returnRadius !== undefined && <Cell label="START" value={((d.outDist ?? 0) / 1000).toFixed(1)} unit="km" cls={(d.outDist ?? 0) <= d.returnRadius ? "text-climb" : ""} />}
      </div>
      </div>
    </section>
  );
}
