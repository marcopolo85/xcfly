import type { ReactNode } from "react";
import { Settings2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";
import { MAP_STYLES, setMapStyle, type MapStyle } from "./SwissRelief";
import { useEffect, useState } from "react";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

export function FlightSettings({ thermalOpacity, onThermalOpacity, showProfile, onShowProfile, showAirspaces, onShowAirspaces, showAirspaceLabels, onShowAirspaceLabels, open, onOpenChange }: {
  thermalOpacity: number;
  onThermalOpacity: (v: number) => void;
  showProfile: boolean;
  onShowProfile: (v: boolean) => void;
  showAirspaces: boolean;
  onShowAirspaces: (v: boolean) => void;
  showAirspaceLabels: boolean;
  onShowAirspaceLabels: (v: boolean) => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [mapStyle, setStyle] = useState<MapStyle>("relief");
  useEffect(() => { const s = localStorage.getItem("mapStyle") as MapStyle | null; if (s) setStyle(s); }, []);
  useEffect(() => { setMapStyle(mapStyle); localStorage.setItem("mapStyle", mapStyle); }, [mapStyle]);
  return (
    <>
      <button
        type="button"
        title="Einstellungen"
        aria-label="Einstellungen"
        onClick={() => onOpenChange(!open)}
        className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-md border border-border bg-card/95 text-foreground backdrop-blur-md active:bg-accent"
      >
        <Settings2 className="h-4 w-4" />
      </button>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-[min(340px,100vw)] flex-col p-0">
          <SheetHeader className="shrink-0 border-b px-5 pb-2 pt-5">
            <SheetTitle className="font-mono text-sm">Einstellungen</SheetTitle>
          </SheetHeader>
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4 font-mono text-foreground">
            <Section title="Karte">
              <div className="grid grid-cols-2 gap-1.5">
                {MAP_STYLES.map((m) => (
                  <button key={m.v} type="button" onClick={() => setStyle(m.v)}
                    className={`rounded-md border px-2 py-1.5 text-[11px] ${mapStyle === m.v ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </Section>
            <Section title="Thermikkarte">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Transparenz</span>
                <span>{Math.round(thermalOpacity * 100)} %</span>
              </div>
              <Slider
                value={[thermalOpacity]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={(v) => onThermalOpacity(v[0])}
                aria-label="Thermikkarte-Transparenz"
              />
              <p className="text-[10px] leading-snug text-muted-foreground">Bei 0 % ist die Thermikkarte ausgeblendet.</p>
            </Section>
            <Section title="Anzeige">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Seitenprofil</span>
                <Switch checked={showProfile} onCheckedChange={onShowProfile} aria-label="Seitenprofil anzeigen" />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Lufträume</span>
                <Switch checked={showAirspaces} onCheckedChange={onShowAirspaces} aria-label="Lufträume anzeigen" />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Luftraum-Beschriftung</span>
                <Switch checked={showAirspaceLabels} onCheckedChange={onShowAirspaceLabels} aria-label="Luftraum-Beschriftung anzeigen" />
              </div>
            </Section>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
