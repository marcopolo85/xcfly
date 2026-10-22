/**
 * Flytec-style acoustic vario: clean sine-like tone, short crisp beeps whose
 * pitch and repetition rate rise with climb, plus a slight chirp within each
 * beep; continuous falling low tone in strong sink.
 */
export function flytecTone(vz: number) {
  const freq = Math.min(1800, 700 + vz * 120);
  const rate = Math.min(9, 1.6 + vz * 1.3); // beeps per second
  const period = 1 / rate;
  return { freq, period, on: period * 0.55 };
}
export class AudioVario {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private nextBeep = 0;
  muted = false;

  start() {
    if (this.ctx) { this.nextBeep = 0; void this.ctx.resume().catch(() => {}); return; }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.osc = this.ctx.createOscillator();
    this.osc.type = "triangle";
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 3000;
    this.osc.connect(filter).connect(this.gain).connect(this.ctx.destination);
    this.osc.start();
    // Mobile browsers may create the context suspended, even in a tap handler.
    void this.ctx.resume().catch(() => {});
  }

  update(vz: number) {
    const ctx = this.ctx, g = this.gain, o = this.osc;
    if (!ctx || !g || !o) return;
    const now = ctx.currentTime;
    if (this.muted) {
      g.gain.cancelScheduledValues(now);
      g.gain.setTargetAtTime(0, now, 0.01);
      this.nextBeep = 0;
      return;
    }
    if (vz > 0.1) {
      if (now >= this.nextBeep) {
        const { freq, period, on } = flytecTone(vz);
        o.frequency.cancelScheduledValues?.(now);
        o.frequency.setValueAtTime(freq, now);
        o.frequency.linearRampToValueAtTime(freq * 1.06, now + on);
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(0.13, now);
        g.gain.setValueAtTime(0, now + on);
        this.nextBeep = now + period;
      }
    } else if (vz < -2.3) {
      g.gain.cancelScheduledValues(now);
      o.frequency.setTargetAtTime(Math.max(200, 420 + (vz + 2.3) * 40), now, 0.05);
      g.gain.setTargetAtTime(0.07, now, 0.05);
      this.nextBeep = 0;
    } else {
      g.gain.cancelScheduledValues(now);
      g.gain.setTargetAtTime(0, now, 0.03);
      this.nextBeep = 0;
    }
  }

  stop() {
    void this.ctx?.close();
    this.ctx = null; this.osc = null; this.gain = null; this.nextBeep = 0;
  }
}
