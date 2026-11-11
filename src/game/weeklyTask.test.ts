import { describe, expect, it } from "vitest";
import { compareWeekly, taskFlownKm, weeklyTask } from "./weeklyTask";
import { taskDistanceKm } from "./flyxcTask";
import { inThermalRegion } from "./thermalRegion";

describe("weekly task", () => {
  it("stays the same until Sunday 23:00 Zurich and changes afterwards", () => {
    const sat = weeklyTask(new Date("2026-11-14T12:00:00Z"));
    const sun2259 = weeklyTask(new Date("2026-11-15T21:59:00Z"));
    const sun2301 = weeklyTask(new Date("2026-11-15T22:01:00Z"));
    expect(sun2259.weekStart).toBe(sat.weekStart);
    expect(sun2259.task).toEqual(sat.task);
    expect(sun2301.weekStart).toBe("2026-11-15T22:00:00.000Z");
  });
  it("has 3 turnpoints, ~150 km, inside the region, starting at the launch", () => {
    for (let w = 0; w < 20; w++) {
      const { site, task } = weeklyTask(new Date(Date.UTC(2026, 0, 5 + w * 7)));
      expect(task.points).toHaveLength(4);
      expect(task.points[0]).toEqual({ lat: site.lat, lon: site.lon });
      expect(taskDistanceKm(task.points)).toBeGreaterThan(130);
      expect(taskDistanceKm(task.points)).toBeLessThan(170);
      expect(task.points.every((p) => inThermalRegion(p.lat, p.lon))).toBe(true);
    }
  });
  it("counts completed legs plus progress on the current leg", () => {
    const t = { local: [{ x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 10000 }], next: 2, radius: 400 };
    expect(taskFlownKm(t, 10000, 4000)).toBeCloseTo(14);
  });
  it("ranks by km, then shorter flight time", () => {
    const rows = [{ distance_km: 50, duration_s: 100 }, { distance_km: 80, duration_s: 9000 }, { distance_km: 80, duration_s: 5000 }];
    expect(rows.sort(compareWeekly)).toEqual([{ distance_km: 80, duration_s: 5000 }, { distance_km: 80, duration_s: 9000 }, { distance_km: 50, duration_s: 100 }]);
  });
});
