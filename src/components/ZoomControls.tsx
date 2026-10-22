import { Minus, Plus, LocateFixed } from "lucide-react";
import { Button } from "./ui/button";

export function ZoomControls({ label, scale, change, reset }: { label: string; scale: number; change: (factor: number) => void; reset: () => void }) {
  return <div className="flex shrink-0 items-center gap-0.5">
    <Button variant="ghost" size="icon" className="h-7 w-7" title={`${label} verkleinern`} aria-label={`${label} verkleinern`} onClick={() => change(1 / 1.3)}><Minus /></Button>
    <span className="w-10 text-center font-mono text-[10px] tabular-nums text-muted-foreground">{Math.round(scale * 100)}%</span>
    <Button variant="ghost" size="icon" className="h-7 w-7" title={`${label} vergrößern`} aria-label={`${label} vergrößern`} onClick={() => change(1.3)}><Plus /></Button>
    <Button variant="ghost" size="icon" className="h-7 w-7" title={`${label} zentrieren`} aria-label={`${label} zentrieren`} onClick={reset}><LocateFixed /></Button>
  </div>;
}