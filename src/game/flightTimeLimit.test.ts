import { describe, expect, it } from "vitest";
import { XC_TIME_LIMIT_S, flightTimeLimit } from "./modes";

describe("flightTimeLimit", () => {
  it("XC hat 4 Stunden Zeitlimit", () => {
    expect(flightTimeLimit("xc")).toBe(XC_TIME_LIMIT_S);
    expect(XC_TIME_LIMIT_S).toBe(4 * 3600);
  });
  it("Weekly-Task hat kein Zeitlimit", () => {
    expect(flightTimeLimit("xc", true)).toBeUndefined();
  });
  it("Freeflight hat kein Zeitlimit", () => {
    expect(flightTimeLimit("free")).toBeUndefined();
    expect(flightTimeLimit("free", true)).toBeUndefined();
  });
});
