import { describe, expect, it } from "vitest";
import { advanceTask, parseFlyxcLink } from "./flyxcTask";

describe("flyxc task import", () => {
  it("decodes the shared FlyXC link into turnpoints", () => {
    const t = parseFlyxcLink("https://flyxc.app/?p=%7Dx%60_Hizot%40jnl%40la_Cknl%40qwD");
    expect(t?.points).toHaveLength(3);
    expect(t?.points[0]?.lat).toBeCloseTo(47.19519, 5);
    expect(t?.points[1]?.lon).toBeCloseTo(8.11406, 5);
    expect(t?.radius).toBe(400);
  });
  it("rejects other links", () => {
    expect(parseFlyxcLink("https://example.com/?p=abc")).toBeNull();
    expect(parseFlyxcLink("kein link")).toBeNull();
  });
  it("advances only inside the 400 m cylinder", () => {
    const t = { local: [{ x: 0, y: 0 }, { x: 1000, y: 0 }], next: 1, radius: 400 };
    expect(advanceTask(t, 500, 0)).toBe(false);
    expect(advanceTask(t, 700, 0)).toBe(true);
    expect(t.next).toBe(2);
  });
});
