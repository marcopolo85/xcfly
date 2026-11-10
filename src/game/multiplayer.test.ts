import { describe, expect, it } from "vitest";
import { advanceRemote, MAX_EXTRAPOLATION_S, prunePilots, toLatLon, toLocal, type RemotePilot } from "./multiplayer";

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
  it("extrapolates position from velocity between packets", () => {
    const r: RemotePilot = { ...p(0), px: 0, py: 0, vx: 100, vy: 0 };
    advanceRemote(r, 0, 0);
    for (let t = 16; t <= 1000; t += 16) advanceRemote(r, t, 0.016);
    expect(r.dx).toBeGreaterThan(80);
    expect(r.dx).toBeLessThan(100);
  });
  it("stops extrapolating after the cap", () => {
    const r: RemotePilot = { ...p(0), px: 0, py: 0, vx: 10, vy: 0 };
    advanceRemote(r, 10_000, 0);
    expect(r.dx).toBeCloseTo(10 * MAX_EXTRAPOLATION_S);
  });
});

import { extendTrail, TRAIL_MAX } from "./multiplayer";
describe("extendTrail", () => {
  it("adds points only after 30 m and caps length", () => {
    let t = extendTrail(undefined, 0, 0);
    t = extendTrail(t, 10, 0);
    expect(t.length).toBe(1);
    t = extendTrail(t, 40, 0);
    expect(t.length).toBe(2);
    for (let i = 0; i < 400; i++) t = extendTrail(t, i * 100, 0);
    expect(t.length).toBe(TRAIL_MAX);
  });
});
