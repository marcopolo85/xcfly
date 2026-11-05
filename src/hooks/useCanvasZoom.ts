import { useEffect, useRef, useState } from "react";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";

/** D3 owns wheel normalization, cursor anchoring, drag and two-finger pinch. */
export function useCanvasZoom(min = 0.3, max = 8, active = true) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transform = useRef<ZoomTransform>(zoomIdentity);
  const behavior = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const control = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([min, max])
      .extent(() => [[0, 0], [canvas.clientWidth, canvas.clientHeight]])
      .on("zoom", (event: { transform: ZoomTransform }) => {
        transform.current = event.transform;
        setScale(event.transform.k);
      });
    behavior.current = control;
    const selection = select<HTMLCanvasElement, unknown>(canvas);
    selection.call(control).on("dblclick.zoom", null);
    return () => { selection.on(".zoom", null); behavior.current = null; };
  }, [min, max, active]);
  const change = (factor: number) => {
    const canvas = canvasRef.current, control = behavior.current;
    if (canvas && control) select<HTMLCanvasElement, unknown>(canvas).call(control.scaleBy, factor);
  };
  const reset = () => {
    const canvas = canvasRef.current, control = behavior.current;
    if (canvas && control) select<HTMLCanvasElement, unknown>(canvas).call(control.transform, zoomIdentity);
  };
  /** Zoom to an absolute scale around the canvas centre. */
  const zoomTo = (k: number) => {
    const canvas = canvasRef.current, control = behavior.current;
    if (canvas && control) select<HTMLCanvasElement, unknown>(canvas).call(control.scaleTo, k);
  };
  return { canvasRef, transform, scale, change, reset, zoomTo };
}