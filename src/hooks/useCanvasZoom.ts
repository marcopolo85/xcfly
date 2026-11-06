import { useEffect, useRef, useState } from "react";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";

const ANIM_MS = 350;

/** D3 owns wheel normalization, cursor anchoring, drag and two-finger pinch. */
export function useCanvasZoom(min = 0.3, max = 8, active = true) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transform = useRef<ZoomTransform>(zoomIdentity);
  const behavior = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const anim = useRef(0);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const control = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([min, max])
      .extent(() => [[0, 0], [canvas.clientWidth, canvas.clientHeight]])
      .on("zoom", (event: { transform: ZoomTransform; sourceEvent?: unknown }) => {
        if (event.sourceEvent) cancelAnimationFrame(anim.current);
        transform.current = event.transform;
        setScale(event.transform.k);
      });
    behavior.current = control;
    const selection = select<HTMLCanvasElement, unknown>(canvas);
    selection.call(control).on("dblclick.zoom", null);
    return () => { cancelAnimationFrame(anim.current); selection.on(".zoom", null); behavior.current = null; };
  }, [min, max, active]);

  /** Smoothly animate to an absolute scale around the canvas centre (log-interpolated). */
  const animateTo = (target: number) => {
    const canvas = canvasRef.current, control = behavior.current;
    if (!canvas || !control) return;
    cancelAnimationFrame(anim.current);
    const from = transform.current.k, to = Math.min(max, Math.max(min, target));
    if (Math.abs(to - from) < 1e-4) return;
    const t0 = performance.now(), lf = Math.log(from), lt = Math.log(to);
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ANIM_MS), e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      if (behavior.current) select<HTMLCanvasElement, unknown>(canvas).call(behavior.current.scaleTo, Math.exp(lf + (lt - lf) * e));
      if (p < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  };
  const change = (factor: number) => animateTo(transform.current.k * factor);
  /** Immediate centred scaling for continuous rate controls, without queued transitions. */
  const scaleBy = (factor: number) => {
    const canvas = canvasRef.current, control = behavior.current;
    if (!canvas || !control) return;
    cancelAnimationFrame(anim.current);
    const target = Math.min(max, Math.max(min, transform.current.k * factor));
    if (target !== transform.current.k) select<HTMLCanvasElement, unknown>(canvas).call(control.scaleTo, target);
  };
  const reset = () => {
    const canvas = canvasRef.current, control = behavior.current;
    cancelAnimationFrame(anim.current);
    if (canvas && control) select<HTMLCanvasElement, unknown>(canvas).call(control.transform, zoomIdentity);
  };
  const zoomTo = animateTo;
  return { canvasRef, transform, scale, change, scaleBy, reset, zoomTo };
}
