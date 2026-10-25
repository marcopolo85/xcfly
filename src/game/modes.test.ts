import { describe, expect, it } from "vitest";
import { MODE_TIME_LIMIT_S, modeScore, RETURN_RADIUS_M } from "./modes";

describe("modeScore", () => {
  it("begrenzt Out & Return und One-Way auf 4 Stunden", () => {
    expect(MODE_TIME_LIMIT_S).toBe(4 * 3600);
  });

  it("zählt Out & Return nur bei Rückkehr in den 400-m-Radius", () => {
    expect(RETURN_RADIUS_M).toBe(400);
    expect(modeScore("out_return", 52000, 350, 90000)).toEqual({ score: 52000, goal: true });
    expect(modeScore("out_return", 52000, 401, 90000)).toEqual({ score: 0, goal: false });
  });

  it("zählt One-Way die Entfernung vom Start am Flugende", () => {
    expect(modeScore("one_way", 60000, 48000, 90000)).toEqual({ score: 48000, goal: true });
  });

  it("zählt Freeflight die optimierte freie Strecke", () => {
    expect(modeScore("free", 10000, 5000, 73500)).toEqual({ score: 73500, goal: true });
  });
});
