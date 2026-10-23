import type { ReactNode } from "react";
import { Settings2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

export function FlightSettings({ thermalOpacity, onThermalOpacity, showProfile, onShowProfile, open, onOpenChange }: {
  thermalOpacity: number;
  onThermalOpacity: (v: number) => void;
  showProfile: boolean;
  onShowProfile: (v: boolean) => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
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
            </Section>
            <Section title="Copyright & Quellen">
              <div className="space-y-2 text-[11px] leading-snug">
                <div>
                  <span className="text-muted-foreground">Karte: </span>
                  <a href="https://www.swisstopo.admin.ch/de/nutzungsbedingungen" target="_blank" rel="noopener noreferrer" className="underline">© swisstopo · Relief</a>
                </div>
                <div>
                  <span className="text-muted-foreground">Thermik: </span>
                  <a href="https://thermal.kk7.ch/" target="_blank" rel="noopener noreferrer" className="underline">M. von Känel · KK7 · Juli / All day</a>
                </div>
                <div>
                  <span className="text-muted-foreground">Lizenz: </span>
                  <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer" className="underline">CC BY-NC-SA 4.0 · bearbeitet</a>
                </div>
              </div>
            </Section>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
