import { describe, expect, it } from "vitest";
import { decodeTerrarium, localToPixel } from "./realTerrain";
import { reliefTileUrl } from "./swissMap";

describe("real elevation", () => {
  it("decodes terrarium pixels to metres", () => {
    expect(decodeTerrarium(135, 158, 0)).toBe(1950);
  });
  it("launch maps to the same tile as the swiss map projection", () => {
    const { px, py } = localToPixel({ lat: 46.73, lon: 7.77 }, 0, 0, 13);
    expect(reliefTileUrl(Math.floor(px / 256), Math.floor(py / 256))).toContain("/13/4272/");
  });
});
