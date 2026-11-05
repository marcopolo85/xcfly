import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { CHANGELOG } from "@/game/changelog";

export function ChangelogDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80dvh] w-[calc(100%-2rem)] flex-col overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 border-b border-border px-5 pb-3 pt-4 text-left">
          <DialogTitle className="text-lg">Changelog</DialogTitle>
          <DialogDescription>Was ist neu in XCFly?</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4 text-sm">
          {CHANGELOG.map((entry) => (
            <section key={entry.id}>
              <h3 className="hud-label mb-1">{entry.date}</h3>
              <ul className="list-disc space-y-0.5 pl-5">
                {entry.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
