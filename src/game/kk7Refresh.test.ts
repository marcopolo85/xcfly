import { expect, it } from "vitest";
import { refreshBatch, regionTiles, refreshVersion } from "./kk7Refresh";

it("covers every region tile once within the 3-hour refresh window, marking the final batch", () => {
  const seen = new Set<string>();
  let lastCount = 0;
  for (let m = 0; m < 180; m++) {
    const b = refreshBatch(new Date(Date.UTC(2027, 0, 1, Math.floor(m / 60), m % 60)));
    for (const t of b.tiles) seen.add(`${t.x},${t.y}`);
    if (b.last) lastCount++;
  }
  expect(seen.size).toBe(regionTiles().length);
  expect(lastCount).toBe(1);
  expect(refreshVersion(new Date(Date.UTC(2027, 3, 1)))).toBe("2027-Q2");
});
