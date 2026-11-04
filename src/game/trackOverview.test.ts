import { expect, it } from "vitest";
import { fitTrackOverview, trackOverviewCamera } from "./trackOverview";
import { mapOrigin } from "./swissMap";

it("places the whole track within the map and uses the same Mercator anchor as the tiles", () => {
  const track: [number, number][] = [[46.41472, 8.10889], [46.1, 8.3], [46.6, 8.6]];
  const fit = fitTrackOverview(track, 320, 220);
  expect(fit).not.toBeNull();
  if (!fit) return;
  const origin = mapOrigin(fit.site);
  track.forEach(([lat, lon], index) => {
    const world = mapOrigin({ lat, lon });
    expect(fit.points[index].x).toBeCloseTo(160 + ((world.x - origin.x) * origin.scale - fit.x) * fit.zoom);
    expect(fit.points[index].y).toBeCloseTo(121 - ((world.y - origin.y) * origin.scale - fit.y) * fit.zoom);
    expect(fit.points[index].x).toBeGreaterThanOrEqual(24);
    expect(fit.points[index].x).toBeLessThanOrEqual(296);
    expect(fit.points[index].y).toBeGreaterThanOrEqual(24);
    expect(fit.points[index].y).toBeLessThanOrEqual(196);
  });
});

it("fits a stationary track without infinite zoom", () => {
  const fit = fitTrackOverview([[47, 8], [47, 8]], 320, 220);
  expect(fit?.zoom).toBe(172 / 500);
  expect(fit?.points[0].x).toBe(160);
  expect(fit?.points[0].y).toBeCloseTo(110);
});

it("keeps the zoomed and panned track aligned with the map's 55% anchor", () => {
  const fit = { x: 1000, y: -2000, zoom: 0.05 };
  const view = { x: -70, y: 35, k: 2 };
  const camera = trackOverviewCamera(fit, 320, 220, view);
  const point = { x: 1600, y: -2400 };
  expect(camera.zoom).toBe(0.1);
  expect(160 + (point.x - camera.x) * camera.zoom).toBeCloseTo((160 + (point.x - fit.x) * fit.zoom) * 2 - 70);
  expect(121 - (point.y - camera.y) * camera.zoom).toBeCloseTo((121 - (point.y - fit.y) * fit.zoom) * 2 + 35);
  expect(trackOverviewCamera(fit, 320, 220, { x: 0, y: 0, k: 1 })).toEqual(fit);
});