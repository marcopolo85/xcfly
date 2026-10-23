import { describe, it, expect } from "vitest";
import { valleyWindAt, ridgeLift } from "./valleyWind";
import { N, RES, EXTENT, type Terrain } from "./terrain";

// terrain rising to the east: 0.3 slope
const h = new Float32Array(N * N);
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) h[j * N + i] = 1000 + (i * RES - EXTENT) * 0.3;
const t = { h } as unknown as Terrain;

describe("valley wind", () => {
  it("blows uphill and gives slope lift low on the slope", () => {
    const w = valleyWindAt(t, 0, 0, 1050);
    expect(w.wx).toBeGreaterThan(0);
    expect(ridgeLift(t, 0, 0, 1050)).toBeGreaterThan(0.5);
  });
  it("has no slope lift high above ground", () => {
    expect(ridgeLift(t, 0, 0, 1500)).toBe(0);
  });
});
