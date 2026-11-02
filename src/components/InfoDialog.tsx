import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import logoImg from "@/assets/xcfly-logo.png";

export function InfoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto font-mono sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-base">
            <img src={logoImg} alt="XCFly Logo" className="h-10 w-auto" />
            XCFly
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 text-xs leading-snug text-foreground">
          <section className="space-y-1.5">
            <h3 className="hud-label">Copyright & Quellen</h3>
            <div>
              <span className="text-muted-foreground">Karte: </span>
              <a href="https://www.swisstopo.admin.ch/de/nutzungsbedingungen" target="_blank" rel="noopener noreferrer" className="underline">© swisstopo</a>
            </div>
            <div>
              <span className="text-muted-foreground">Thermik: </span>
              <a href="https://thermal.kk7.ch/" target="_blank" rel="noopener noreferrer" className="underline">M. von Känel · KK7 · Juli / All day</a>
            </div>
            <div>
              <span className="text-muted-foreground">Lufträume: </span>
              <a href="https://www.bazl.admin.ch/" target="_blank" rel="noopener noreferrer" className="underline">© BAZL · geo.admin.ch</a> (nicht für Navigation)
            </div>
            <div>
              <span className="text-muted-foreground">Lizenz: </span>
              <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer" className="underline">CC BY-NC-SA 4.0 · bearbeitet</a>
            </div>
          </section>
          <section className="space-y-1">
            <div>Erstellt durch Marco Bürgisser</div>
            <div className="text-muted-foreground">Kontakt: <a href="mailto:xcfly@gmx.ch" className="underline">xcfly@gmx.ch</a></div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
