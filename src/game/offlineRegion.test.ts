import { expect, it } from "vitest";
import { offlineRegionUrls } from "./offlineRegion";
import { SITES } from "./sites";
import { localToPixel, demTileUrl } from "./realTerrain";
import { thermalTileUrl } from "./thermalRaster";

it("saves real DEM and KK7 tiles at all corners of the launch coverage", () => {
  const site = SITES[0];
  const urls = offlineRegionUrls(site, "xcfly.lovable.app");
  for (const x of [-20000, 20000]) for (const y of [-20000, 20000]) {
    const { px, py } = localToPixel(site, x, y, 12);
    const tx = Math.floor(px / 256), ty = Math.floor(py / 256);
    expect(urls).toContain(demTileUrl(12, tx, ty));
    expect(urls).toContain(thermalTileUrl(tx, ty, "xcfly.lovable.app"));
  }
  expect(urls.length).toBe(new Set(urls).size);
  expect(urls.every((url) => !url.includes("openstreetmap") && !url.includes("opentopomap"))).toBe(true);
});