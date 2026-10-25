import { afterEach, expect, it, vi } from "vitest";
import { SITES } from "./sites";

const mocked = vi.hoisted(() => ({ response: vi.fn() }));
vi.mock("@/lib/offline-data", () => ({ tileResponse: mocked.response }));
vi.mock("./thermalRegion", () => ({ thermalRegionBounds: () => ({ x0: 2140, y0: 1450, x1: 2143, y1: 1452 }) }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); mocked.response.mockReset(); });

it("shares six download workers, keeps successful tiles for retries, and reuses the region for other launches", async () => {
  let active = 0, maximum = 0, fail = true, failures = 0;
  mocked.response.mockImplementation(async (url: string) => {
    active++; maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    if (fail && url.includes("/2140/")) { failures++; throw new Error("offline"); }
    return { blob: async () => new Blob() };
  });
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ close: vi.fn() })));
  vi.spyOn(document, "createElement").mockImplementation(() => ({ width: 0, height: 0, getContext: () => ({ clearRect: vi.fn(), drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray(65536 * 4) }) }) }) as unknown as HTMLCanvasElement);
  const { loadThermalRegion } = await import("./loadThermalRegion");
  await expect(loadThermalRegion(SITES[0], () => {})).rejects.toThrow("offline");
  fail = false;
  const [first, second] = await Promise.all([loadThermalRegion(SITES[0], () => {}), loadThermalRegion(SITES[1], () => {})]);
  expect(maximum).toBeLessThanOrEqual(6);
  expect(first.regionalTiles?.size).toBe(12);
  expect(first.regionalTiles).toBe(second.regionalTiles);
  expect(first.raster.site).toBe(SITES[0]);
  expect(second.raster.site).toBe(SITES[1]);
  expect(mocked.response).toHaveBeenCalledTimes(12 + failures);
  const requests = mocked.response.mock.calls.length;
  await loadThermalRegion(SITES[0], () => {});
  expect(mocked.response).toHaveBeenCalledTimes(requests);
  vi.restoreAllMocks();
});