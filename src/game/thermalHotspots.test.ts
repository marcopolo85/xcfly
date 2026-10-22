import { describe, expect, it } from "vitest";
import { SITES } from "./sites";
import { N, type Terrain } from "./terrain";
import { generateHotspotThermals, hotspotLocal, hotspotUrl, parseHotspots } from "./thermalHotspots";

describe("KK7 thermal positions", () => {
  const site = SITES[0];
  const point = { lon: 8.99, lat: 46.19, probability: 0.9 };
  const terrain: Terrain = { site, h: new Float32Array(N * N), cb: new Float32Array(1600), cbN: 40 };
  it("retains exact provider coordinates without adding a launch source or jitter", () => {
    const expected = hotspotLocal(site, point);
    expect(expected.x).toBeCloseTo(321.26, 2);
    expect(expected.y).toBeCloseTo(-1759.71, 2);
    for (const random of [() => 0, () => 0.9]) {
      const field = generateHotspotThermals(terrain, [point], random);
      expect(field.count).toBe(1);
      const source = [...field.grid.values()].flat()[0];
      expect(source.x).toBe(expected.x);
      expect(source.y).toBe(expected.y);
    }
  });
  it("filters points outside flight terrain and removes duplicate positions", () => {
    const field = generateHotspotThermals(terrain, [point, point, { lon: 0, lat: 0, probability: 1 }], () => 0);
    expect(field.count).toBe(1);
  });
  it("uses the uploaded KML's unfiltered all-times dataset", () => {
    expect(hotspotUrl(site)).toContain("/geojson/all_all/");
  });
  it("reads longitude then latitude from the provider's GeoJSON", () => {
    expect(parseHotspots({ features: [{ geometry: { type: "Point", coordinates: [8.99, 46.19] }, properties: { probability: 0.9 } }] })).toEqual([point]);
    expect(() => parseHotspots({ features: [] })).toThrow();
  });
});