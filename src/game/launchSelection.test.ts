import { expect, it } from "vitest";
import { localToCoordinates, selectedLaunch } from "./launchSelection";
import { hotspotLocal } from "./thermalHotspots";
import { SITES } from "./sites";

it("selects the actual tapped coordinates using the same map projection as flight terrain", () => {
  const base = SITES[0];
  const coordinates = { lat: 46.21, lon: 9.01 };
  const local = hotspotLocal(base, coordinates);
  const selected = localToCoordinates(base, local.x, local.y);
  expect(selected.lat).toBeCloseTo(46.21, 8);
  expect(selected.lon).toBeCloseTo(9.01, 8);
});

it("launches at the selected point and its measured ground elevation, with a coordinate-specific cache key", () => {
  const site = selectedLaunch(SITES[0], 46.21, 9.01, 1543);
  expect(site.lat).toBe(46.21);
  expect(site.lon).toBe(9.01);
  expect(site.launchAlt).toBe(1543);
  expect(site.id).not.toBe(selectedLaunch(SITES[0], 46.22, 9.01, 1543).id);
});