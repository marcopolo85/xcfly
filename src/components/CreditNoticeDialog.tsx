import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

const KEY = "xcfly_notice_credit_limit_nov26";

export function CreditNoticeDialog() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) setOpen(true); } catch { /* ignore */ }
  }, []);
  const close = () => {
    try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>Information</DialogTitle></DialogHeader>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Aktuell eingeschränkter Flugbetrieb weil das monatliche Kontingent an Cloud-Credits aufgebraucht ist.</p>
          <p>Dies betrifft Livetracking der anderen Piloten, Ranglisten und Weekly-Task.</p>
          <p className="font-bold text-foreground">Der Flugmodus funktioniert weiterhin uneingeschränkt.</p>
          <p>Ab dem 21. November startet der neue Abrechnungszyklus, danach sollten alle Online-Funktionen wieder wie gewohnt laufen.</p>
          <p>Ich prüfe derzeit Optimierungen, um den Datenverbrauch effizienter zu gestalten, damit die Gratis-Credits künftig der Nachfrage genügen.</p>
          <p>Wer das Projekt unterstützen möchte, kann dies gerne via «Buy me a beer» tun. Alle Buy-me-a-beer-Einnahmen werden in die Weiterentwicklung des Spiels investiert.</p>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={close}>OK...Fliegen</Button>
          <Button asChild variant="ghost" size="sm" className="text-xs text-muted-foreground">
            <a href="https://buymeacoffee.com/marcopolo85" target="_blank" rel="noopener noreferrer">🍺 Buy me a beer</a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
