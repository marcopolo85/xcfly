/** Global request pacing for the public KK7 server: at most 10 requests per second. */
export const KK7_MAX_PER_SECOND = 10;
const INTERVAL = 1000 / KK7_MAX_PER_SECOND;
let nextSlot = 0;

export function isKk7Url(url: string) {
  return url.includes("kk7.ch");
}

/** Resolves when the caller may start its request; slots are spaced 100 ms apart. */
export function kk7Slot(now = Date.now()): Promise<void> {
  const start = Math.max(now, nextSlot);
  nextSlot = start + INTERVAL;
  const wait = start - now;
  return wait > 0 ? new Promise((resolve) => setTimeout(resolve, wait)) : Promise.resolve();
}

export function resetKk7Limiter() { nextSlot = 0; }
