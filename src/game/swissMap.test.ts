import { describe, expect, it } from "vitest";
import { mapOrigin, reliefTileUrl, visibleReliefTiles } from "./swissMap";

describe("Swiss relief map", () => {
  it("uses the public Swiss relief layer", () => {
    expect(reliefTileUrl(2136, 1445)).toBe("https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/13/2136/1445.jpeg");
  });
  it("centres the launch coordinates on the real Swiss location", () => {
    const site = { lat: 46.71, lon: 7.77 };
    expect(mapOrigin(site).x).toBeCloseTo(864952.44, 1);
    const tiles = visibleReliefTiles(site, 0, 0, 426, 791, 0.085);
    const launchTile = tiles.find(t => t.left <= 213 && t.left + t.size > 213 && t.top <= 435.05 && t.top + t.size > 435.05);
    expect(launchTile?.x).toBe(4272);
    expect(launchTile?.y).toBe(2890);
  });
});