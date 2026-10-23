import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioVario } from "./audioVario";

function setup() {
  const gain = { value: 0, cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn(), setValueAtTime: vi.fn() };
  const frequency = { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() };
  const node = { connect: vi.fn().mockReturnThis(), frequency, gain, start: vi.fn(), type: "" };
  const resume = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("AudioContext", class {
    currentTime = 1; destination = {};
    resume = resume;
    createOscillator() { return node; }
    createGain() { return node; }
    createBiquadFilter() { return node; }
  });
  return { gain, frequency, resume };
}
afterEach(() => vi.unstubAllGlobals());
describe("acoustic vario", () => {
  it("does not block a flight when browser audio is unavailable", () => {
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("webkitAudioContext", undefined);
    const vario = new AudioVario();
    expect(() => vario.start()).not.toThrow();
    expect(() => vario.update(2)).not.toThrow();
  });
  it("recovers from failed audio initialization and can retry", () => {
    vi.stubGlobal("AudioContext", class { constructor() { throw new Error("Audio unavailable"); } });
    const vario = new AudioVario();
    expect(() => vario.start()).not.toThrow();
    const { resume, gain } = setup();
    vario.start(); vario.update(1);
    expect(resume).toHaveBeenCalledOnce();
    expect(gain.setValueAtTime).toHaveBeenCalledWith(0.08, 1);
  });
  it("resumes a newly created audio context and schedules climb beeps", () => {
    const { resume, gain, frequency } = setup();
    const vario = new AudioVario(); vario.start(); vario.update(1);
    expect(resume).toHaveBeenCalledOnce();
    expect(frequency.setValueAtTime).toHaveBeenCalledWith(1200, 1);
    expect(gain.setValueAtTime).toHaveBeenCalledWith(0.08, 1);
  });
  it("muting cancels pending sound and unmuting can beep immediately", () => {
    const { gain } = setup();
    const vario = new AudioVario(); vario.start(); vario.update(1);
    vario.muted = true; vario.update(1);
    expect(gain.cancelScheduledValues).toHaveBeenCalledTimes(2);
    vario.muted = false; vario.update(1);
    expect(gain.setValueAtTime).toHaveBeenCalledTimes(4);
  });
});
describe("flytec tone", () => {
  it("beeps faster and higher with stronger climb", async () => {
    const { flytecTone } = await import("./audioVario");
    expect(flytecTone(3).freq).toBeGreaterThan(flytecTone(1).freq);
    expect(flytecTone(3).period).toBeLessThan(flytecTone(1).period);
  });
});
