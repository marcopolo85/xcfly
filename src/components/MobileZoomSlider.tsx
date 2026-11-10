import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Slider } from "./ui/slider";
import { zoomRateFactor } from "@/hooks/zoomRate";

export function MobileZoomSlider({ scaleBy, scale, active }: { scaleBy: (factor: number) => void; scale: number; active: boolean }) {
  const [value, setValue] = useState(0);
  const displacement = useRef(0);
  const apply = useRef(scaleBy);
  apply.current = scaleBy;
  const reset = () => { displacement.current = 0; setValue(0); };
  useEffect(() => {
    if (!active) { displacement.current = 0; setValue(0); return; }
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (displacement.current !== 0) apply.current(zoomRateFactor(displacement.current, dt));
      raf = requestAnimationFrame(tick);
    };
    const stop = () => { displacement.current = 0; setValue(0); };
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); displacement.current = 0; window.removeEventListener("blur", stop); document.removeEventListener("visibilitychange", stop); };
  }, [active]);

  return <div className="flex w-10 shrink-0 flex-col items-center gap-2 rounded-md border border-border bg-card/95 py-2 text-foreground backdrop-blur-md sm:not-pointer-coarse:hidden">
    <Minus aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    <div className="relative flex min-h-24 w-full flex-1 justify-center">
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-2 top-1/2 border-t border-muted-foreground" />
      <Slider orientation="vertical" value={[value]} min={-1} max={1} step={0.01} disabled={!active}
        aria-label="Kartenzoom" aria-valuetext={value === 0 ? "Neutral" : value < 0 ? "Hineinzoomen" : "Herauszoomen"}
        className="w-full px-3 [&_span[role=slider]]:h-6 [&_span[role=slider]]:w-6"
        onValueChange={([v]) => { setValue(v); displacement.current = -v; }}
        onValueCommit={reset} onPointerUp={reset} onPointerCancel={reset} onLostPointerCapture={reset} onBlur={reset} onKeyUp={reset} />
    </div>
    <Plus aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    <span className="w-full text-center font-mono text-[8px] tabular-nums text-muted-foreground">{Math.round(scale * 100)}%</span>
  </div>;
}