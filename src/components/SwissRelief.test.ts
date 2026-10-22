import { afterEach, expect, it, vi } from "vitest";
import { drawSwissRelief } from "./SwissRelief";
import { SITES } from "@/game/sites";

afterEach(() => vi.unstubAllGlobals());

it("filters each relief tile once and reuses the processed surface on subsequent frames", () => {
  const images: { onload?: () => void }[] = [];
  const appliedFilters: string[] = [];
  const surfaces: { filter: string; drawImage: ReturnType<typeof vi.fn>; fillRect: ReturnType<typeof vi.fn> }[] = [];
  vi.stubGlobal("Image", class {
    naturalWidth = 256;
    naturalHeight = 256;
    onload?: () => void;
    constructor() { images.push(this); }
  });
  vi.stubGlobal("document", {
    createElement: () => {
      const context = { filter: "none", drawImage: vi.fn(), fillRect: vi.fn() };
      context.drawImage.mockImplementation(() => appliedFilters.push(context.filter));
      surfaces.push(context);
      return { getContext: () => context };
    },
  });
  vi.stubGlobal("getComputedStyle", () => ({
    getPropertyValue: (key: string) => key === "--map-relief-filter" ? "contrast(1.45) brightness(0.88)" : "blue",
  }));
  const context = { canvas: {}, drawImage: vi.fn(), filter: "none" };
  const ctx = context as unknown as CanvasRenderingContext2D;
  const site = SITES[0];
  drawSwissRelief(ctx, site, 0, 0, 426, 791, 0.085, 2.25);
  expect(images.length).toBeGreaterThan(0);
  for (const image of images) image.onload?.();
  const initialImages = images.length;
  const processed = surfaces.length;
  expect(processed).toBe(initialImages);
  expect(appliedFilters.filter(filter => filter === "contrast(1.45) brightness(0.88)")).toHaveLength(initialImages / 2);
  for (let frame = 0; frame < 60; frame++) {
    expect(drawSwissRelief(ctx, site, 0, 0, 426, 791, 0.085, 2.25).loaded).toBe(initialImages / 2);
  }
  expect(images).toHaveLength(initialImages);
  expect(surfaces).toHaveLength(processed);
  expect(surfaces.every(surface => surface.drawImage.mock.calls.length === 1)).toBe(true);
  expect(context.filter).toBe("none");
  expect(context.drawImage).toHaveBeenCalledTimes(initialImages * 60);
  // Appearance changes must not reuse tiles processed with the previous theme.
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "none" }));
  drawSwissRelief(ctx, site, 0, 0, 426, 791, 0.085, 2.25);
  expect(images).toHaveLength(initialImages * 2);
});