import { describe, expect, it } from "vitest";
import { finishedFlightStats, formatFlightHours } from "./flightStats";

describe("flight duration statistics", () => {
  it("records the simulated duration of an unranked finished flight in seconds", () => {
    expect(finishedFlightStats("Gummen", "free", 5400.4)).toEqual({
      site_name: "Gummen", mode: "free", duration_s: 5400,
    });
  });

  it("preserves weekly task durations longer than four hours", () => {
    expect(finishedFlightStats("Pilatus", "weekly_task", 18000).duration_s).toBe(18000);
  });

  it("shows total hours with one decimal without rounding each flight separately", () => {
    expect(formatFlightHours((3600 + 1800) / 3600)).toBe("1.5");
    expect(formatFlightHours(0)).toBe("0.0");
  });
});