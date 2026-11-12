import { describe, expect, it } from "vitest";
import { ghostAt, GHOST_STYLES } from "./ghosts";
const g = { name: "A", rank: 0, duration: 100, pts: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }] };
describe("ghosts", () => {
  it("interpolates position over flight duration", () => { expect(ghostAt(g, 50)!.x).toBeCloseTo(100); });
  it("disappears after landing", () => { expect(ghostAt(g, 101)).toBeNull(); });
  it("rank 1 is gold, not the own wing colour", () => { expect(GHOST_STYLES[0].color).toBe("#f59e0b"); });
});
