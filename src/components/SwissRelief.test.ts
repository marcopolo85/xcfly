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
  expect(appliedFilters.filter(filter => filter === "contrast(1.45) brightness(0.88)")).toHaveLength(initialImages / 4);
  for (let frame = 0; frame < 60; frame++) {
    expect(drawSwissRelief(ctx, site, 0, 0, 426, 791, 0.085, 2.25).loaded).toBe(initialImages / 4);
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

it("fills transparent swisstopo tiles beyond the Swiss border from a global underlay", () => {
  const images: { src: string; onload?: () => void }[] = [];
  vi.stubGlobal("Image", class {
    naturalWidth = 256;
    naturalHeight = 256;
    src = "";
    onload?: () => void;
    constructor() { images.push(this); }
  });
  const contexts: { filter: string; drawImage: ReturnType<typeof vi.fn>; getImageData: () => { data: Uint8ClampedArray } }[] = [];
  vi.stubGlobal("document", {
    createElement: () => {
      const context = { filter: "none", drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray(4) }) };
      contexts.push(context);
      return { width: 0, height: 0, getContext: () => context };
    },
  });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "none" }));
  const context = { canvas: {}, drawImage: vi.fn(), filter: "none" };
  const site = SITES[0];
  // Offset coordinates keep this test clear of the tile cache warmed by the first test.
  drawSwissRelief(context as unknown as CanvasRenderingContext2D, site, 12345, 12345, 426, 791, 0.085, 2.25);
  const baseTiles = images.filter((image) => image.src.includes("reliefschattierung"));
  expect(baseTiles.length).toBeGreaterThan(0);
  for (const base of baseTiles) base.onload?.();
  const underlays = images.filter((image) => image.src.includes("opentopomap.org"));
  expect(underlays.length).toBe(baseTiles.length);
  for (const under of underlays) under.onload?.();
  // Merged surfaces draw the global underlay first, then the swisstopo content on top.
  const merged = contexts.filter((c) => c.drawImage.mock.calls.length === 2);
  expect(merged.length).toBe(underlays.length);
  for (const surface of merged) expect(surface.filter).toBe("none");
  // A second frame reuses the cached tiles without new requests.
  const before = images.length;
  drawSwissRelief(context as unknown as CanvasRenderingContext2D, site, 12345, 12345, 426, 791, 0.085, 2.25);
  expect(images).toHaveLength(before);
});