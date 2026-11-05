import { afterEach, expect, it, vi } from "vitest";
import { SITES } from "./sites";

const mocked = vi.hoisted(() => ({ response: vi.fn() }));
vi.mock("./thermalRegion", () => ({ thermalRegionBounds: () => ({ x0: 0, y0: 0, x1: 4095, y1: 4095 }) }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); mocked.response.mockReset(); vi.restoreAllMocks(); });

it("loads bundled tiles (never kk7.ch): only the the 3x3 tiles around launch, then single tiles on demand without duplicates", async () => {
  mocked.response.mockImplementation(async (url: string) => { expect(url).toMatch(/^\/kk7\/12\/\d+\/\d+\.png$/); return { ok: true, blob: async () => new Blob() }; });
  vi.stubGlobal("fetch", mocked.response);
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ close: vi.fn() })));
  vi.spyOn(document, "createElement").mockImplementation(() => ({ width: 0, height: 0, getContext: () => ({ clearRect: vi.fn(), drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray(65536 * 4) }) }) }) as unknown as HTMLCanvasElement);
  const { loadThermalRegion, requestRegionalTile } = await import("./loadThermalRegion");
  const map = await loadThermalRegion(SITES[0], () => {});
  expect(mocked.response).toHaveBeenCalledTimes(9);
  expect(map.regionalTiles?.size).toBe(9);
  await Promise.all([requestRegionalTile(10, 10), requestRegionalTile(10, 10)]);
  expect(mocked.response).toHaveBeenCalledTimes(10);
  await loadThermalRegion(SITES[0], () => {});
  expect(mocked.response).toHaveBeenCalledTimes(10);
});
