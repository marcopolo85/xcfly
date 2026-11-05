import { expect, it, vi } from "vitest";
import { kk7Slot, resetKk7Limiter } from "./kk7Limiter";

it("lets at most 10 KK7 requests start per second", async () => {
  vi.useFakeTimers();
  resetKk7Limiter();
  const started: number[] = [];
  const t0 = Date.now();
  for (let i = 0; i < 25; i++) kk7Slot().then(() => started.push(Date.now() - t0));
  await vi.advanceTimersByTimeAsync(1000);
  expect(started.filter((t) => t < 1000).length).toBe(10);
  await vi.advanceTimersByTimeAsync(2000);
  expect(started.length).toBe(25);
  vi.useRealTimers();
});
