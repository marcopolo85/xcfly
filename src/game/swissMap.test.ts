import { describe, expect, it } from "vitest";
import { mapOrigin, reliefLevel, reliefTileUrl, waterTileUrl, forestTileUrl, riverTileUrl, visibleReliefTiles } from "./swissMap";

describe("Swiss relief map", () => {
  it("uses real water geometry in the same projection as the relief", () => {
    expect(waterTileUrl(8544, 5784, 14)).toBe("https://wmts.geo.admin.ch/1.0.0/ch.bafu.vec25-seen/default/current/3857/14/8544/5784.png");
    expect(forestTileUrl(8544, 5784, 14)).toBe("https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swisstlm3d-wald/default/current/3857/14/8544/5784.png");
    expect(riverTileUrl(8544, 5784, 14)).toBe("https://wmts.geo.admin.ch/1.0.0/ch.bafu.vec25-gewaessernetz_2000/default/current/3857/14/8544/5784.png");
  });
  it("uses the public Swiss relief layer", () => {
    expect(reliefTileUrl(2136, 1445, 13)).toBe("https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.leichte-basiskarte_reliefschattierung/default/current/3857/13/2136/1445.png");
  });
  it("picks the tile level from screen zoom and device pixel ratio", () => {
    expect(reliefLevel(0.687, 0.085, 1)).toBe(13);
    expect(reliefLevel(0.687, 0.085, 2.25)).toBe(14);
    expect(reliefLevel(0.687, 0.68, 2.25)).toBe(17);
    expect(reliefLevel(0.687, 0.02, 1)).toBe(11);
  });
  it("centres the launch coordinates on the real Swiss location", () => {
    const site = { lat: 46.71, lon: 7.77 };
    expect(mapOrigin(site).x).toBeCloseTo(864952.44, 1);
    const tiles = visibleReliefTiles(site, 0, 0, 426, 791, 0.085);
    const launchTile = tiles.find(t => t.left <= 213 && t.left + t.size > 213 && t.top <= 435.05 && t.top + t.size > 435.05);
    expect(launchTile?.x).toBe(4272);
    expect(launchTile?.y).toBe(2890);
    expect(launchTile?.level).toBe(13);
  });
  it("requests sharper tiles on high-dpi screens", () => {
    const site = { lat: 46.71, lon: 7.77 };
    const tiles = visibleReliefTiles(site, 0, 0, 426, 791, 0.085, 2.25);
    const launchTile = tiles.find(t => t.left <= 213 && t.left + t.size > 213 && t.top <= 435.05 && t.top + t.size > 435.05);
    expect(launchTile?.level).toBe(14);
    expect(launchTile?.x).toBe(8545);
    expect(launchTile?.y).toBe(5781);
  });
});
