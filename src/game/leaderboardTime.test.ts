import { describe, expect, it } from "vitest";
import { getWeeklyCutoff } from "./leaderboardTime";

describe("weekly leaderboard reset", () => {
  it("Sunday 22:59 Zurich still belongs to the previous week", () => {
    expect(getWeeklyCutoff(new Date("2026-11-08T21:59:00Z"))).toBe("2026-11-01T22:00:00.000Z");
  });
  it("Sunday 23:00 Zurich starts a new week", () => {
    expect(getWeeklyCutoff(new Date("2026-11-08T22:00:00Z"))).toBe("2026-11-08T22:00:00.000Z");
  });
  it("Wednesday uses last Sunday 23:00 (summer time)", () => {
    expect(getWeeklyCutoff(new Date("2026-07-15T10:00:00Z"))).toBe("2026-07-12T21:00:00.000Z");
  });
});
