import { describe, expect, it } from "vitest";
import { prunePilots, toLatLon, toLocal, type RemotePilot } from "./multiplayer";

const p = (seen: number): RemotePilot => ({ id: "a", name: "A", lat: 0, lon: 0, alt: 0, heading: 0, vz: 0, seen });

describe("multiplayer", () => {
  it("keeps pilots for 1 minute without update", () => {
    const m = new Map([["a", p(0)]]);
    prunePilots(m, 59_000);
    expect(m.size).toBe(1);
    prunePilots(m, 61_000);
    expect(m.size).toBe(0);
  });
  it("round-trips coordinates", () => {
    const site = { lat: 46.9, lon: 8.36 };
    const ll = toLatLon(site, 5000, -3000);
    const back = toLocal(site, ll.lat, ll.lon);
    expect(back.x).toBeCloseTo(5000, 3);
    expect(back.y).toBeCloseTo(-3000, 3);
  });
});
